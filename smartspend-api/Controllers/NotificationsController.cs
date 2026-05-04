using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;
using System.Security.Claims;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController(AppDbContext db, VapidKeyService vapid, PushService push) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record NotifyDecisionRequest(double Amount);

    [HttpPost("decision")]
    [Authorize]
    public async Task<IActionResult> NotifyDecision([FromBody] NotifyDecisionRequest req)
    {
        if (req.Amount <= 0 || double.IsNaN(req.Amount) || double.IsInfinity(req.Amount))
            return BadRequest(new { error = "Amount must be positive." });

        var user = await db.Users
            .Include(u => u.Subscriptions)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        if (!user.Subscriptions.Any()) return Ok(new { sent = 0 });

        var token   = Request.Headers.Authorization.ToString().Replace("Bearer ", "").Trim();
        var apiBase = $"{Request.Scheme}://{Request.Host}";

        var dead = new List<int>();
        var sent = 0;
        foreach (var sub in user.Subscriptions)
        {
            var ok = await push.SendDecisionAsync(sub, req.Amount, token, apiBase);
            if (ok) sent++; else dead.Add(sub.Id);
        }

        if (dead.Count > 0)
        {
            db.Subscriptions.RemoveRange(db.Subscriptions.Where(s => dead.Contains(s.Id)));
            await db.SaveChangesAsync();
        }

        return Ok(new { sent });
    }

    [HttpGet("vapid-key")]
    public IActionResult VapidKey() => Ok(new { publicKey = vapid.PublicKey });

    public record SubscribeRequest(string Endpoint, string P256dh, string Auth);
    public record UnsubscribeRequest(string? Endpoint);

    [HttpPost("subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest req)
    {
        var exists = await db.Subscriptions.AnyAsync(s => s.UserId == Uid && s.Endpoint == req.Endpoint);
        if (!exists)
        {
            db.Subscriptions.Add(new PushSubscription
            {
                UserId   = Uid,
                Endpoint = req.Endpoint,
                P256dh   = req.P256dh,
                Auth     = req.Auth,
            });
            await db.SaveChangesAsync();
        }

        return Ok(new { message = "Subscribed" });
    }

    [HttpDelete("subscribe")]
    [Authorize]
    public async Task<IActionResult> Unsubscribe([FromBody] UnsubscribeRequest req)
    {
        var query = db.Subscriptions.Where(s => s.UserId == Uid);
        if (!string.IsNullOrWhiteSpace(req.Endpoint))
            query = query.Where(s => s.Endpoint == req.Endpoint);

        db.Subscriptions.RemoveRange(await query.ToListAsync());
        await db.SaveChangesAsync();

        return Ok(new { message = "Unsubscribed" });
    }

    [HttpPost("test")]
    [Authorize]
    public async Task<IActionResult> Test()
    {
        var subs = await db.Subscriptions.Where(s => s.UserId == Uid).ToListAsync();
        if (subs.Count == 0) return Ok(new { sent = 0, message = "No subscriptions found." });

        var dead = new List<int>();
        foreach (var sub in subs)
        {
            var ok = await push.SendAsync(sub, "SmartSpend", "Notifications are working.");
            if (!ok) dead.Add(sub.Id);
        }

        if (dead.Count > 0)
        {
            db.Subscriptions.RemoveRange(db.Subscriptions.Where(s => dead.Contains(s.Id)));
            await db.SaveChangesAsync();
        }

        return Ok(new { sent = subs.Count - dead.Count, removed = dead.Count });
    }
}
