namespace SmartSpend.Api.Models;

public class FinancePlan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string ShareCode { get; set; } = "";
    public double CashBalance { get; set; }
    public double CardBalance { get; set; }
    public string ActivePot { get; set; } = "card";
    public DateTime? NextPayday { get; set; }
    public string PayFrequency { get; set; } = "Monthly";
    public bool OnboardingCompleted { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<ActionRecord> ActionRecords { get; set; } = new List<ActionRecord>();
    public ICollection<RecurringExpense> RecurringExpenses { get; set; } = new List<RecurringExpense>();
    public ICollection<PendingDecisionPrompt> PendingDecisionPrompts { get; set; } = new List<PendingDecisionPrompt>();
}
