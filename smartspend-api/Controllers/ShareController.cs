using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/share")]
[Authorize]
public class ShareController(AppDbContext db, FinancePlanService plans) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record JoinRequest(string Code);

    [HttpPost("join")]
    public async Task<IActionResult> Join([FromBody] JoinRequest req)
    {
        var code = (req.Code ?? "").Trim().Replace(" ", "").ToUpperInvariant();
        if (code.Length < 6)
            return BadRequest(new { error = "Enter a valid share code." });

        var user = await db.Users
            .Include(u => u.Streak)
            .Include(u => u.RecurringExpenses)
            .Include(u => u.FinancePlan)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();

        var currentPlan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);
        var target = await db.FinancePlans
            .Include(p => p.Users)
            .Include(p => p.RecurringExpenses)
            .FirstOrDefaultAsync(p => p.ShareCode == code);

        if (target is null)
            return NotFound(new { error = "Share code not found." });

        if (target.Id != currentPlan.Id)
        {
            user.FinancePlanId = target.Id;
            user.FinancePlan = target;
            user.Balance = FinancePlanService.BalanceFor(target);
            user.NextPayday = target.NextPayday;
            user.PayFrequency = target.PayFrequency;
            user.OnboardingCompleted = target.OnboardingCompleted;
            user.UpdatedAt = DateTime.UtcNow;

            if (target.Users.All(u => u.Id != user.Id))
            {
                target.Users.Add(user);
            }

            await db.SaveChangesAsync();
        }

        return Ok(UserController.Map(user, target));
    }
}
