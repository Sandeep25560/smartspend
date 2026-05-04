using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;

namespace SmartSpend.Api.BackgroundServices;

public class PendingDecisionPromptService(
    IServiceScopeFactory scopeFactory,
    ILogger<PendingDecisionPromptService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SendDuePromptsAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Pending decision prompt scan failed.");
            }

            await Task.Delay(TimeSpan.FromSeconds(4), stoppingToken);
        }
    }

    private async Task SendDuePromptsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var push = scope.ServiceProvider.GetRequiredService<PushService>();
        var now = DateTime.UtcNow;

        var prompts = await db.PendingDecisionPrompts
            .Include(p => p.User)
                .ThenInclude(u => u.Subscriptions)
            .Where(p => p.RespondedAt == null && p.SentAt == null && p.DueAt <= now && p.ExpiresAt > now)
            .OrderBy(p => p.DueAt)
            .Take(25)
            .ToListAsync(ct);

        foreach (var prompt in prompts)
        {
            var alreadyRecorded = await db.ActionRecords
                .AnyAsync(a => a.UserId == prompt.UserId && a.RequestId == prompt.RequestId, ct);

            if (alreadyRecorded)
            {
                prompt.RespondedAt = now;
                continue;
            }

            if (prompt.User.Subscriptions.Count == 0)
            {
                prompt.SentAt = now;
                continue;
            }

            var dead = new List<int>();
            var sent = 0;
            foreach (var sub in prompt.User.Subscriptions)
            {
                var ok = await push.SendDecisionPromptAsync(sub, prompt.Amount, prompt.Token, prompt.ApiBase);
                if (ok) sent++; else dead.Add(sub.Id);
            }

            prompt.SentAt = now;

            if (dead.Count > 0)
            {
                db.Subscriptions.RemoveRange(db.Subscriptions.Where(s => dead.Contains(s.Id)));
            }

            logger.LogInformation("Decision prompt sent for user {UserId}: {Sent} subscription(s).", prompt.UserId, sent);
        }

        if (prompts.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}
