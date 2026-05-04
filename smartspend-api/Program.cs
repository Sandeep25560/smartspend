using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartSpend.Api.BackgroundServices;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Text;
using System.Threading.RateLimiting;

var builder = WebApplication.CreateBuilder(args);

// Fail fast — catch missing secrets at startup rather than at the first request
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.StartsWith('<'))
    throw new InvalidOperationException(
        "Jwt:Key is missing or still a placeholder. Set a real secret in the Render environment variables.");

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlite(builder.Configuration.GetConnectionString("Default")
        ?? "Data Source=smartspend.db"));

// Rate-limit auth endpoints: 10 attempts per IP per minute
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", o =>
    {
        o.PermitLimit = 10;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueLimit = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, _) =>
    {
        ctx.HttpContext.Response.ContentType = "application/json";
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Too many requests. Please wait a moment and try again." });
    };
});

// JWT auth
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!)),
            ValidateIssuer   = false,
            ValidateAudience = false,
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddSingleton<VapidKeyService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<DecisionService>();
builder.Services.AddScoped<PushService>();
builder.Services.AddHostedService<DailyNotificationService>();
builder.Services.AddHostedService<EveningNudgeService>();

var localFrontendOrigins = new[]
{
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:5176",
};

var configuredFrontendOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "")
    .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

var allowedFrontendOrigins = localFrontendOrigins
    .Concat(configuredFrontendOrigins)
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddCors(opts =>
    opts.AddPolicy("Frontend", p =>
        p.WithOrigins(allowedFrontendOrigins)
         .AllowAnyHeader()
         .AllowAnyMethod()));

var app = builder.Build();

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = "Something went wrong. Try again." });
    });
});

// Create the database if needed. Never delete persisted data during startup.
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    EnsureSqliteDirectoryExists(ctx.Database.GetConnectionString());
    ctx.Database.EnsureCreated();
    // WAL mode allows background services and API requests to run concurrently
    // without triggering SQLITE_BUSY errors
    ctx.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
    ctx.Database.ExecuteSqlRaw("PRAGMA busy_timeout=5000;");
    app.Services.GetRequiredService<VapidKeyService>(); // warm up VAPID keys
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Health check — Render and UptimeRobot ping this to verify the service is alive
app.MapGet("/health", async (AppDbContext db) =>
{
    try
    {
        await db.Database.ExecuteSqlRawAsync("SELECT 1");
        return Results.Ok(new { status = "healthy", timestamp = DateTime.UtcNow });
    }
    catch (Exception ex)
    {
        return Results.Json(
            new { status = "unhealthy", error = ex.Message },
            statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

app.Run();

static void EnsureSqliteDirectoryExists(string? connectionString)
{
    if (string.IsNullOrWhiteSpace(connectionString)) return;

    var builder = new SqliteConnectionStringBuilder(connectionString);
    var dataSource = builder.DataSource;

    if (string.IsNullOrWhiteSpace(dataSource) || dataSource.Equals(":memory:", StringComparison.OrdinalIgnoreCase))
        return;

    var directory = Path.GetDirectoryName(Path.GetFullPath(dataSource));
    if (!string.IsNullOrWhiteSpace(directory))
    {
        Directory.CreateDirectory(directory);
    }
}
