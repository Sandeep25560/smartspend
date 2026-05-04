using System.Text.Json;
using WebPush;

namespace SmartSpend.Api.Services;

public class VapidKeyService
{
    private const string VapidFile = "vapid.json";

    public string PublicKey  { get; private set; } = "";
    public string PrivateKey { get; private set; } = "";
    public string Subject    { get; private set; } = "mailto:admin@smartspend.app";

    public VapidKeyService(IConfiguration config, IHostEnvironment env, ILogger<VapidKeyService> logger)
    {
        Subject = config["Vapid:Subject"] ?? Subject;

        // 1. Check appsettings / env vars
        var cfgPub  = config["Vapid:PublicKey"];
        var cfgPriv = config["Vapid:PrivateKey"];
        if (!string.IsNullOrWhiteSpace(cfgPub) && !string.IsNullOrWhiteSpace(cfgPriv))
        {
            PublicKey  = cfgPub;
            PrivateKey = cfgPriv;
            logger.LogInformation("VAPID keys loaded from configuration.");
            return;
        }

        if (env.IsProduction())
        {
            throw new InvalidOperationException("VAPID keys must be configured in production.");
        }

        // 2. Check vapid.json on disk
        var filePath = Path.GetFullPath(VapidFile);
        if (File.Exists(filePath))
        {
            try
            {
                var stored = JsonSerializer.Deserialize<StoredVapid>(File.ReadAllText(filePath));
                if (stored is { PublicKey: { Length: > 0 } })
                {
                    PublicKey  = stored.PublicKey;
                    PrivateKey = stored.PrivateKey;
                    logger.LogInformation("VAPID keys loaded from {File}.", filePath);
                    logger.LogInformation("Public key  : {Key}", PublicKey);
                    return;
                }
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not read {File}, regenerating.", filePath);
            }
        }

        // 3. Generate fresh keys
        var generated = VapidHelper.GenerateVapidKeys();
        PublicKey  = generated.PublicKey;
        PrivateKey = generated.PrivateKey;

        var json = JsonSerializer.Serialize(new StoredVapid(PublicKey, PrivateKey),
                       new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(filePath, json);

        logger.LogInformation("New VAPID keys generated and saved to {File}.", filePath);
        logger.LogInformation("Public key  : {Key}", PublicKey);
        logger.LogInformation("Private key : {Key}", PrivateKey);
    }

    private record StoredVapid(string PublicKey, string PrivateKey);
}
