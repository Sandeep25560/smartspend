namespace SmartSpend.Api.Models;

public class ActionRecord
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string? RequestId { get; set; } // idempotency key (null when not provided)
    public double Amount { get; set; }
    public bool Spent { get; set; }
    public string Decision { get; set; } = ""; // YES / WAIT / NO
    public double BalanceBefore { get; set; }
    public double BalanceAfter { get; set; }
    public double SafePerDay { get; set; }
    public int StreakAfter { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}
