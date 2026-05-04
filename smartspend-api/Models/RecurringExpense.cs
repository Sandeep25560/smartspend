namespace SmartSpend.Api.Models;

public class RecurringExpense
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? FinancePlanId { get; set; }
    public string Name { get; set; } = "";
    public double Amount { get; set; }
    public int DayOfMonth { get; set; } // 1–28

    public User User { get; set; } = null!;
    public FinancePlan? FinancePlan { get; set; }
}
