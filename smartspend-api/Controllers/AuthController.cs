using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, AuthService auth) : ControllerBase
{
    public record SignupRequest(string Email, string Password);
    public record LoginRequest(string Email, string Password);

    [HttpPost("signup")]
    public async Task<IActionResult> Signup([FromBody] SignupRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        if (req.Password.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });

        var email = req.Email.ToLower().Trim();
        if (await db.Users.AnyAsync(u => u.Email == email))
            return BadRequest(new { error = "An account with this email already exists." });

        var user = new User
        {
            Email        = email,
            PasswordHash = auth.HashPassword(req.Password),
        };

        var streak = new Streak { UserId = user.Id, CurrentStreak = 0 };
        db.Users.Add(user);
        db.Streaks.Add(streak);
        await db.SaveChangesAsync();

        return Ok(new { token = auth.GenerateToken(user), user = Map(user, streak) });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        var email = req.Email?.ToLower().Trim() ?? "";
        var user  = await db.Users
            .Include(u => u.Streak)
            .FirstOrDefaultAsync(u => u.Email == email);

        if (user is null || !auth.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid email or password." });

        return Ok(new { token = auth.GenerateToken(user), user = Map(user, user.Streak) });
    }

    private static object Map(User u, Streak? s) => new
    {
        u.Id, u.Email, u.Balance, u.NextPayday,
        u.PayFrequency, u.OnboardingCompleted,
        streak = s is null ? null : new { s.CurrentStreak, s.LastUpdated },
    };
}
