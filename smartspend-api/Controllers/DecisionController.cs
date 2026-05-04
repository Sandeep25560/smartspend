using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/decision")]
[Authorize]
public class DecisionController(AppDbContext db, DecisionService svc, FinancePlanService plans) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record CheckRequest(double Amount);

    [HttpPost("check")]
    public async Task<IActionResult> Check([FromBody] CheckRequest req)
    {
        if (req.Amount <= 0 || double.IsNaN(req.Amount) || double.IsInfinity(req.Amount))
            return BadRequest(new { error = "Amount must be positive." });

        var user = await db.Users
            .Include(u => u.RecurringExpenses)
            .Include(u => u.FinancePlan).ThenInclude(p => p!.RecurringExpenses)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);
        var balance = FinancePlanService.BalanceFor(plan);

        if (!plan.NextPayday.HasValue)
            return BadRequest(new { error = "Complete onboarding first." });
        if (balance < 0)
            return BadRequest(new { error = "Balance cannot be negative." });
        if ((plan.NextPayday.Value.Date - DateTime.UtcNow.Date).Days <= 0)
            return BadRequest(new { error = "Your payday has passed. Update it." });

        var upcomingExpenses = BudgetMath.UpcomingExpensesTotal(plan.RecurringExpenses, plan.NextPayday);
        var r = svc.Evaluate(balance, plan.NextPayday.Value, req.Amount, upcomingExpenses);

        return Ok(new
        {
            r.Status,
            r.Message,
            r.SafePerDay,
            r.DaysLeft,
            r.Balance,
            UpcomingExpensesTotal = upcomingExpenses,
            r.ImpactDays,
            action = r.Status switch
            {
                "STOP"    => "Try a lower amount or skip this purchase.",
                "CAREFUL" => "Consider if this is truly necessary right now.",
                _         => "You're good to go.",
            },
        });
    }
}
