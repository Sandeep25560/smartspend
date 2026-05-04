using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartSpend.Api.BackgroundServices;
using SmartSpend.Api.Data;
using SmartSpend.Api.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddDbContext<AppDbContext>(opts =>
    opts.UseSqlite(builder.Configuration.GetConnectionString("Default")
        ?? "Data Source=smartspend.db"));

// JWT auth
var jwtKey = builder.Configuration["Jwt:Key"]!;
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opts =>
    {
        opts.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
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
    ctx.Database.EnsureCreated();
    app.Services.GetRequiredService<VapidKeyService>(); // warm up VAPID keys
}

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.Run();
