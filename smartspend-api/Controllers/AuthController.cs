using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, AuthService auth, EmailService email) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record SignupRequest(string Email, string Password);
    public record LoginRequest(string Email, string Password);
    public record RefreshRequest(string RefreshToken);
    public record ForgotRequest(string Email);
    public record ResetRequest(string Token, string Password);

    // ── Sign up ──────────────────────────────────────────────────────────
    [HttpPost("signup")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Signup([FromBody] SignupRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        if (req.Password.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });

        var emailNorm = req.Email.ToLower().Trim();
        if (await db.Users.AnyAsync(u => u.Email == emailNorm))
            return BadRequest(new { error = "An account with this email already exists." });

        var user   = new User { Email = emailNorm, PasswordHash = auth.HashPassword(req.Password) };
        var streak = new Streak { UserId = user.Id, CurrentStreak = 0 };
        var rt     = auth.GenerateRefreshToken(user.Id);

        db.Users.Add(user);
        db.Streaks.Add(streak);
        db.RefreshTokens.Add(rt);
        await db.SaveChangesAsync();

        return Ok(new
        {
            token        = auth.GenerateAccessToken(user),
            refreshToken = rt.Token,
            user         = Map(user, streak),
        });
    }

    // ── Login ─────────────────────────────────────────────────────────────
    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Email) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Email and password are required." });

        var emailNorm = req.Email.ToLower().Trim();
        var user = await db.Users
            .Include(u => u.Streak)
            .FirstOrDefaultAsync(u => u.Email == emailNorm);

        if (user is null || !auth.VerifyPassword(req.Password, user.PasswordHash))
            return Unauthorized(new { error = "Invalid email or password." });

        // Revoke all old refresh tokens for this user (single-session)
        var oldTokens = db.RefreshTokens.Where(r => r.UserId == user.Id && r.RevokedAt == null);
        await oldTokens.ForEachAsync(r => r.RevokedAt = DateTime.UtcNow);

        var rt = auth.GenerateRefreshToken(user.Id);
        db.RefreshTokens.Add(rt);
        await db.SaveChangesAsync();

        return Ok(new
        {
            token        = auth.GenerateAccessToken(user),
            refreshToken = rt.Token,
            user         = Map(user, user.Streak),
        });
    }

    // ── Refresh access token ──────────────────────────────────────────────
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh([FromBody] RefreshRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.RefreshToken))
            return BadRequest(new { error = "Refresh token is required." });

        var stored = await db.RefreshTokens
            .Include(r => r.User).ThenInclude(u => u.Streak)
            .FirstOrDefaultAsync(r => r.Token == req.RefreshToken);

        if (stored is null || !stored.IsActive)
            return Unauthorized(new { error = "Session expired. Please sign in again." });

        // Rotate: revoke old, issue new
        stored.RevokedAt = DateTime.UtcNow;
        var newRt = auth.GenerateRefreshToken(stored.UserId);
        db.RefreshTokens.Add(newRt);
        await db.SaveChangesAsync();

        return Ok(new
        {
            token        = auth.GenerateAccessToken(stored.User),
            refreshToken = newRt.Token,
            user         = Map(stored.User, stored.User.Streak),
        });
    }

    // ── Logout (revoke refresh token) ─────────────────────────────────────
    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromBody] RefreshRequest req)
    {
        if (!string.IsNullOrWhiteSpace(req.RefreshToken))
        {
            var stored = await db.RefreshTokens
                .FirstOrDefaultAsync(r => r.Token == req.RefreshToken);
            if (stored is not null)
            {
                stored.RevokedAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }
        }

        return Ok(new { message = "Signed out." });
    }

    // ── Forgot password ───────────────────────────────────────────────────
    [HttpPost("forgot")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotRequest req)
    {
        // Always return 200 — don't reveal whether the email exists
        if (string.IsNullOrWhiteSpace(req.Email))
            return Ok(new { message = "If that email is registered, you'll receive a reset link." });

        var emailNorm = req.Email.ToLower().Trim();
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == emailNorm);

        if (user is not null)
        {
            // Invalidate any existing tokens for this user
            var existing = db.PasswordResetTokens.Where(t => t.UserId == user.Id && !t.Used);
            await existing.ForEachAsync(t => t.Used = true);

            var resetToken = new PasswordResetToken
            {
                UserId    = user.Id,
                Token     = auth.GenerateResetToken(),
                ExpiresAt = DateTime.UtcNow.AddHours(1),
            };
            db.PasswordResetTokens.Add(resetToken);
            await db.SaveChangesAsync();

            await email.SendPasswordResetAsync(user.Email, resetToken.Token);
        }

        return Ok(new { message = "If that email is registered, you'll receive a reset link." });
    }

    // ── Reset password ─────────────────────────────────────────────────────
    [HttpPost("reset")]
    [EnableRateLimiting("auth")]
    public async Task<IActionResult> ResetPassword([FromBody] ResetRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token) || string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { error = "Token and new password are required." });

        if (req.Password.Length < 6)
            return BadRequest(new { error = "Password must be at least 6 characters." });

        var stored = await db.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.Token == req.Token && !t.Used);

        if (stored is null || stored.ExpiresAt < DateTime.UtcNow)
            return BadRequest(new { error = "This reset link is invalid or has expired." });

        stored.Used               = true;
        stored.User.PasswordHash  = auth.HashPassword(req.Password);
        stored.User.UpdatedAt     = DateTime.UtcNow;

        // Revoke all refresh tokens so other sessions are invalidated
        var rts = db.RefreshTokens.Where(r => r.UserId == stored.UserId && r.RevokedAt == null);
        await rts.ForEachAsync(r => r.RevokedAt = DateTime.UtcNow);

        await db.SaveChangesAsync();

        return Ok(new { message = "Password updated. You can now sign in." });
    }

    // ── Delete account ─────────────────────────────────────────────────────
    [HttpDelete("account")]
    [Authorize]
    public async Task<IActionResult> DeleteAccount()
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();

        db.Users.Remove(user); // cascade deletes all related rows
        await db.SaveChangesAsync();

        return Ok(new { message = "Account deleted." });
    }

    private static object Map(User u, Streak? s) => new
    {
        u.Id, u.Email, u.Balance, u.NextPayday,
        u.PayFrequency, u.OnboardingCompleted,
        streak = s is null ? null : new { s.CurrentStreak, s.LastUpdated },
    };
}
