using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/action")]
[Authorize]
public class ActionController(AppDbContext db, ActionRecorder recorder, FinancePlanService plans) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record ActionRequest(double Amount, bool Spent, bool SendPush = true, string? RequestId = null, string? Tag = null, string? Pot = null);
    public record TagRequest(string? Tag);

    [HttpPost]
    public async Task<IActionResult> RecordAction([FromBody] ActionRequest req)
    {
        try
        {
            var result = await recorder.RecordAsync(
                Uid,
                req.Amount,
                req.Spent,
                req.SendPush,
                req.RequestId,
                req.Tag,
                req.Pot,
                HttpContext.RequestAborted);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("history")]
    public async Task<IActionResult> GetHistory([FromQuery] int limit = 20)
    {
        limit = Math.Clamp(limit, 1, 50);

        var user = await db.Users
            .Include(u => u.FinancePlan)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);

        var records = await db.ActionRecords
            .Where(a => a.FinancePlanId == plan.Id || (a.FinancePlanId == null && a.UserId == Uid))
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
                a.Tag,
                a.Pot,
                a.CreatedAt,
            })
            .ToListAsync();

        return Ok(records);
    }

    [HttpPatch("{id:guid}/tag")]
    public async Task<IActionResult> UpdateTag(Guid id, [FromBody] TagRequest req)
    {
        var user = await db.Users
            .Include(u => u.FinancePlan)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);

        var record = await db.ActionRecords
            .FirstOrDefaultAsync(a => a.Id == id && (a.UserId == Uid || a.FinancePlanId == plan.Id));
        if (record is null) return NotFound();

        var clean = req.Tag?.Trim();
        record.Tag = string.IsNullOrWhiteSpace(clean) ? null : clean[..Math.Min(clean.Length, 30)];
        await db.SaveChangesAsync();
        return Ok(new { record.Id, record.Tag });
    }
}
