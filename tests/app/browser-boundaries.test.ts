import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isInspectionShortcutCode,
  resetImportedBackupSelection,
} from "../../src/app/browser-boundaries.js";

describe("browser launch boundaries", () => {
  it("recognizes only the three development inspection function keys", () => {
    expect(isInspectionShortcutCode("F8")).toBe(true);
    expect(isInspectionShortcutCode("F9")).toBe(true);
    expect(isInspectionShortcutCode("F10")).toBe(true);
    expect(isInspectionShortcutCode("F7")).toBe(false);
    expect(isInspectionShortcutCode("Escape")).toBe(false);
  });

  it("stops product propagation without cancelling the browser default", () => {
    const source = readFileSync("src/app/browser-boundaries.ts", "utf8");
    const start = source.indexOf("export function bindProductionInspectionBoundary");
    const end = source.indexOf("interface FileInputLike", start);
    const binding = source.slice(start, end);

    expect(binding).toContain("event.stopPropagation()");
    expect(binding).not.toContain("event.preventDefault()");
  });

  it("installs recovery and the production boundary before main mounts", () => {
    const source = readFileSync("src/app/browser.ts", "utf8");
    const boundary = source.indexOf("bindProductionInspectionBoundary(");
    const recovery = source.indexOf("recoverLocalPersistenceTransaction(localStorage)");
    const mainImport = source.indexOf('await import("./main.js")');

    expect(source).not.toContain('import "./main.js"');
    expect(boundary).toBeGreaterThanOrEqual(0);
    expect(recovery).toBeGreaterThan(boundary);
    expect(mainImport).toBeGreaterThan(recovery);
  });

  it("clears only the product backup file picker", () => {
    const backup = { id: "import-backup", type: "file", value: "backup.json" };
    const otherFile = { id: "avatar", type: "file", value: "avatar.png" };
    const text = { id: "import-backup", type: "text", value: "backup.json" };

    expect(resetImportedBackupSelection(backup)).toBe(true);
    expect(backup.value).toBe("");
    expect(resetImportedBackupSelection(otherFile)).toBe(false);
    expect(otherFile.value).toBe("avatar.png");
    expect(resetImportedBackupSelection(text)).toBe(false);
    expect(text.value).toBe("backup.json");
  });
});
