using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;

namespace SmartSpend.Api.BackgroundServices;

public class DailyNotificationService(IServiceScopeFactory scopeFactory, ILogger<DailyNotificationService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now  = DateTime.Now;
            var next = now.Hour < 8
                ? now.Date.AddHours(8)
                : now.Date.AddDays(1).AddHours(8);

            logger.LogInformation("Next push batch scheduled at {Time}.", next);
            await Task.Delay(next - now, stoppingToken);

            if (!stoppingToken.IsCancellationRequested)
                await SendDailyBatchAsync(stoppingToken);
        }
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

        var deadSubs = new List<int>();

        foreach (var user in users)
        {
            if (!user.NextPayday.HasValue) continue;
            var result    = decisionService.DailyStatus(user.Balance, user.NextPayday.Value);
            var isWeekend = DateTime.Now.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
            var (title, body) = (result.Status, isWeekend) switch
            {
                ("SAFE",    true)  => ("SmartSpend", $"Weekends get expensive. Stay under ${result.SafePerDay:F0} today."),
                ("SAFE",    false) => ("SmartSpend", $"You can spend ${result.SafePerDay:F0} today"),
                ("CAREFUL", true)  => ("SmartSpend", $"Weekend budget: ${result.SafePerDay:F0}. Don't push it."),
                _                  => ("SmartSpend", "Today is tight — be careful"),
            };

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
            logger.LogInformation("Removed {Count} expired subscriptions.", deadSubs.Count);
        }

        logger.LogInformation("Daily push batch complete — {Count} users notified.", users.Count);
    }
}
