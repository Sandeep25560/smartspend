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

    public record ActionRequest(double Amount, bool Spent, bool SendPush = true);

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

    [HttpPost]
    public async Task<IActionResult> RecordAction([FromBody] ActionRequest req)
    {
        if (req.Amount <= 0 || double.IsNaN(req.Amount) || double.IsInfinity(req.Amount))
            return BadRequest(new { error = "Amount must be positive." });

        var user = await db.Users
            .Include(u => u.Streak)
            .Include(u => u.Subscriptions)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        if (user.Balance < 0) return BadRequest(new { error = "Balance cannot be negative." });
        if (!user.NextPayday.HasValue) return BadRequest(new { error = "Complete onboarding first." });

        var rawDaysLeft = (user.NextPayday.Value.Date - DateTime.UtcNow.Date).Days;
        if (rawDaysLeft <= 0) return BadRequest(new { error = "Your payday has passed. Update it." });

        var daysLeft = Math.Max(1, rawDaysLeft);
        var safePerDay = user.Balance / daysLeft;
        var decision = DecisionFor(user.Balance, safePerDay, req.Amount);

        user.Streak ??= new Streak { UserId = user.Id, CurrentStreak = 0 };
        var goodRestraint = !req.Spent && (decision == "WAIT" || decision == "NO");

        if (req.Spent)
        {
            user.Streak.CurrentStreak = 0;
            user.Streak.LastUpdated = DateTime.UtcNow;
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
            await db.SaveChangesAsync();

            var newSafePerDay = user.Balance / daysLeft;

            if (req.SendPush)
            {
                var dead = new List<int>();
                foreach (var sub in user.Subscriptions)
                {
                    var ok = await push.SendAsync(sub, "Update", $"You're off track. New safe: ${newSafePerDay:F0}/day");
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
                spent = true,
                decision,
                newBalance = user.Balance,
                newSafePerDay,
                daysLeft,
                currentStreak = user.Streak.CurrentStreak,
                confidenceMessage = ConfidenceFor(user.Streak.CurrentStreak),
            });
        }
        else
        {
            if (req.SendPush)
            {
                foreach (var sub in user.Subscriptions)
                    await push.SendAsync(sub, "Good call", "You stayed on track");
            }

            await db.SaveChangesAsync();

            return Ok(new
            {
                spent = false,
                decision,
                newBalance = user.Balance,
                newSafePerDay = safePerDay,
                daysLeft,
                currentStreak = user.Streak.CurrentStreak,
                confidenceMessage = ConfidenceFor(user.Streak.CurrentStreak),
                streakIncreased = goodRestraint,
            });
        }
    }
}
