using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;

namespace SmartSpend.Api.BackgroundServices;

public class EveningNudgeService(
    IServiceScopeFactory scopeFactory,
    ILogger<EveningNudgeService> logger,
    IConfiguration config)
    : BackgroundService
{
    private const string FireKey = "notification:evening:next_fire_utc";

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
            var delay   = nextUtc - DateTime.UtcNow;

            if (delay > TimeSpan.Zero)
            {
                logger.LogInformation("Evening nudge scheduled at {Time} UTC (in {Min:F0} min).", nextUtc, delay.TotalMinutes);
                await Task.Delay(delay, stoppingToken);
            }

            if (!stoppingToken.IsCancellationRequested)
            {
                await SendEveningBatchAsync(stoppingToken);
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

        var next  = ComputeNextFire();
        var entry = await db.AppSettings.FindAsync(FireKey);
        if (entry is null)
            db.AppSettings.Add(new AppSetting { Key = FireKey, Value = next.ToString("o") });
        else
        {
            entry.Value     = next.ToString("o");
            entry.UpdatedAt = DateTime.UtcNow;
        }
        await db.SaveChangesAsync();
    }

    private DateTime ComputeNextFire()
    {
        var tz       = GetTimeZone();
        var nowLocal = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var nextLocal = nowLocal.Hour < 19
            ? nowLocal.Date.AddHours(19)
            : nowLocal.Date.AddDays(1).AddHours(19);
        return TimeZoneInfo.ConvertTimeToUtc(nextLocal, tz);
    }

    private async Task SendEveningBatchAsync(CancellationToken ct)
    {
        using var scope     = scopeFactory.CreateScope();
        var db              = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var decisionService = scope.ServiceProvider.GetRequiredService<DecisionService>();
        var pushService     = scope.ServiceProvider.GetRequiredService<PushService>();

        var users = await db.Users
            .Include(u => u.Subscriptions)
            .Where(u => u.Subscriptions.Any())
            .ToListAsync(ct);

        var tz        = GetTimeZone();
        var nowLocal  = TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        var isWeekend = nowLocal.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
        var deadSubs  = new List<int>();

        foreach (var user in users)
        {
            if (!user.NextPayday.HasValue) continue;

            var result = decisionService.DailyStatus(user.Balance, user.NextPayday.Value);
            var body   = (result.Status, isWeekend) switch
            {
                ("SAFE",    false) => $"You've still got ${result.SafePerDay:F0} safe today. Don't lose it tonight.",
                ("SAFE",    true)  => $"Weekend evenings are expensive. ${result.SafePerDay:F0} safe — keep it.",
                ("CAREFUL", _)     => "Careful — evenings are where you overspend.",
                _                  => "Don't spend tonight — you're already at risk.",
            };

            foreach (var sub in user.Subscriptions)
            {
                var ok = await pushService.SendAsync(sub, "Evening check", body);
                if (!ok) deadSubs.Add(sub.Id);
            }
        }

        if (deadSubs.Count > 0)
        {
            db.Subscriptions.RemoveRange(db.Subscriptions.Where(s => deadSubs.Contains(s.Id)));
            await db.SaveChangesAsync(ct);
        }

        logger.LogInformation("Evening nudge complete — {Count} users notified.", users.Count);
    }
}
