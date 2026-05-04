using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace SmartSpend.Api.Migrations
{
    /// <inheritdoc />
    public partial class FixActionRecordRequestIdIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ActionRecords_RequestId",
                table: "ActionRecords");

            migrationBuilder.DropIndex(
                name: "IX_ActionRecords_UserId",
                table: "ActionRecords");

            migrationBuilder.AlterColumn<string>(
                name: "RequestId",
                table: "ActionRecords",
                type: "TEXT",
                nullable: true,
                oldClrType: typeof(string),
                oldType: "TEXT");

            migrationBuilder.CreateIndex(
                name: "IX_ActionRecords_UserId_RequestId",
                table: "ActionRecords",
                columns: new[] { "UserId", "RequestId" },
                unique: true,
                filter: "\"RequestId\" IS NOT NULL AND \"RequestId\" != ''");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_ActionRecords_UserId_RequestId",
                table: "ActionRecords");

            migrationBuilder.AlterColumn<string>(
                name: "RequestId",
                table: "ActionRecords",
                type: "TEXT",
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_ActionRecords_RequestId",
                table: "ActionRecords",
                column: "RequestId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ActionRecords_UserId",
                table: "ActionRecords",
                column: "UserId");
        }
    }
}
