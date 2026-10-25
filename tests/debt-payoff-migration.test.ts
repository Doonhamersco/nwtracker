import { describe, it, expect } from "vitest";
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";

const migrationsDir = path.join(process.cwd(), "db", "migrations");

function applySqlFile(sqlite: Database.Database, filename: string) {
  const sql = fs.readFileSync(path.join(migrationsDir, filename), "utf8");
  for (const statement of sql.split("--> statement-breakpoint")) {
    const trimmed = statement.trim();
    if (trimmed) sqlite.exec(trimmed);
  }
}

function databaseBeforePayoffMigration() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    if (file.startsWith("0011_")) break;
    applySqlFile(sqlite, file);
  }
  return sqlite;
}

function insertAccount(
  sqlite: Database.Database,
  id: string,
  name: string,
  category: string
) {
  sqlite
    .prepare("INSERT INTO accounts (id, name, type, category) VALUES (?, ?, 'LIABILITY', ?)")
    .run(id, name, category);
}

function insertGoal(
  sqlite: Database.Database,
  row: {
    id: string;
    name: string;
    description?: string | null;
    target?: number;
    baseline?: number | null;
    metric?: string;
    completedAt?: string | null;
  }
) {
  sqlite
    .prepare(
      `INSERT INTO goals (
        id, name, description, target_value, target_date, metric_type,
        baseline_value, completed_at, is_active, created_at
      ) VALUES (?, ?, ?, ?, '2030-01-01', ?, ?, ?, 1, '2024-06-01 00:00:00')`
    )
    .run(
      row.id,
      row.name,
      row.description ?? null,
      row.target ?? 10770,
      row.metric ?? "NET_WORTH",
      row.baseline ?? null,
      row.completedAt ?? null
    );
}

function goalRow(sqlite: Database.Database, id: string) {
  return sqlite.prepare("SELECT * FROM goals WHERE id = ?").get(id) as {
    metric_type: string;
    direction: string;
    target_value: number;
    baseline_value: number | null;
    baseline_date: string | null;
    linked_account_id: string | null;
    linked_category: string | null;
    name: string;
  };
}

describe("debt payoff goal migration", () => {
  it("converts a clearly worded student-loan payoff and keeps the amount to clear as the start", () => {
    const sqlite = databaseBeforePayoffMigration();
    insertAccount(sqlite, "loan-1", "Student Loans Company", "STUDENT_LOAN");
    insertAccount(sqlite, "card-1", "Credit card", "OTHER_LIABILITY");
    insertGoal(sqlite, {
      id: "student",
      name: "Student Loan paid off",
      description: "pay off the remaining £10,770",
      target: 10770,
      baseline: 80000,
      metric: "NET_WORTH",
    });

    applySqlFile(sqlite, "0011_debt_payoff_goals.sql");

    const row = goalRow(sqlite, "student");
    expect(row.metric_type).toBe("DEBT_PAYOFF");
    expect(row.direction).toBe("decrease");
    expect(row.target_value).toBe(0);
    expect(row.baseline_value).toBe(10770);
    expect(row.baseline_date).toBe("2024-06-01");
    expect(row.linked_account_id).toBe("loan-1");
    expect(row.linked_category).toBeNull();
    sqlite.close();
  });

  it("leaves a net-worth goal that only mentions a loan in passing", () => {
    const sqlite = databaseBeforePayoffMigration();
    insertAccount(sqlite, "loan-1", "Student Loans Company", "STUDENT_LOAN");
    insertGoal(sqlite, {
      id: "worth",
      name: "Reach £100k net worth",
      description: "after the student loan is paid off",
      target: 100000,
      baseline: 20000,
    });

    applySqlFile(sqlite, "0011_debt_payoff_goals.sql");

    const row = goalRow(sqlite, "worth");
    expect(row.metric_type).toBe("NET_WORTH");
    expect(row.direction).toBe("increase");
    expect(row.target_value).toBe(100000);
    expect(row.baseline_value).toBe(20000);
    expect(row.linked_account_id).toBeNull();
    sqlite.close();
  });

  it("leaves a payoff goal the user already marked complete", () => {
    const sqlite = databaseBeforePayoffMigration();
    insertAccount(sqlite, "loan-1", "Student Loans Company", "STUDENT_LOAN");
    insertGoal(sqlite, {
      id: "done",
      name: "Student Loan paid off",
      target: 10770,
      completedAt: "2026-01-01",
    });

    applySqlFile(sqlite, "0011_debt_payoff_goals.sql");

    const row = goalRow(sqlite, "done");
    expect(row.metric_type).toBe("NET_WORTH");
    expect(row.target_value).toBe(10770);
    expect(row.direction).toBe("increase");
    sqlite.close();
  });

  it("leaves a payoff goal when more than one loan could match", () => {
    const sqlite = databaseBeforePayoffMigration();
    insertAccount(sqlite, "loan-a", "Alpha Loan", "STUDENT_LOAN");
    insertAccount(sqlite, "loan-b", "Beta Loan", "STUDENT_LOAN");
    insertGoal(sqlite, {
      id: "ambiguous",
      name: "Student Loan paid off",
      description: "pay off the remaining £10,770",
      target: 10770,
      baseline: 10770,
    });

    applySqlFile(sqlite, "0011_debt_payoff_goals.sql");

    const row = goalRow(sqlite, "ambiguous");
    expect(row.metric_type).toBe("NET_WORTH");
    expect(row.target_value).toBe(10770);
    expect(row.linked_account_id).toBeNull();
    sqlite.close();
  });

  it("leaves a payoff that still names a remaining balance", () => {
    const sqlite = databaseBeforePayoffMigration();
    insertAccount(sqlite, "loan-1", "Student Loans Company", "STUDENT_LOAN");
    insertGoal(sqlite, {
      id: "partial",
      name: "Pay off loan down to £500",
      target: 500,
      baseline: 10770,
    });

    applySqlFile(sqlite, "0011_debt_payoff_goals.sql");

    const row = goalRow(sqlite, "partial");
    expect(row.metric_type).toBe("NET_WORTH");
    expect(row.target_value).toBe(500);
    sqlite.close();
  });

  it("converts an all-debt goal without picking one liability", () => {
    const sqlite = databaseBeforePayoffMigration();
    insertAccount(sqlite, "loan-1", "Student Loans Company", "STUDENT_LOAN");
    insertAccount(sqlite, "card-1", "Credit card", "OTHER_LIABILITY");
    insertGoal(sqlite, {
      id: "all",
      name: "Become debt free",
      target: 4000,
      baseline: 9000,
    });

    applySqlFile(sqlite, "0011_debt_payoff_goals.sql");

    const row = goalRow(sqlite, "all");
    expect(row.metric_type).toBe("DEBT_PAYOFF");
    expect(row.direction).toBe("decrease");
    expect(row.target_value).toBe(0);
    expect(row.baseline_value).toBe(4000);
    expect(row.linked_account_id).toBeNull();
    sqlite.close();
  });
});
