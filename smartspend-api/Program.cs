using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Npgsql;
using Serilog;
using SmartSpend.Api.BackgroundServices;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Net;
using System.Text;
using System.Threading.RateLimiting;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .Enrich.FromLogContext()
    .CreateLogger();

var builder = WebApplication.CreateBuilder(args);
builder.Host.UseSerilog();

var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.StartsWith('<'))
{
    throw new InvalidOperationException(
        "Jwt:Key is missing or still a placeholder. Set a real secret in Render environment variables.");
}

builder.WebHost.UseSentry(opts =>
{
    opts.Dsn = builder.Configuration["Sentry:Dsn"] ?? "";
    opts.TracesSampleRate = 0.1;
    opts.SendDefaultPii = false;
    opts.IsGlobalModeEnabled = false;
});

builder.Services.AddControllers();

var dbConnectionString = GetPostgresConnectionString(builder.Configuration);
builder.Services.AddDbContext<AppDbContext>(opts => opts.UseNpgsql(dbConnectionString));

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

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey!)),
            ValidateIssuer = false,
            ValidateAudience = false,
            ClockSkew = TimeSpan.Zero,
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddSingleton<VapidKeyService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<DecisionService>();
builder.Services.AddScoped<FinancePlanService>();
builder.Services.AddScoped<ActionRecorder>();
builder.Services.AddScoped<PushService>();
builder.Services.AddScoped<EmailService>();
builder.Services.AddHostedService<DailyNotificationService>();
builder.Services.AddHostedService<EveningNudgeService>();
builder.Services.AddHostedService<WeeklySummaryService>();
builder.Services.AddHostedService<PendingDecisionPromptService>();

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

app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost,
});

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = "Something went wrong. Try again." });
    });
});

app.Use(async (ctx, next) =>
{
    var h = ctx.Response.Headers;
    h["X-Content-Type-Options"] = "nosniff";
    h["X-Frame-Options"] = "DENY";
    h["Referrer-Policy"] = "strict-origin-when-cross-origin";
    h["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()";
    h["X-XSS-Protection"] = "1; mode=block";
    await next();
});

using (var scope = app.Services.CreateScope())
{
    var ctx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await ctx.Database.MigrateAsync();
    app.Services.GetRequiredService<VapidKeyService>();
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

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

static string GetPostgresConnectionString(IConfiguration config)
{
    var value = new[]
    {
        config.GetConnectionString("Default"),
        config["DATABASE_URL"],
        config["DatabaseUrl"],
    }.FirstOrDefault(v => !string.IsNullOrWhiteSpace(v));

    if (string.IsNullOrWhiteSpace(value) || value.StartsWith('<'))
    {
        throw new InvalidOperationException(
            "PostgreSQL connection string is missing. Set ConnectionStrings__Default or DATABASE_URL in Render.");
    }

    return NormalizePostgresConnectionString(value);
}

static string NormalizePostgresConnectionString(string value)
{
    var trimmed = value.Trim();
    if (!trimmed.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
        && !trimmed.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        return trimmed;
    }

    var uri = new Uri(trimmed);
    var userInfo = uri.UserInfo.Split(':', 2);
    var builder = new NpgsqlConnectionStringBuilder
    {
        Host = uri.Host,
        Port = uri.Port > 0 ? uri.Port : 5432,
        Database = WebUtility.UrlDecode(uri.AbsolutePath.TrimStart('/')),
        Username = userInfo.Length > 0 ? WebUtility.UrlDecode(userInfo[0]) : "",
        Password = userInfo.Length > 1 ? WebUtility.UrlDecode(userInfo[1]) : "",
    };

    foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
    {
        var parts = pair.Split('=', 2);
        if (parts.Length != 2) continue;

        var key = WebUtility.UrlDecode(parts[0]);
        var val = WebUtility.UrlDecode(parts[1]);

        if (key.Equals("sslmode", StringComparison.OrdinalIgnoreCase)
            && Enum.TryParse<SslMode>(val, ignoreCase: true, out var sslMode))
        {
            builder.SslMode = sslMode;
        }
    }

    return builder.ConnectionString;
}
