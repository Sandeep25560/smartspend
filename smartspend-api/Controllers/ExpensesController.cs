using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/expenses")]
[Authorize]
public class ExpensesController(AppDbContext db, FinancePlanService plans) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record ExpenseRequest(string Name, double Amount, int DayOfMonth);

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var user = await db.Users
            .Include(u => u.FinancePlan)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);

        var expenses = await db.RecurringExpenses
            .Where(e => e.FinancePlanId == plan.Id || (e.FinancePlanId == null && e.UserId == Uid))
            .OrderBy(e => e.DayOfMonth)
            .Select(e => new { e.Id, e.Name, e.Amount, e.DayOfMonth })
            .ToListAsync();

        return Ok(expenses);
    }

    [HttpPost]
    public async Task<IActionResult> Add([FromBody] ExpenseRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || req.Name.Length > 50)
            return BadRequest(new { error = "Name must be 1-50 characters." });
        if (req.Amount <= 0 || double.IsNaN(req.Amount) || double.IsInfinity(req.Amount) || req.Amount > 100_000)
            return BadRequest(new { error = "Amount must be between $1 and $100,000." });
        if (req.DayOfMonth < 1 || req.DayOfMonth > 28)
            return BadRequest(new { error = "Day must be between 1 and 28." });

        var user = await db.Users
            .Include(u => u.FinancePlan)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);

        var count = await db.RecurringExpenses.CountAsync(e => e.FinancePlanId == plan.Id || (e.FinancePlanId == null && e.UserId == Uid));
        if (count >= 20)
            return BadRequest(new { error = "Maximum 20 recurring expenses." });

        var expense = new RecurringExpense
        {
            UserId = Uid,
            FinancePlanId = plan.Id,
            Name = req.Name.Trim(),
            Amount = req.Amount,
            DayOfMonth = req.DayOfMonth,
        };

        db.RecurringExpenses.Add(expense);
        await db.SaveChangesAsync();

        return Ok(new { expense.Id, expense.Name, expense.Amount, expense.DayOfMonth });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var user = await db.Users
            .Include(u => u.FinancePlan)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);

        var expense = await db.RecurringExpenses
            .FirstOrDefaultAsync(e => e.Id == id && (e.UserId == Uid || e.FinancePlanId == plan.Id));
        if (expense is null) return NotFound();

        db.RecurringExpenses.Remove(expense);
        await db.SaveChangesAsync();
        return Ok();
    }
}
