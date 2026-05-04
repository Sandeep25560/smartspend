using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartSpend.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFinancePlansSharedModeAndPots : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "FinancePlanId",
                table: "Users",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FinancePlanId",
                table: "RecurringExpenses",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "FinancePlanId",
                table: "PendingDecisionPrompts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Pot",
                table: "PendingDecisionPrompts",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "FinancePlanId",
                table: "ActionRecords",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Pot",
                table: "ActionRecords",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "FinancePlans",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShareCode = table.Column<string>(type: "text", nullable: false),
                    CashBalance = table.Column<double>(type: "double precision", nullable: false),
                    CardBalance = table.Column<double>(type: "double precision", nullable: false),
                    ActivePot = table.Column<string>(type: "text", nullable: false),
                    NextPayday = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    PayFrequency = table.Column<string>(type: "text", nullable: false),
                    OnboardingCompleted = table.Column<bool>(type: "boolean", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_FinancePlans", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Users_FinancePlanId",
                table: "Users",
                column: "FinancePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_RecurringExpenses_FinancePlanId",
                table: "RecurringExpenses",
                column: "FinancePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_PendingDecisionPrompts_FinancePlanId",
                table: "PendingDecisionPrompts",
                column: "FinancePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_ActionRecords_FinancePlanId",
                table: "ActionRecords",
                column: "FinancePlanId");

            migrationBuilder.CreateIndex(
                name: "IX_FinancePlans_ShareCode",
                table: "FinancePlans",
                column: "ShareCode",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_ActionRecords_FinancePlans_FinancePlanId",
                table: "ActionRecords",
                column: "FinancePlanId",
                principalTable: "FinancePlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_PendingDecisionPrompts_FinancePlans_FinancePlanId",
                table: "PendingDecisionPrompts",
                column: "FinancePlanId",
                principalTable: "FinancePlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_RecurringExpenses_FinancePlans_FinancePlanId",
                table: "RecurringExpenses",
                column: "FinancePlanId",
                principalTable: "FinancePlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "FK_Users_FinancePlans_FinancePlanId",
                table: "Users",
                column: "FinancePlanId",
                principalTable: "FinancePlans",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ActionRecords_FinancePlans_FinancePlanId",
                table: "ActionRecords");

            migrationBuilder.DropForeignKey(
                name: "FK_PendingDecisionPrompts_FinancePlans_FinancePlanId",
                table: "PendingDecisionPrompts");

            migrationBuilder.DropForeignKey(
                name: "FK_RecurringExpenses_FinancePlans_FinancePlanId",
                table: "RecurringExpenses");

            migrationBuilder.DropForeignKey(
                name: "FK_Users_FinancePlans_FinancePlanId",
                table: "Users");

            migrationBuilder.DropTable(
                name: "FinancePlans");

            migrationBuilder.DropIndex(
                name: "IX_Users_FinancePlanId",
                table: "Users");

            migrationBuilder.DropIndex(
                name: "IX_RecurringExpenses_FinancePlanId",
                table: "RecurringExpenses");

            migrationBuilder.DropIndex(
                name: "IX_PendingDecisionPrompts_FinancePlanId",
                table: "PendingDecisionPrompts");

            migrationBuilder.DropIndex(
                name: "IX_ActionRecords_FinancePlanId",
                table: "ActionRecords");

            migrationBuilder.DropColumn(
                name: "FinancePlanId",
                table: "Users");

            migrationBuilder.DropColumn(
                name: "FinancePlanId",
                table: "RecurringExpenses");

            migrationBuilder.DropColumn(
                name: "FinancePlanId",
                table: "PendingDecisionPrompts");

            migrationBuilder.DropColumn(
                name: "Pot",
                table: "PendingDecisionPrompts");

            migrationBuilder.DropColumn(
                name: "FinancePlanId",
                table: "ActionRecords");

            migrationBuilder.DropColumn(
                name: "Pot",
                table: "ActionRecords");
        }
    }
}
