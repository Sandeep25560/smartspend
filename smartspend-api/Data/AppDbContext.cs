using Microsoft.EntityFrameworkCore;
using SmartSpend.Api.Models;

namespace SmartSpend.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Streak> Streaks => Set<Streak>();
    public DbSet<PushSubscription> Subscriptions => Set<PushSubscription>();

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
    }
}
