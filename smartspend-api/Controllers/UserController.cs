using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/user")]
[Authorize]
public class UserController(AppDbContext db) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private static readonly HashSet<string> Frequencies = ["Weekly", "Biweekly", "Monthly", "Irregular"];

    public record UpdateRequest(
        double?   Balance,
        DateTime? NextPayday,
        string?   PayFrequency,
        bool?     OnboardingCompleted
    );

    [HttpGet("profile")]
    public async Task<IActionResult> Profile()
    {
        var user = await db.Users.Include(u => u.Streak).FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        return Ok(Map(user));
    }

    [HttpPut("profile")]
    public async Task<IActionResult> Update([FromBody] UpdateRequest req)
    {
        var user = await db.Users.Include(u => u.Streak).FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();

        var nextBalance = req.Balance ?? user.Balance;
        var nextPayday = req.NextPayday ?? user.NextPayday;
        var nextFrequency = req.PayFrequency ?? user.PayFrequency;
        var onboardingCompleted = req.OnboardingCompleted ?? user.OnboardingCompleted;

        if (double.IsNaN(nextBalance) || double.IsInfinity(nextBalance) || nextBalance < 0)
            return BadRequest(new { error = "Balance must be $0 or more." });

        if (!Frequencies.Contains(nextFrequency))
            return BadRequest(new { error = "Choose a valid pay cycle." });

        if (onboardingCompleted && !nextPayday.HasValue)
            return BadRequest(new { error = "Choose a future payday." });

        if (nextPayday.HasValue && (nextPayday.Value.Date - DateTime.UtcNow.Date).Days <= 0)
            return BadRequest(new { error = "Choose a future payday." });

        user.Balance = nextBalance;
        user.NextPayday = nextPayday;
        user.PayFrequency = nextFrequency;
        if (req.OnboardingCompleted.HasValue) user.OnboardingCompleted = req.OnboardingCompleted.Value;
        user.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(Map(user));
    }

    private static object Map(Models.User u) => new
    {
        u.Id, u.Email, u.Balance, u.NextPayday,
        u.PayFrequency, u.OnboardingCompleted, u.CreatedAt,
        streak = u.Streak is null ? null : new { u.Streak.CurrentStreak, u.Streak.LastUpdated },
    };
}
