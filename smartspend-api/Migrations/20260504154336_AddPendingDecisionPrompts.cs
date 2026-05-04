using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartSpend.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddPendingDecisionPrompts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "PendingDecisionPrompts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UserId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestId = table.Column<string>(type: "text", nullable: false),
                    Token = table.Column<string>(type: "text", nullable: false),
                    Amount = table.Column<double>(type: "double precision", nullable: false),
                    Decision = table.Column<string>(type: "text", nullable: false),
                    ApiBase = table.Column<string>(type: "text", nullable: false),
                    DueAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    ExpiresAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    SentAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    RespondedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PendingDecisionPrompts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_PendingDecisionPrompts_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_PendingDecisionPrompts_Token",
                table: "PendingDecisionPrompts",
                column: "Token",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PendingDecisionPrompts_UserId_RequestId",
                table: "PendingDecisionPrompts",
                columns: new[] { "UserId", "RequestId" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "PendingDecisionPrompts");
        }
    }
}
