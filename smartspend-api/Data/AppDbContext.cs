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
    public DbSet<ActionRecord> ActionRecords => Set<ActionRecord>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
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

        modelBuilder.Entity<ActionRecord>()
            .HasIndex(a => new { a.UserId, a.RequestId })
            .IsUnique()
            .HasFilter("\"RequestId\" IS NOT NULL AND \"RequestId\" != ''");

        modelBuilder.Entity<AppSetting>()
            .HasKey(s => s.Key);
    }
}
