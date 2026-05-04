using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;

namespace SmartSpend.Api.BackgroundServices;

public class WeeklySummaryService(
    IServiceScopeFactory scopeFactory,
    ILogger<WeeklySummaryService> logger,
    IConfiguration config)
    : BackgroundService
{
    private const string FireKey = "notification:weekly:next_fire_utc";

    private TimeZoneInfo GetTimeZone()
    {
        var tzId = config["Notifications:TimeZone"] ?? "Asia/Kolkata";
        try { return TimeZoneInfo.FindSystemTimeZoneById(tzId); }
        catch
        {
            logger.LogWarning("Unknown timezone '{TzId}', falling back to UTC.", tzId);
            return TimeZoneInfo.Utc;
        }
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var nextUtc = await GetOrComputeNextFireAsync();
            var delay = nextUtc - DateTime.UtcNow;

            if (delay > TimeSpan.Zero)
            {
                logger.LogInformation("Weekly summary scheduled at {Time} UTC (in {Min:F0} min).", nextUtc, delay.TotalMinutes);
                await Task.Delay(delay, stoppingToken);
            }

            if (!stoppingToken.IsCancellationRequested)
            {
                await SendWeeklySummaryAsync(stoppingToken);
                await PersistNextFireAsync();
            }
        }
    }

    private async Task<DateTime> GetOrComputeNextFireAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var setting = await db.AppSettings.FindAsync(FireKey);
        if (setting is not null && DateTime.TryParse(setting.Value, out var stored) && stored > DateTime.UtcNow)
            return stored;

        return ComputeNextFire();
    }

    private async Task PersistNextFireAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var next = ComputeNextFire();
        var entry = await db.AppSettings.FindAsync(FireKey);
        if (entry is null)
        {
            db.AppSettings.Add(new AppSetting { Key = FireKey, Value = next.ToString("o") });
        }
        else
        {
            entry.Value = next.ToString("o");
            entry.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
    }

    private DateTime ComputeNextFire()
    {
        var tz = GetTimeZone();
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var daysUntilSunday = ((int)DayOfWeek.Sunday - (int)nowLocal.DayOfWeek + 7) % 7;
        if (daysUntilSunday == 0 && nowLocal.Hour >= 20) daysUntilSunday = 7;

        var nextLocal = nowLocal.Date.AddDays(daysUntilSunday).AddHours(20);
        return TimeZoneInfo.ConvertTimeToUtc(nextLocal, tz);
    }

    private async Task SendWeeklySummaryAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var pushService = scope.ServiceProvider.GetRequiredService<PushService>();
        var plans = scope.ServiceProvider.GetRequiredService<FinancePlanService>();

        var thisWeek = DateTime.UtcNow.AddDays(-7);
        var lastWeek = DateTime.UtcNow.AddDays(-14);
        var users = await db.Users
            .Include(u => u.Subscriptions)
            .Include(u => u.FinancePlan)
            .Where(u => u.Subscriptions.Any())
            .ToListAsync(ct);

        var deadSubs = new List<int>();

        foreach (var user in users)
        {
            var plan = await plans.EnsurePlanAsync(user, ct);
            var records = await db.ActionRecords
                .Where(a => (a.FinancePlanId == plan.Id || (a.FinancePlanId == null && a.UserId == user.Id)) && a.CreatedAt >= lastWeek)
                .ToListAsync(ct);

            var current = records.Where(r => r.CreatedAt >= thisWeek).ToList();
            var previous = records.Where(r => r.CreatedAt < thisWeek).ToList();

            string body;
            if (current.Count == 0)
            {
                body = "No activity this week. Use SmartSpend before you spend - it takes 3 seconds.";
            }
            else
            {
                var good = current.Count(r => !r.Spent);
                var bad = current.Count(r => r.Spent);
                var currentSaved = current.Where(r => !r.Spent).Sum(r => r.Amount);
                var previousSaved = previous.Where(r => !r.Spent).Sum(r => r.Amount);
                var delta = currentSaved - previousSaved;

                body = delta >= 0
                    ? $"You made {good} good calls this week, {bad} bad ones. You're ${delta:F0} ahead of last week."
                    : $"You made {good} good calls this week, {bad} bad ones. ${Math.Abs(delta):F0} behind last week - reset today.";
            }

            foreach (var sub in user.Subscriptions)
            {
                var ok = await pushService.SendAsync(sub, "Weekly recap", body);
                if (!ok) deadSubs.Add(sub.Id);
            }
        }

        if (deadSubs.Count > 0)
        {
            db.Subscriptions.RemoveRange(db.Subscriptions.Where(s => deadSubs.Contains(s.Id)));
            await db.SaveChangesAsync(ct);
        }

        logger.LogInformation("Weekly summary complete - {Count} users notified.", users.Count);
    }
}
