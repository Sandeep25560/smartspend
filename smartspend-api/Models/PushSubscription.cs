namespace SmartSpend.Api.Models;

public class PushSubscription
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";

    public User User { get; set; } = null!;
}
