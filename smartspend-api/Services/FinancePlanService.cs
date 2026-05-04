using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Data;
using SmartSpend.Api.Models;
using System.Security.Cryptography;

namespace SmartSpend.Api.Services;

public class FinancePlanService(AppDbContext db)
{
    public static string NormalizePot(string? pot)
        => string.Equals(pot, "cash", StringComparison.OrdinalIgnoreCase) ? "cash" : "card";

    public static double BalanceFor(FinancePlan plan, string? pot = null)
        => NormalizePot(pot ?? plan.ActivePot) == "cash" ? plan.CashBalance : plan.CardBalance;

    public static void SetBalance(FinancePlan plan, string? pot, double balance)
    {
        if (NormalizePot(pot ?? plan.ActivePot) == "cash") plan.CashBalance = balance;
        else plan.CardBalance = balance;
        plan.UpdatedAt = DateTime.UtcNow;
    }

    public async Task<FinancePlan> EnsurePlanAsync(User user, CancellationToken ct = default)
    {
        if (user.FinancePlan is not null) return user.FinancePlan;

        if (user.FinancePlanId.HasValue)
        {
            var existing = await db.FinancePlans
                .Include(p => p.Users)
                .Include(p => p.RecurringExpenses)
                .FirstOrDefaultAsync(p => p.Id == user.FinancePlanId.Value, ct);

            if (existing is not null)
            {
                user.FinancePlan = existing;
                return existing;
            }
        }

        var plan = new FinancePlan
        {
            ShareCode = await NewUniqueShareCodeAsync(ct),
            CardBalance = Math.Max(0, user.Balance),
            CashBalance = 0,
            ActivePot = "card",
            NextPayday = user.NextPayday,
            PayFrequency = user.PayFrequency,
            OnboardingCompleted = user.OnboardingCompleted,
        };

        user.FinancePlan = plan;
        user.FinancePlanId = plan.Id;

        var legacyExpenses = await db.RecurringExpenses
            .Where(e => e.UserId == user.Id && e.FinancePlanId == null)
            .ToListAsync(ct);

        foreach (var expense in legacyExpenses)
        {
            expense.FinancePlanId = plan.Id;
        }

        db.FinancePlans.Add(plan);
        await db.SaveChangesAsync(ct);
        return plan;
    }

    private async Task<string> NewUniqueShareCodeAsync(CancellationToken ct)
    {
        for (var i = 0; i < 10; i++)
        {
            var code = Convert.ToHexString(RandomNumberGenerator.GetBytes(4));
            var exists = await db.FinancePlans.AnyAsync(p => p.ShareCode == code, ct);
            if (!exists) return code;
        }

        return Convert.ToHexString(RandomNumberGenerator.GetBytes(6));
    }
}
