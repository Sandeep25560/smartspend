using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;

namespace SmartSpend.Api.BackgroundServices;

public class EveningNudgeService(IServiceScopeFactory scopeFactory, ILogger<EveningNudgeService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            var now  = DateTime.Now;
            var next = now.Hour < 19
                ? now.Date.AddHours(19)
                : now.Date.AddDays(1).AddHours(19);

            logger.LogInformation("Next evening nudge scheduled at {Time}.", next);
            await Task.Delay(next - now, stoppingToken);

            if (!stoppingToken.IsCancellationRequested)
                await SendEveningBatchAsync(stoppingToken);
        }
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

        var isWeekend = DateTime.Now.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday;
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
            logger.LogInformation("Removed {Count} expired subscriptions.", deadSubs.Count);
        }

        logger.LogInformation("Evening nudge batch complete — {Count} users notified.", users.Count);
    }
}
