using SmartSpend.Api.Models;

namespace SmartSpend.Api.Services;

public static class BudgetMath
{
    public static double UpcomingExpensesTotal(IEnumerable<RecurringExpense> expenses, DateTime? nextPayday)
    {
        if (!nextPayday.HasValue) return 0;

        var today = DateTime.UtcNow.Date;
        var payday = nextPayday.Value.Date;
        if (payday <= today) return 0;

        var total = 0.0;
        var cursor = new DateTime(today.Year, today.Month, 1);
        var end = new DateTime(payday.Year, payday.Month, 1);

        while (cursor <= end)
        {
            foreach (var expense in expenses)
            {
                var dueDay = Math.Min(Math.Max(expense.DayOfMonth, 1), 28);
                var due = new DateTime(cursor.Year, cursor.Month, dueDay);
                if (due > today && due <= payday)
                {
                    total += expense.Amount;
                }
            }

            cursor = cursor.AddMonths(1);
        }

        return total;
    }
}
