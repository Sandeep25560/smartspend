using System.Text.Json;
using WebPush;

namespace SmartSpend.Api.Services;

public class PushService(VapidKeyService vapid, ILogger<PushService> logger)
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
    };

    // Simple title+body notification (morning daily)
    public Task<bool> SendAsync(Models.PushSubscription sub, string title, string body)
        => SendRawAsync(sub, new
        {
            title,
            body,
            icon  = "/icon-192.png",
            badge = "/icon-192.png",
            tag   = "smartspend-daily",
        });

    // Decision follow-up: "Did you spend $X?" with YES / NO action buttons
    public Task<bool> SendDecisionAsync(
        Models.PushSubscription sub,
        double amount,
        string token,
        string apiBase)
        => SendRawAsync(sub, new
        {
            title   = "Quick check",
            body    = $"Did you spend ${amount:F0}?",
            icon    = "/icon-192.png",
            badge   = "/icon-192.png",
            tag     = "smartspend-decision",
            requireInteraction = true,
            actions = new[]
            {
                new { action = "yes", title = "Yes, I did" },
                new { action = "no",  title = "No, I didn't" },
            },
            data = new { type = "decision", amount, token, apiBase },
        });

    private async Task<bool> SendRawAsync(Models.PushSubscription sub, object payload)
    {
        try
        {
            var pushSub = new WebPush.PushSubscription(sub.Endpoint, sub.P256dh, sub.Auth);
            var details = new VapidDetails(vapid.Subject, vapid.PublicKey, vapid.PrivateKey);
            var json    = JsonSerializer.Serialize(payload, JsonOpts);

            var client = new WebPushClient();
            await client.SendNotificationAsync(pushSub, json, details);
            return true;
        }
        catch (WebPushException ex) when ((int)ex.StatusCode is 404 or 410)
        {
            logger.LogWarning("Subscription expired/gone for {Ep} — will be removed.", sub.Endpoint);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Push failed for {Ep}.", sub.Endpoint);
            return false;
        }
    }
}
