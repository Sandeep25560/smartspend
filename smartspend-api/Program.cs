using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Serilog;
using SmartSpend.Api.BackgroundServices;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Text;
using System.Threading.RateLimiting;

// ── Serilog (structured logging) ─────────────────────────────────────────────
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .Enrich.FromLogContext()
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

// ── Fail fast on missing secrets ──────────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.StartsWith('<'))
    throw new InvalidOperationException(
        "Jwt:Key is missing or still a placeholder. Set a real secret in Render environment variables.");

// ── Sentry (error tracking) ───────────────────────────────────────────────────
builder.WebHost.UseSentry(opts =>
{
    opts.Dsn               = builder.Configuration["Sentry:Dsn"] ?? "";
    opts.TracesSampleRate  = 0.1;
    opts.SendDefaultPii    = false;
    // DSN is optional — no Sentry if not configured
    opts.IsGlobalModeEnabled = false;
});

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlite(builder.Configuration.GetConnectionString("Default")
        ?? "Data Source=smartspend.db"));

// ── Rate limiting: 10 auth attempts per IP per minute ─────────────────────────
builder.Services.AddRateLimiter(options =>
{
    options.AddFixedWindowLimiter("auth", o =>
    {
        o.PermitLimit = 10;
        o.Window      = TimeSpan.FromMinutes(1);
        o.QueueLimit  = 0;
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (ctx, _) =>
    {
        ctx.HttpContext.Response.ContentType = "application/json";
        await ctx.HttpContext.Response.WriteAsJsonAsync(
            new { error = "Too many requests. Please wait a moment and try again." });
    };
});

// ── JWT auth ──────────────────────────────────────────────────────────────────
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!)),
            ValidateIssuer           = false,
            ValidateAudience         = false,
            ClockSkew                = TimeSpan.Zero, // no grace period — tokens expire exactly on time
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddSingleton<VapidKeyService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<DecisionService>();
builder.Services.AddScoped<PushService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddHostedService<DailyNotificationService>();
builder.Services.AddHostedService<EveningNudgeService>();

// ── CORS — locked to allowed origins only ─────────────────────────────────────
var localOrigins = new[]
{
    "http://localhost:5173", "http://localhost:5174",
    "http://localhost:5175", "http://localhost:5176",
    "http://127.0.0.1:5173", "http://127.0.0.1:5174",
};

var configuredOrigins = (builder.Configuration["Cors:AllowedOrigins"] ?? "")
    .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

var allowedOrigins = localOrigins
    .Concat(configuredOrigins)
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray();

builder.Services.AddCors(opts =>
    opts.AddPolicy("Frontend", p =>
        p.WithOrigins(allowedOrigins)
         .AllowAnyHeader()
         .AllowAnyMethod()));

var app = builder.Build();

// ── Global exception handler ───────────────────────────────────────────────────
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode  = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = "Something went wrong. Try again." });
    });
});

// ── Security headers ──────────────────────────────────────────────────────────
app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"]  = "nosniff";
    h["X-Frame-Options"]         = "DENY";
    h["Referrer-Policy"]         = "strict-origin-when-cross-origin";
    h["Permissions-Policy"]      = "camera=(), microphone=(), geolocation=()";
    h["X-XSS-Protection"]        = "1; mode=block";
    await next();
});

// ── Database: migrate on startup (backward-compat with EnsureCreated DBs) ─────
using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var connStr = ctx.Database.GetConnectionString();
    EnsureSqliteDirectoryExists(connStr);

    // If the DB was previously created with EnsureCreated (no migration history),
    // seed the history table so Migrate() only applies the new AddNewTables migration.
    using var conn = new SqliteConnection(connStr);
    conn.Open();
    using var checkCmd = conn.CreateCommand();
    checkCmd.CommandText = "SELECT name FROM sqlite_master WHERE type='table' AND name='Users'";
    var tablesExist = checkCmd.ExecuteScalar() is not null;

    if (tablesExist)
    {
        using var createHistory = conn.CreateCommand();
        createHistory.CommandText = """
            CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
                "MigrationId"     TEXT NOT NULL CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY,
                "ProductVersion"  TEXT NOT NULL
            )
            """;
        createHistory.ExecuteNonQuery();

        using var seedHistory = conn.CreateCommand();
        seedHistory.CommandText = """
            INSERT OR IGNORE INTO "__EFMigrationsHistory" VALUES
                ('00000000000001_InitialCreate', '8.0.0')
            """;
        seedHistory.ExecuteNonQuery();
    }
    conn.Close();

    ctx.Database.Migrate();
    ctx.Database.ExecuteSqlRaw("PRAGMA journal_mode=WAL;");
    ctx.Database.ExecuteSqlRaw("PRAGMA busy_timeout=5000;");
    app.Services.GetRequiredService<VapidKeyService>(); // warm up VAPID keys
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── Health check ───────────────────────────────────────────────────────────────
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
    var b = new SqliteConnectionStringBuilder(connectionString);
    var src = b.DataSource;
    if (string.IsNullOrWhiteSpace(src) || src.Equals(":memory:", StringComparison.OrdinalIgnoreCase)) return;
    var dir = Path.GetDirectoryName(Path.GetFullPath(src));
    if (!string.IsNullOrWhiteSpace(dir)) Directory.CreateDirectory(dir);
}
