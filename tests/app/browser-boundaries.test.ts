import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isProductionBlockedInspectionCode,
  resetImportedBackupSelection,
} from "../../src/app/browser-boundaries.js";

describe("browser launch boundaries", () => {
  it("blocks only inspection keys that can alter learner data", () => {
    expect(isProductionBlockedInspectionCode("F8")).toBe(false);
    expect(isProductionBlockedInspectionCode("F9")).toBe(true);
    expect(isProductionBlockedInspectionCode("F10")).toBe(true);
    expect(isProductionBlockedInspectionCode("F7")).toBe(false);
    expect(isProductionBlockedInspectionCode("Escape")).toBe(false);
  });

  it("stops product propagation without cancelling the browser default", () => {
    const source = readFileSync("src/app/browser-boundaries.ts", "utf8");
    const start = source.indexOf("export function bindProductionInspectionBoundary");
    const end = source.indexOf("interface FileInputLike", start);
    const binding = source.slice(start, end);

    expect(binding).toContain("event.stopPropagation()");
    expect(binding).not.toContain("event.preventDefault()");
  });

  // These two do read the source, and unlike the checks that used to stand in
  // for the shell's behaviour, that is the right thing to read: the invariant is
  // the order of three top-level statements in one module, and top-level order
  // has no separate runtime to observe it from. What made this assertable at all
  // is that mounting is now a call -- `createApp` -- rather than the act of
  // importing a module, so the order is written here instead of being a property
  // of the import graph.
  it("installs recovery and the production boundary before the app is built", () => {
    const source = readFileSync("src/app/browser.ts", "utf8");
    const boundary = source.indexOf("bindProductionInspectionBoundary(");
    const recovery = source.indexOf("recoverLocalPersistenceTransaction(localStorage)");
    const build = source.indexOf("createApp({");

    expect(boundary).toBeGreaterThanOrEqual(0);
    expect(recovery).toBeGreaterThan(boundary);
    expect(build).toBeGreaterThan(recovery);
  });

  it("loads global styles before it builds the app", () => {
    const source = readFileSync("src/app/browser.ts", "utf8");
    const styleImport = source.indexOf('import "./style.css"');

    expect(styleImport).toBeGreaterThanOrEqual(0);
    expect(source.indexOf("createApp({")).toBeGreaterThan(styleImport);
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
