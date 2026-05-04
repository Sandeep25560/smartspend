using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;

namespace SmartSpend.Api.Services;

public record ActionRecordResult(
    Guid Id,
    string? Tag,
    string Pot,
    bool Spent,
    string Decision,
    double NewBalance,
    double NewSafePerDay,
    int DaysLeft,
    int CurrentStreak,
    string? ConfidenceMessage,
    bool StreakIncreased,
    bool Idempotent = false
);

public class ActionRecorder(AppDbContext db, PushService push, FinancePlanService plans)
{
    private static string DecisionFor(double balance, double safePerDay, double amount)
    {
        if (amount > balance) return "NO";
        if (amount > safePerDay * 1.3) return "NO";
        if (amount > safePerDay) return "WAIT";
        return "YES";
    }

    private static string? ConfidenceFor(int streak)
    {
        if (streak >= 5) return "This is becoming a habit.";
        if (streak >= 2) return "You're getting better at this.";
        return null;
    }

    private static string? CleanTag(string? tag)
    {
        var clean = tag?.Trim();
        return string.IsNullOrWhiteSpace(clean) ? null : clean[..Math.Min(clean.Length, 30)];
    }

    public async Task<ActionRecordResult> RecordAsync(
        Guid userId,
        double amount,
        bool spent,
        bool sendPush = false,
        string? requestId = null,
        string? tag = null,
        string? pot = null,
        CancellationToken ct = default)
    {
        if (amount <= 0 || double.IsNaN(amount) || double.IsInfinity(amount))
            throw new ArgumentException("Amount must be positive.", nameof(amount));

        if (!string.IsNullOrWhiteSpace(requestId))
        {
            var existing = await db.ActionRecords
                .Where(a => a.UserId == userId && a.RequestId == requestId)
                .FirstOrDefaultAsync(ct);

            if (existing is not null)
            {
                var replayDaysLeft = existing.SafePerDay > 0
                    ? Math.Max(1, (int)Math.Round(existing.BalanceBefore / existing.SafePerDay))
                    : 1;

                return new ActionRecordResult(
                    existing.Id,
                    existing.Tag,
                    existing.Pot,
                    existing.Spent,
                    existing.Decision,
                    existing.BalanceAfter,
                    existing.Spent ? Math.Max(0, existing.BalanceAfter) / replayDaysLeft : existing.SafePerDay,
                    replayDaysLeft,
                    existing.StreakAfter,
                    ConfidenceFor(existing.StreakAfter),
                    !existing.Spent && (existing.Decision == "WAIT" || existing.Decision == "NO"),
                    Idempotent: true
                );
            }
        }

        var user = await db.Users
            .Include(u => u.Streak)
            .Include(u => u.Subscriptions)
            .Include(u => u.RecurringExpenses)
            .Include(u => u.FinancePlan).ThenInclude(p => p!.RecurringExpenses)
            .FirstOrDefaultAsync(u => u.Id == userId, ct);

        if (user is null) throw new InvalidOperationException("User not found.");
        var plan = await plans.EnsurePlanAsync(user, ct);
        var activePot = FinancePlanService.NormalizePot(pot ?? plan.ActivePot);
        var balance = FinancePlanService.BalanceFor(plan, activePot);

        if (balance < 0) throw new InvalidOperationException("Balance cannot be negative.");
        if (!plan.NextPayday.HasValue) throw new InvalidOperationException("Complete onboarding first.");

        var rawDaysLeft = (plan.NextPayday.Value.Date - DateTime.UtcNow.Date).Days;
        if (rawDaysLeft <= 0) throw new InvalidOperationException("Your payday has passed. Update it.");

        var daysLeft = Math.Max(1, rawDaysLeft);
        var upcomingExpenses = BudgetMath.UpcomingExpensesTotal(plan.RecurringExpenses, plan.NextPayday);
        var safePerDay = Math.Max(0, balance - upcomingExpenses) / daysLeft;
        var decision = DecisionFor(balance, safePerDay, amount);
        var goodRestraint = !spent && (decision == "WAIT" || decision == "NO");
        var balanceBefore = balance;

        user.Streak ??= new Streak { UserId = user.Id, CurrentStreak = 0 };
        if (spent)
        {
            user.Streak.CurrentStreak = 0;
            user.Streak.LastUpdated = DateTime.UtcNow;
            balance = Math.Max(0, balance - amount);
            FinancePlanService.SetBalance(plan, activePot, balance);
            user.UpdatedAt = DateTime.UtcNow;
        }
        else if (goodRestraint)
        {
            user.Streak.CurrentStreak++;
            user.Streak.LastUpdated = DateTime.UtcNow;
        }

        user.Balance = FinancePlanService.BalanceFor(plan);
        user.NextPayday = plan.NextPayday;
        user.PayFrequency = plan.PayFrequency;
        user.OnboardingCompleted = plan.OnboardingCompleted;

        var newSafePerDay = Math.Max(0, balance - upcomingExpenses) / daysLeft;
        var record = new ActionRecord
        {
            UserId = userId,
            FinancePlanId = plan.Id,
            RequestId = requestId,
            Pot = activePot,
            Amount = amount,
            Spent = spent,
            Decision = decision,
            BalanceBefore = balanceBefore,
            BalanceAfter = balance,
            SafePerDay = safePerDay,
            StreakAfter = user.Streak.CurrentStreak,
            Tag = CleanTag(tag),
        };
        db.ActionRecords.Add(record);

        if (!string.IsNullOrWhiteSpace(requestId))
        {
            await db.PendingDecisionPrompts
                .Where(p => p.UserId == userId && p.RequestId == requestId && p.RespondedAt == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(p => p.RespondedAt, DateTime.UtcNow), ct);
        }

        await db.SaveChangesAsync(ct);

        if (sendPush)
        {
            await SendOutcomePushAsync(user, spent, amount, safePerDay, newSafePerDay, daysLeft, goodRestraint, ct);
        }

        return new ActionRecordResult(
            record.Id,
            record.Tag,
            record.Pot,
            spent,
            decision,
            balance,
            spent ? newSafePerDay : safePerDay,
            daysLeft,
            user.Streak.CurrentStreak,
            ConfidenceFor(user.Streak.CurrentStreak),
            goodRestraint
        );
    }

    private async Task SendOutcomePushAsync(
        User user,
        bool spent,
        double amount,
        double safePerDay,
        double newSafePerDay,
        int daysLeft,
        bool goodRestraint,
        CancellationToken ct)
    {
        if (spent)
        {
            var avoidDays = safePerDay > 0
                ? (int)Math.Ceiling(Math.Min(amount / safePerDay, daysLeft))
                : 1;
            avoidDays = Math.Max(1, avoidDays);
            var body = avoidDays <= 1
                ? $"Off track. Keep under ${newSafePerDay:F0}/day to recover."
                : $"Off track. Keep under ${newSafePerDay:F0}/day for the next {avoidDays} days.";

            await SendToSubscriptionsAsync(user, "SmartSpend", body, ct);
            return;
        }

        if (!goodRestraint) return;

        var streak = user.Streak?.CurrentStreak ?? 0;
        var appreciation = streak >= 5
            ? $"Day {streak} - this is becoming a habit."
            : streak >= 2
                ? $"Day {streak} - you're getting better at this."
                : "Good call. That took discipline.";

        await SendToSubscriptionsAsync(user, "SmartSpend", appreciation, ct);
    }

    private async Task SendToSubscriptionsAsync(User user, string title, string body, CancellationToken ct)
    {
        var dead = new List<int>();
        foreach (var sub in user.Subscriptions)
        {
            var ok = await push.SendAsync(sub, title, body);
            if (!ok) dead.Add(sub.Id);
        }

        if (dead.Count > 0)
        {
            db.Subscriptions.RemoveRange(db.Subscriptions.Where(s => dead.Contains(s.Id)));
            await db.SaveChangesAsync(ct);
        }
    }
}
