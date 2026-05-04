namespace SmartSpend.Api.Models;

public class Streak
{
    public int Id { get; set; }
    public Guid UserId { get; set; }
    public int CurrentStreak { get; set; }
    public DateTime LastUpdated { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
