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
    public Guid? FinancePlanId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public FinancePlan? FinancePlan { get; set; }
    public Streak? Streak { get; set; }
    public ICollection<PushSubscription> Subscriptions { get; set; } = new List<PushSubscription>();
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = new List<PasswordResetToken>();
    public ICollection<ActionRecord> ActionRecords { get; set; } = new List<ActionRecord>();
    public ICollection<RecurringExpense> RecurringExpenses { get; set; } = new List<RecurringExpense>();
    public ICollection<PendingDecisionPrompt> PendingDecisionPrompts { get; set; } = new List<PendingDecisionPrompt>();
}
