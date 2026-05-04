using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/streak")]
[Authorize]
public class StreakController(AppDbContext db) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var streak = await db.Streaks.FirstOrDefaultAsync(s => s.UserId == Uid);
        return Ok(new
        {
            currentStreak = streak?.CurrentStreak ?? 0,
            lastUpdated   = streak?.LastUpdated,
        });
    }
}
