namespace SmartSpend.Api.Models;

public class PendingDecisionPrompt
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? FinancePlanId { get; set; }
    public string RequestId { get; set; } = "";
    public string Token { get; set; } = "";
    public double Amount { get; set; }
    public string Decision { get; set; } = "";
    public string Pot { get; set; } = "card";
    public string ApiBase { get; set; } = "";
    public DateTime DueAt { get; set; }
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? SentAt { get; set; }
    public DateTime? RespondedAt { get; set; }

    public User User { get; set; } = null!;
    public FinancePlan? FinancePlan { get; set; }
}
