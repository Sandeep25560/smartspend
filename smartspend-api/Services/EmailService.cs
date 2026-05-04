using System.Text.Json;

namespace SmartSpend.Api.Services;

public class EmailService(IConfiguration config, ILogger<EmailService> logger)
{
    private readonly string? _apiKey  = config["Resend:ApiKey"];
    private readonly string  _from    = config["Resend:From"] ?? "SmartSpend <noreply@resend.dev>";
    private readonly string  _appUrl  = config["App:Url"] ?? "https://smartspend.vercel.app";

    public async Task SendPasswordResetAsync(string toEmail, string token)
    {
        var resetUrl  = $"{_appUrl}/reset-password?token={token}";
        var subject   = "Reset your SmartSpend password";
        var html      = $"""
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
              <h2 style="color:#34d399">Reset your password</h2>
              <p>Click the link below to set a new password. This link expires in 1 hour.</p>
              <a href="{resetUrl}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0">
                Reset password
              </a>
              <p style="color:#666;font-size:13px">If you didn't request this, you can safely ignore this email.</p>
            </div>
            """;

        await SendAsync(toEmail, subject, html);
    }

    private async Task SendAsync(string to, string subject, string html)
    {
        if (string.IsNullOrWhiteSpace(_apiKey))
        {
            // Dev mode — log the email instead of sending it
            logger.LogInformation("📧 [DEV] Email to {To} | Subject: {Subject} | HTML length: {Len}", to, subject, html.Length);
            return;
        }

        using var client = new HttpClient();
        client.DefaultRequestHeaders.Add("Authorization", $"Bearer {_apiKey}");

        var payload = new
        {
            from    = _from,
            to      = new[] { to },
            subject,
            html,
        };

        var res = await client.PostAsJsonAsync("https://api.resend.com/emails", payload);

        if (!res.IsSuccessStatusCode)
        {
            var body = await res.Content.ReadAsStringAsync();
            logger.LogError("Resend API error {Status}: {Body}", res.StatusCode, body);
            throw new InvalidOperationException("Could not send email. Please try again.");
        }
    }
}
