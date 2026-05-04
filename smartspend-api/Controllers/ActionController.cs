using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/action")]
[Authorize]
public class ActionController(AppDbContext db, PushService push) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record ActionRequest(double Amount, bool Spent, bool SendPush = true, string? RequestId = null);

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

    // ── Record a spending decision ──────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> RecordAction([FromBody] ActionRequest req)
    {
        if (req.Amount <= 0 || double.IsNaN(req.Amount) || double.IsInfinity(req.Amount))
            return BadRequest(new { error = "Amount must be positive." });

        // Idempotency: if this requestId was already processed, return the cached result
        if (!string.IsNullOrWhiteSpace(req.RequestId))
        {
            var existing = await db.ActionRecords
                .Where(a => a.UserId == Uid && a.RequestId == req.RequestId)
                .FirstOrDefaultAsync();

            if (existing is not null)
                return Ok(new
                {
                    spent          = existing.Spent,
                    decision       = existing.Decision,
                    newBalance     = existing.BalanceAfter,
                    newSafePerDay  = existing.BalanceAfter / Math.Max(1, existing.StreakAfter),
                    daysLeft       = (int)Math.Max(1, existing.StreakAfter),
                    currentStreak  = existing.StreakAfter,
                    confidenceMessage = ConfidenceFor(existing.StreakAfter),
                    streakIncreased = !existing.Spent,
                    idempotent      = true,
                });
        }

        var user = await db.Users
            .Include(u => u.Streak)
            .Include(u => u.Subscriptions)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        if (user.Balance < 0) return BadRequest(new { error = "Balance cannot be negative." });
        if (!user.NextPayday.HasValue) return BadRequest(new { error = "Complete onboarding first." });

        var rawDaysLeft = (user.NextPayday.Value.Date - DateTime.UtcNow.Date).Days;
        if (rawDaysLeft <= 0) return BadRequest(new { error = "Your payday has passed. Update it." });

        var daysLeft   = Math.Max(1, rawDaysLeft);
        var safePerDay = user.Balance / daysLeft;
        var decision   = DecisionFor(user.Balance, safePerDay, req.Amount);

        user.Streak ??= new Streak { UserId = user.Id, CurrentStreak = 0 };
        var goodRestraint = !req.Spent && (decision == "WAIT" || decision == "NO");
        var balanceBefore = user.Balance;

        if (req.Spent)
        {
            user.Streak.CurrentStreak = 0;
            user.Streak.LastUpdated   = DateTime.UtcNow;
        }
        else if (goodRestraint)
        {
            user.Streak.CurrentStreak++;
            user.Streak.LastUpdated = DateTime.UtcNow;
        }

        if (req.Spent)
        {
            user.Balance   = Math.Max(0, user.Balance - req.Amount);
            user.UpdatedAt = DateTime.UtcNow;

            var newSafePerDay = user.Balance / daysLeft;

            // Persist the record before sending push (push can fail independently)
            db.ActionRecords.Add(new ActionRecord
            {
                UserId        = Uid,
                RequestId     = req.RequestId,
                Amount        = req.Amount,
                Spent         = true,
                Decision      = decision,
                BalanceBefore = balanceBefore,
                BalanceAfter  = user.Balance,
                SafePerDay    = safePerDay,
                StreakAfter   = user.Streak.CurrentStreak,
            });
            await db.SaveChangesAsync();

            if (req.SendPush)
            {
                var avoidDays = safePerDay > 0
                    ? (int)Math.Ceiling(Math.Min(req.Amount / safePerDay, daysLeft))
                    : 1;
                avoidDays = Math.Max(1, avoidDays);
                var body = avoidDays <= 1
                    ? $"Off track. Keep under ${newSafePerDay:F0}/day to recover."
                    : $"Off track. Keep under ${newSafePerDay:F0}/day for the next {avoidDays} days.";

                var dead = new List<int>();
                foreach (var sub in user.Subscriptions)
                {
                    var ok = await push.SendAsync(sub, "SmartSpend", body);
                    if (!ok) dead.Add(sub.Id);
                }
                if (dead.Count > 0)
                {
                    db.Subscriptions.RemoveRange(db.Subscriptions.Where(s => dead.Contains(s.Id)));
                    await db.SaveChangesAsync();
                }
            }

            return Ok(new
            {
                spent             = true,
                decision,
                newBalance        = user.Balance,
                newSafePerDay,
                daysLeft,
                currentStreak     = user.Streak.CurrentStreak,
                confidenceMessage = ConfidenceFor(user.Streak.CurrentStreak),
            });
        }
        else
        {
            db.ActionRecords.Add(new ActionRecord
            {
                UserId        = Uid,
                RequestId     = req.RequestId,
                Amount        = req.Amount,
                Spent         = false,
                Decision      = decision,
                BalanceBefore = balanceBefore,
                BalanceAfter  = user.Balance,
                SafePerDay    = safePerDay,
                StreakAfter   = user.Streak.CurrentStreak,
            });

            if (req.SendPush && goodRestraint)
            {
                var streak = user.Streak.CurrentStreak;
                var body = streak >= 5
                    ? $"Day {streak} — this is becoming a habit."
                    : streak >= 2
                        ? $"Day {streak} — you're getting better at this."
                        : "Good call. That took discipline.";

                foreach (var sub in user.Subscriptions)
                    await push.SendAsync(sub, "SmartSpend", body);
            }

            await db.SaveChangesAsync();

            return Ok(new
            {
                spent             = false,
                decision,
                newBalance        = user.Balance,
                newSafePerDay     = safePerDay,
                daysLeft,
                currentStreak     = user.Streak.CurrentStreak,
                confidenceMessage = ConfidenceFor(user.Streak.CurrentStreak),
                streakIncreased   = goodRestraint,
            });
        }
    }

    // ── Spending history ────────────────────────────────────────────────────
    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 50);

        var records = await db.ActionRecords
            .Where(a => a.UserId == Uid)
            .OrderByDescending(a => a.CreatedAt)
            .Take(limit)
            .Select(a => new
            {
                a.Id,
                a.Amount,
                a.Spent,
                a.Decision,
                a.BalanceBefore,
                a.BalanceAfter,
                a.SafePerDay,
                a.StreakAfter,
                a.CreatedAt,
            })
            .ToListAsync();

        return Ok(records);
    }
}
