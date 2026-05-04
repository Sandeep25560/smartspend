namespace SmartSpend.Api.Services;

public record DecisionResult(
    string Status,
    string Message,
    double SafePerDay,
    int DaysLeft,
    double Balance,
    double ImpactDays
);

public class DecisionService
{
    private static readonly Dictionary<string, string[]> Messages = new()
    {
        ["SAFE"]    = ["You're good to go.", "This fits today.", "You've got room.", "This feels safe."],
        ["CAREFUL"] = ["This might stretch you.", "Give this one a pause.", "Possible, but tight.", "Better to wait."],
        ["STOP"]    = ["Skip this for now.", "Protect your week.", "This leaves you short.", "Only essentials for now."],
    };

    public DecisionResult Evaluate(double balance, DateTime nextPayday, double spendAmount, double upcomingExpenses = 0)
    {
        var rawDaysLeft = (nextPayday.Date - DateTime.UtcNow.Date).Days;
        var daysLeft = Math.Max(1, rawDaysLeft);
        var effectiveBalance = Math.Max(0, balance - Math.Max(0, upcomingExpenses));
        var safePerDay = effectiveBalance / daysLeft;
        var impactDays = safePerDay > 0 ? spendAmount / safePerDay : 0;

        var status = rawDaysLeft <= 0               ? "STOP"
                   : balance <= 0                   ? "STOP"
                   : spendAmount > balance          ? "STOP"
                   : effectiveBalance <= 0          ? "STOP"
                   : spendAmount > safePerDay * 1.3 ? "STOP"
                   : spendAmount > safePerDay       ? "CAREFUL"
                   : "SAFE";

        var rng = new Random();
        var msgList = Messages[status];
        var message = balance <= 0
            ? "Only essentials for now."
            : spendAmount > balance
                ? "This is more than what you have."
                : effectiveBalance <= 0
                    ? "Only essentials for now."
                : msgList[rng.Next(msgList.Length)];

        return new DecisionResult(status, message, safePerDay, daysLeft, balance, impactDays);
    }

    public DecisionResult DailyStatus(double balance, DateTime nextPayday, double upcomingExpenses = 0)
        => Evaluate(balance, nextPayday, Math.Max(0, balance - upcomingExpenses) / Math.Max(1, (nextPayday.Date - DateTime.UtcNow.Date).Days) * 0.8, upcomingExpenses);
}
