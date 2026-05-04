using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using SmartSpend.Api.Services;
using System.Security.Claims;
using System.Security.Cryptography;

namespace SmartSpend.Api.Controllers;

[ApiController]
[Route("api/notifications")]
public class NotificationsController(
    AppDbContext db,
    VapidKeyService vapid,
    PushService push,
    ActionRecorder recorder,
    FinancePlanService plans,
    IConfiguration config) : ControllerBase
{
    private Guid Uid => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    public record NotifyDecisionRequest(double Amount);
    public record DecisionPromptRequest(double Amount, string RequestId, string? Decision = null, int? DelaySeconds = null, string? Pot = null);
    public record CancelPromptRequest(string RequestId);
    public record ActionResponseRequest(string Token, bool Spent);
    public record SubscribeRequest(string Endpoint, string P256dh, string Auth);
    public record UnsubscribeRequest(string? Endpoint);

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

        var token = Request.Headers.Authorization.ToString().Replace("Bearer ", "").Trim();
        var apiBase = GetPublicApiBase();

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

    [HttpPost("decision-prompt")]
    [Authorize]
    public async Task<IActionResult> ScheduleDecisionPrompt([FromBody] DecisionPromptRequest req)
    {
        if (req.Amount <= 0 || double.IsNaN(req.Amount) || double.IsInfinity(req.Amount))
            return BadRequest(new { error = "Amount must be positive." });
        if (string.IsNullOrWhiteSpace(req.RequestId))
            return BadRequest(new { error = "Request id is required." });

        var hasSubscription = await db.Subscriptions.AnyAsync(s => s.UserId == Uid);
        if (!hasSubscription) return Ok(new { scheduled = false, reason = "No notification subscription." });

        var existingAction = await db.ActionRecords.AnyAsync(a => a.UserId == Uid && a.RequestId == req.RequestId);
        if (existingAction) return Ok(new { scheduled = false, reason = "Decision already recorded." });

        var now = DateTime.UtcNow;
        var delay = Math.Clamp(req.DelaySeconds ?? 14, 5, 60);
        var user = await db.Users
            .Include(u => u.FinancePlan)
            .FirstOrDefaultAsync(u => u.Id == Uid);
        if (user is null) return NotFound();
        var plan = await plans.EnsurePlanAsync(user, HttpContext.RequestAborted);
        var pot = FinancePlanService.NormalizePot(req.Pot ?? plan.ActivePot);

        await db.PendingDecisionPrompts
            .Where(p => p.UserId == Uid && p.RequestId != req.RequestId && p.RespondedAt == null && p.SentAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(p => p.RespondedAt, now));

        var prompt = await db.PendingDecisionPrompts
            .FirstOrDefaultAsync(p => p.UserId == Uid && p.RequestId == req.RequestId);

        if (prompt is null)
        {
            prompt = new PendingDecisionPrompt
            {
                UserId = Uid,
                FinancePlanId = plan.Id,
                RequestId = req.RequestId.Trim(),
                Token = NewPromptToken(),
            };
            db.PendingDecisionPrompts.Add(prompt);
        }

        prompt.Amount = req.Amount;
        prompt.Decision = req.Decision?.Trim() ?? "";
        prompt.FinancePlanId = plan.Id;
        prompt.Pot = pot;
        prompt.ApiBase = GetPublicApiBase();
        prompt.DueAt = now.AddSeconds(delay);
        prompt.ExpiresAt = now.AddHours(2);
        prompt.SentAt = null;
        prompt.RespondedAt = null;

        await db.SaveChangesAsync();

        return Ok(new { scheduled = true, prompt.Id, prompt.DueAt });
    }

    [HttpPost("decision-prompt/cancel")]
    [Authorize]
    public async Task<IActionResult> CancelDecisionPrompt([FromBody] CancelPromptRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.RequestId)) return Ok(new { cancelled = 0 });

        var now = DateTime.UtcNow;
        var cancelled = await db.PendingDecisionPrompts
            .Where(p => p.UserId == Uid && p.RequestId == req.RequestId && p.RespondedAt == null)
            .ExecuteUpdateAsync(setters => setters.SetProperty(p => p.RespondedAt, now));

        return Ok(new { cancelled });
    }

    [HttpPost("action-response")]
    [AllowAnonymous]
    public async Task<IActionResult> ActionResponse([FromBody] ActionResponseRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Token))
            return BadRequest(new { error = "Prompt token is required." });

        var prompt = await db.PendingDecisionPrompts
            .FirstOrDefaultAsync(p => p.Token == req.Token);

        if (prompt is null) return NotFound(new { error = "Prompt not found." });
        if (prompt.ExpiresAt <= DateTime.UtcNow) return BadRequest(new { error = "This prompt expired." });

        var result = await recorder.RecordAsync(
            prompt.UserId,
            prompt.Amount,
            req.Spent,
            sendPush: false,
            requestId: prompt.RequestId,
            tag: null,
            pot: prompt.Pot,
            ct: HttpContext.RequestAborted);

        prompt.RespondedAt ??= DateTime.UtcNow;
        await db.SaveChangesAsync();

        return Ok(result);
    }

    [HttpGet("vapid-key")]
    public IActionResult VapidKey() => Ok(new { publicKey = vapid.PublicKey });

    [HttpPost("subscribe")]
    [Authorize]
    public async Task<IActionResult> Subscribe([FromBody] SubscribeRequest req)
    {
        var exists = await db.Subscriptions.AnyAsync(s => s.UserId == Uid && s.Endpoint == req.Endpoint);
        if (!exists)
        {
            db.Subscriptions.Add(new PushSubscription
            {
                UserId = Uid,
                Endpoint = req.Endpoint,
                P256dh = req.P256dh,
                Auth = req.Auth,
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

    private string GetPublicApiBase()
    {
        var configured = config["Public:ApiBaseUrl"];
        if (!string.IsNullOrWhiteSpace(configured)) return configured.TrimEnd('/');

        return $"{Request.Scheme}://{Request.Host}";
    }

    private static string NewPromptToken()
        => Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
}
