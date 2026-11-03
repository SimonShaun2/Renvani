import { describe, expect, it } from "vitest";

import { summarizeImportIssues, toPlainLanguageImportIssue } from "./migrate-onboarding-plain-language";

describe("migrate-onboarding-plain-language", () => {
  it("turns validation errors into operator-friendly headlines", () => {
    const issue = toPlainLanguageImportIssue({
      row: 4,
      field: "email",
      message: "Invalid email format",
      value: "not-an-email"
    });

    expect(issue.headline).toContain("Row 4");
    expect(issue.headline).toContain("email");
    expect(issue.detail).toContain("Invalid email format");
  });

  it("summarizes issue counts", () => {
    expect(summarizeImportIssues([])).toContain("No validation issues");
    expect(summarizeImportIssues([{ row: 1, field: "phone", message: "x", value: "" }])).toContain("1 row");
  });
});
