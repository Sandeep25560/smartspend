using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;

namespace SmartSpend.Api.BackgroundServices;

public class DailyNotificationService(
    IServiceScopeFactory scopeFactory,
    ILogger<DailyNotificationService> logger,
    IConfiguration config)
    : BackgroundService
{
    private const string FireKey = "notification:daily:next_fire_utc";

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
                logger.LogInformation("Daily push scheduled at {Time} UTC (in {Min:F0} min).", nextUtc, delay.TotalMinutes);
                await Task.Delay(delay, stoppingToken);
            }

            if (!stoppingToken.IsCancellationRequested)
            {
                await SendDailyBatchAsync(stoppingToken);
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
        var nextLocal = nowLocal.Hour < 8
            ? nowLocal.Date.AddHours(8)
            : nowLocal.Date.AddDays(1).AddHours(8);
        return TimeZoneInfo.ConvertTimeToUtc(nextLocal, tz);
    }

    private async Task SendDailyBatchAsync(CancellationToken ct)
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
            string title, body;

            if (!user.NextPayday.HasValue)
                continue;

            var paydayPassed = user.NextPayday.Value.Date < DateTime.UtcNow.Date;

            if (paydayPassed)
            {
                title = "SmartSpend";
                body  = "Your payday has passed — open the app to set your next one.";
            }
            else
            {
                var result = decisionService.DailyStatus(user.Balance, user.NextPayday.Value);
                (title, body) = (result.Status, isWeekend) switch
                {
                    ("SAFE",    true)  => ("SmartSpend", $"Weekends get expensive. You have ${result.SafePerDay:F0} safe today."),
                    ("SAFE",    false) => ("SmartSpend", $"You have ${result.SafePerDay:F0} safe to spend today."),
                    ("CAREFUL", true)  => ("SmartSpend", $"Weekend budget: ${result.SafePerDay:F0}. Don't push it."),
                    _                  => ("SmartSpend", "Today is tight — be careful."),
                };
            }

            foreach (var sub in user.Subscriptions)
            {
                var ok = await pushService.SendAsync(sub, title, body);
                if (!ok) deadSubs.Add(sub.Id);
            }
        }

        if (deadSubs.Count > 0)
        {
            db.Subscriptions.RemoveRange(db.Subscriptions.Where(s => deadSubs.Contains(s.Id)));
            await db.SaveChangesAsync(ct);
        }

        logger.LogInformation("Daily push complete — {Count} users notified.", users.Count);
    }
}
