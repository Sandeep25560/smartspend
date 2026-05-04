using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Models;

namespace SmartSpend.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Streak> Streaks => Set<Streak>();
    public DbSet<PushSubscription> Subscriptions => Set<PushSubscription>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();
    public DbSet<FinancePlan> FinancePlans => Set<FinancePlan>();
    public DbSet<ActionRecord> ActionRecords => Set<ActionRecord>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<RecurringExpense> RecurringExpenses => Set<RecurringExpense>();
    public DbSet<PendingDecisionPrompt> PendingDecisionPrompts => Set<PendingDecisionPrompt>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasOne(u => u.FinancePlan)
            .WithMany(p => p.Users)
            .HasForeignKey(u => u.FinancePlanId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<FinancePlan>()
            .HasIndex(p => p.ShareCode)
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasOne(u => u.Streak)
            .WithOne(s => s.User)
            .HasForeignKey<Streak>(s => s.UserId);

        modelBuilder.Entity<Streak>()
            .Property(s => s.CurrentStreak)
            .IsRequired();

        modelBuilder.Entity<User>()
            .HasMany(u => u.Subscriptions)
            .WithOne(s => s.User)
            .HasForeignKey(s => s.UserId);

        modelBuilder.Entity<User>()
            .HasMany(u => u.RefreshTokens)
            .WithOne(r => r.User)
            .HasForeignKey(r => r.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<User>()
            .HasMany(u => u.PasswordResetTokens)
            .WithOne(p => p.User)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<User>()
            .HasMany(u => u.ActionRecords)
            .WithOne(a => a.User)
            .HasForeignKey(a => a.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<FinancePlan>()
            .HasMany(p => p.ActionRecords)
            .WithOne(a => a.FinancePlan)
            .HasForeignKey(a => a.FinancePlanId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<ActionRecord>()
            .HasIndex(a => new { a.UserId, a.RequestId })
            .IsUnique();

        modelBuilder.Entity<User>()
            .HasMany(u => u.RecurringExpenses)
            .WithOne(e => e.User)
            .HasForeignKey(e => e.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<FinancePlan>()
            .HasMany(p => p.RecurringExpenses)
            .WithOne(e => e.FinancePlan)
            .HasForeignKey(e => e.FinancePlanId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<User>()
            .HasMany(u => u.PendingDecisionPrompts)
            .WithOne(p => p.User)
            .HasForeignKey(p => p.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<FinancePlan>()
            .HasMany(p => p.PendingDecisionPrompts)
            .WithOne(p => p.FinancePlan)
            .HasForeignKey(p => p.FinancePlanId)
            .OnDelete(DeleteBehavior.SetNull);

        modelBuilder.Entity<PendingDecisionPrompt>()
            .HasIndex(p => new { p.UserId, p.RequestId })
            .IsUnique();

        modelBuilder.Entity<PendingDecisionPrompt>()
            .HasIndex(p => p.Token)
            .IsUnique();

        modelBuilder.Entity<AppSetting>()
            .HasKey(s => s.Key);
    }
}
