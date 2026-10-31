import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/components/csv-import/Step2Mapping", () => ({ Step2Mapping: () => <div data-testid="mapping" /> }));
vi.mock("@/src/lib/csv-import", () => ({ downloadImportTemplateCsv: vi.fn() }));

import { MigrateOnboardingStep2UploadMapping, type MigrateUploadedFile } from "./MigrateOnboardingStep2UploadMapping";
import { automationProgress, deriveAutomationSteps, formatRows, sessionStateChip } from "./migrateStep2.config";

const file = (over: Partial<MigrateUploadedFile["session"]> = {}): MigrateUploadedFile => ({
  ref: { importSessionId: "s1", entityType: "customers", fileName: "customers_2026.csv", label: "customers_2026.csv" },
  session: {
    id: "s1",
    status: "mapping",
    entityType: "customers",
    fileName: "customers_2026.csv",
    totalRows: 2980,
    validRows: null,
    errorRows: null,
    importedRows: null,
    skippedRows: null,
    duplicateRows: null,
    columnMappings: { Name: "firstName" },
    completedAt: null,
    rolledBackAt: null,
    createdAt: "2026-10-27T00:00:00.000Z",
    ...over
  },
  mappingOverrides: { Name: "firstName", Zip: null }
});

const base = {
  sourceLabel: "Generic export",
  activeFileId: null,
  isUploading: false,
  isLinking: false,
  onSelectFile: vi.fn(),
  onUpdateMapping: vi.fn(),
  onBack: vi.fn(),
  onCompleteStep2: vi.fn()
};

afterEach(() => cleanup());

describe("MigrateOnboardingStep2UploadMapping (Figma 12:4)", () => {
  it("renders frame copy and honest empty state", () => {
    render(<MigrateOnboardingStep2UploadMapping {...base} files={[]} onUpload={vi.fn()} />);
    expect(screen.getByText("Drop files here, or browse")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Choose files" })).toBeTruthy();
    expect(screen.getByText("Upload at least one export to continue.")).toBeTruthy();
    expect(screen.getByText("Idle")).toBeTruthy();
  });

  it("renders files table with rows, detected type and state", () => {
    render(<MigrateOnboardingStep2UploadMapping {...base} files={[file()]} onUpload={vi.fn()} />);
    const table = screen.getByRole("table").textContent ?? "";
    expect(table).toContain("customers_2026.csv");
    expect(table).toContain("Customers");
    expect(table).toContain("2,980");
    expect(table).toContain("Mapped");
    expect(screen.getByText("1 of 2 columns mapped")).toBeTruthy();
  });

  it("shows — when row count is unknown", () => {
    render(<MigrateOnboardingStep2UploadMapping {...base} files={[file({ totalRows: null })]} onUpload={vi.fn()} />);
    expect(screen.getByRole("table").textContent).toContain("—");
  });

  it("uploads every chosen file with the selected entity", async () => {
    const onUpload = vi.fn().mockResolvedValue(undefined);
    render(<MigrateOnboardingStep2UploadMapping {...base} files={[]} onUpload={onUpload} />);
    fireEvent.change(screen.getByLabelText("File contains"), { target: { value: "jobs" } });
    const a = new File(["x"], "a.csv");
    const b = new File(["y"], "b.csv");
    fireEvent.change(screen.getByTestId("migrate-file-input"), { target: { files: [a, b] } });
    await vi.waitFor(() => expect(onUpload).toHaveBeenCalledTimes(2));
    expect(onUpload).toHaveBeenCalledWith(a, "jobs");
  });
});

describe("migrateStep2.config", () => {
  it("derives automation steps without faking later stages", () => {
    const steps = deriveAutomationSteps({ files: [{ status: "mapping", mappings: { A: "x", B: "y" } }], isUploading: false });
    expect(steps.map((s) => s.state)).toEqual(["done", "done", "waiting", "waiting", "waiting", "waiting"]);
    expect(automationProgress(steps)).toBeCloseTo(2 / 6);
    expect(deriveAutomationSteps({ files: [], isUploading: false })[0]?.state).toBe("waiting");
  });
  it("maps states and rows", () => {
    expect(sessionStateChip("failed")).toEqual({ label: "Failed", tone: "red" });
    expect(formatRows(undefined)).toBe("—");
  });
});
