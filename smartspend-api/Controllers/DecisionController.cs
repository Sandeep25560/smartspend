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
public class DecisionController(AppDbContext db, DecisionService svc) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record CheckRequest(double Amount);

    [HttpPost("check")]
    public async Task<IActionResult> Check([FromBody] CheckRequest req)
    {
        if (req.Amount <= 0 || double.IsNaN(req.Amount) || double.IsInfinity(req.Amount))
            return BadRequest(new { error = "Amount must be positive." });

        var user = await db.Users.FindAsync(Uid);
        if (user is null) return NotFound();
        if (!user.NextPayday.HasValue)
            return BadRequest(new { error = "Complete onboarding first." });
        if (user.Balance < 0)
            return BadRequest(new { error = "Balance cannot be negative." });
        if ((user.NextPayday.Value.Date - DateTime.UtcNow.Date).Days <= 0)
            return BadRequest(new { error = "Your payday has passed. Update it." });

        var r = svc.Evaluate(user.Balance, user.NextPayday.Value, req.Amount);

        return Ok(new
        {
            r.Status,
            r.Message,
            r.SafePerDay,
            r.DaysLeft,
            r.Balance,
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
