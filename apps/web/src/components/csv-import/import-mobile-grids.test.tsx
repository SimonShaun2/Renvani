import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Step1Upload } from "./Step1Upload";

const dir = join(__dirname);
const source = (file: string) => readFileSync(join(dir, file), "utf8");

describe("import wizard mobile grids (<sm stacks, desktop unchanged)", () => {
  it("Step1Upload 'What gets imported' chips stack below sm and stay 2-up from sm", () => {
    const html = renderToStaticMarkup(
      <Step1Upload companyName="Acme" workEmail="a@b.co" fileName={null} isUploading={false} onSelectFile={() => undefined} />
    );
    expect(html).toContain("grid grid-cols-1 gap-3 text-sm text-neutral-500 sm:grid-cols-2");
    expect(html).not.toMatch(/class="mt-4 grid grid-cols-2 /);
  });

  it.each(["Step2Mapping.tsx", "Step3Preview.tsx", "Step4Duplicates.tsx"])(
    "%s table container scrolls horizontally instead of clipping",
    (file) => {
      const text = source(file);
      expect(text).toMatch(/overflow-x-auto rounded-\[24px\] border border-neutral-200">\s*<table/);
      expect(text).not.toMatch(/overflow-hidden rounded-\[24px\] border border-neutral-200">\s*<table/);
    }
  );

  it("Step7Results failed-rows table is wrapped in a horizontal scroller", () => {
    expect(source("Step7Results.tsx")).toMatch(/<div className="overflow-x-auto">\s*<table/);
  });
});
