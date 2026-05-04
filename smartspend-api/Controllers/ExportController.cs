using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Globalization;
using System.Security.Claims;
using System.Text;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/export")]
[Authorize]
public class ExportController(AppDbContext db, FinancePlanService plans) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet("actions.csv")]
    public async Task<IActionResult> ActionsCsv()
    {
        var user = await db.Users
            .Include(u => u.FinancePlan)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);

        var records = await db.ActionRecords
            .Include(a => a.User)
            .Where(a => a.FinancePlanId == plan.Id || (a.FinancePlanId == null && a.UserId == Uid))
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(HttpContext.RequestAborted);

        var csv = new StringBuilder();
        csv.AppendLine("date,email,pot,amount,spent,decision,tag,balance_before,balance_after,safe_per_day,streak_after");

        foreach (var record in records)
        {
            var cells = new[]
            {
                record.CreatedAt.ToString("o"),
                record.User.Email,
                record.Pot,
                record.Amount.ToString("0.##", CultureInfo.InvariantCulture),
                record.Spent ? "yes" : "no",
                record.Decision,
                record.Tag ?? "",
                record.BalanceBefore.ToString("0.##", CultureInfo.InvariantCulture),
                record.BalanceAfter.ToString("0.##", CultureInfo.InvariantCulture),
                record.SafePerDay.ToString("0.##", CultureInfo.InvariantCulture),
                record.StreakAfter.ToString(),
            };

            csv.AppendLine(string.Join(",", cells.Select(Escape)));
        }

        return File(
            Encoding.UTF8.GetBytes(csv.ToString()),
            "text/csv",
            $"smartspend-actions-{DateTime.UtcNow:yyyyMMdd}.csv");
    }

    private static string Escape(string value)
    {
        if (!value.Contains(',') && !value.Contains('"') && !value.Contains('\n') && !value.Contains('\r'))
            return value;

        return $"\"{value.Replace("\"", "\"\"")}\"";
    }
}
