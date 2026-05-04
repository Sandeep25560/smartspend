namespace SmartSpend.Api.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public double Balance { get; set; }
    public DateTime? NextPayday { get; set; }
    public string PayFrequency { get; set; } = "Monthly"; // Weekly | Biweekly | Monthly | Irregular
    public bool OnboardingCompleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public Streak? Streak { get; set; }
    public ICollection<PushSubscription> Subscriptions { get; set; } = new List<PushSubscription>();
}
