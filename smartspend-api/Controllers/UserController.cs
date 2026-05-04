using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/user")]
[Authorize]
public class UserController(AppDbContext db, FinancePlanService plans) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private static readonly HashSet<string> Frequencies = ["Weekly", "Biweekly", "Monthly", "Irregular"];

    public record UpdateRequest(
        double?   Balance,
        double?   CashBalance,
        double?   CardBalance,
        string?   ActivePot,
        DateTime? NextPayday,
        string?   PayFrequency,
        bool?     OnboardingCompleted
    );

    [HttpGet("profile")]
    public async Task<IActionResult> Profile()
    {
        var user = await db.Users
            .Include(u => u.Streak)
            .Include(u => u.RecurringExpenses)
            .Include(u => u.FinancePlan).ThenInclude(p => p!.Users)
            .Include(u => u.FinancePlan).ThenInclude(p => p!.RecurringExpenses)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user);
        return Ok(Map(user, plan));
    }

    [HttpPut("profile")]
    public async Task<IActionResult> Update([FromBody] UpdateRequest req)
    {
        var user = await db.Users
            .Include(u => u.Streak)
            .Include(u => u.RecurringExpenses)
            .Include(u => u.FinancePlan).ThenInclude(p => p!.Users)
            .Include(u => u.FinancePlan).ThenInclude(p => p!.RecurringExpenses)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();

        var plan = await plans.EnsurePlanAsync(user);
        var activePot = FinancePlanService.NormalizePot(req.ActivePot ?? plan.ActivePot);
        var nextCashBalance = req.CashBalance ?? plan.CashBalance;
        var nextCardBalance = req.CardBalance ?? plan.CardBalance;

        if (req.Balance.HasValue && !req.CashBalance.HasValue && !req.CardBalance.HasValue)
        {
            if (activePot == "cash") nextCashBalance = req.Balance.Value;
            else nextCardBalance = req.Balance.Value;
        }

        var nextPayday = req.NextPayday ?? plan.NextPayday;
        var nextFrequency = req.PayFrequency ?? plan.PayFrequency;
        var onboardingCompleted = req.OnboardingCompleted ?? plan.OnboardingCompleted;

        if (double.IsNaN(nextCashBalance) || double.IsInfinity(nextCashBalance) || nextCashBalance < 0
            || double.IsNaN(nextCardBalance) || double.IsInfinity(nextCardBalance) || nextCardBalance < 0)
            return BadRequest(new { error = "Balance must be $0 or more." });

        if (!Frequencies.Contains(nextFrequency))
            return BadRequest(new { error = "Choose a valid pay cycle." });

        if (onboardingCompleted && !nextPayday.HasValue)
            return BadRequest(new { error = "Choose a future payday." });

        if (nextPayday.HasValue && (nextPayday.Value.Date - DateTime.UtcNow.Date).Days <= 0)
            return BadRequest(new { error = "Choose a future payday." });

        plan.CashBalance = nextCashBalance;
        plan.CardBalance = nextCardBalance;
        plan.ActivePot = activePot;
        plan.NextPayday = nextPayday;
        plan.PayFrequency = nextFrequency;
        if (req.OnboardingCompleted.HasValue) plan.OnboardingCompleted = req.OnboardingCompleted.Value;
        plan.UpdatedAt = DateTime.UtcNow;

        user.Balance = FinancePlanService.BalanceFor(plan);
        user.NextPayday = plan.NextPayday;
        user.PayFrequency = plan.PayFrequency;
        user.OnboardingCompleted = plan.OnboardingCompleted;
        user.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();
        return Ok(Map(user, plan));
    }

    public static object Map(Models.User u, Models.FinancePlan plan)
    {
        return new
        {
            u.Id,
            u.Email,
            Balance = FinancePlanService.BalanceFor(plan),
            CashBalance = plan.CashBalance,
            CardBalance = plan.CardBalance,
            TotalBalance = plan.CashBalance + plan.CardBalance,
            ActivePot = FinancePlanService.NormalizePot(plan.ActivePot),
            NextPayday = plan.NextPayday,
            PayFrequency = plan.PayFrequency,
            OnboardingCompleted = plan.OnboardingCompleted,
            u.CreatedAt,
            ShareCode = plan.ShareCode,
            SharedMemberCount = Math.Max(1, plan.Users.Count),
            IsShared = plan.Users.Count > 1,
            streak = u.Streak is null ? null : new { u.Streak.CurrentStreak, u.Streak.LastUpdated },
            upcomingExpensesTotal = BudgetMath.UpcomingExpensesTotal(plan.RecurringExpenses, plan.NextPayday),
        };
    }
}
