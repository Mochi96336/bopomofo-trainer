import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  focusIdentityFor,
  focusIdentityMatches,
} from "../../src/app/focus-preservation.js";

describe("semantic focus preservation", () => {
  it("identifies diagnostic controls by action plus their semantic data", () => {
    const identity = focusIdentityFor({
      id: "",
      dataset: {
        action: "select-relation",
        tab: "transition",
        token: "zhuyin:ㄓ",
        id: "relation:1",
        value: "timing",
      },
    });
    expect(identity).toEqual({
      id: null,
      data: {
        action: "select-relation",
        tab: "transition",
        token: "zhuyin:ㄓ",
        id: "relation:1",
        value: "timing",
      },
    });
    if (identity === null) throw new Error("expected a semantic focus identity");
    expect(focusIdentityMatches({ id: "", dataset: { ...identity.data } }, identity)).toBe(true);
    expect(focusIdentityMatches({
      id: "",
      dataset: { ...identity.data, id: "relation:2" },
    }, identity)).toBe(false);
  });

  // Rebuilding the panel from a slider's own change handler would replace the
  // slider mid-drag, so the status is written into the region already on the
  // page instead.
  it("keeps range-change handling local instead of rebuilding the information panel", () => {
    const source = readFileSync("src/app/main.ts", "utf8");
    const start = source.indexOf("function bindInfluenceControl(");
    const end = source.indexOf("function downloadProductBackup", start);
    const binding = source.slice(start, end);
    expect(binding).toContain('updateActionStatus("tuning-notice"');
    expect(binding).not.toContain("renderInformationPanel()");
  });

  it("captures and restores semantic focus around diagnostic renders", () => {
    const source = readFileSync("src/app/diagnostic-panel.ts", "utf8");
    const start = source.indexOf("const render = (): void =>");
    const end = source.indexOf("const finishClose", start);
    const render = source.slice(start, end);
    expect(render).toContain("captureFocusIdentity(host)");
    expect(render.indexOf("captureFocusIdentity(host)")).toBeLessThan(render.indexOf("host.innerHTML"));
    expect(render).toContain("restoreFocusIdentity(host, focusIdentity");
  });

  it("closes the information panel and anchors focus before opening analysis", () => {
    const source = readFileSync("src/app/diagnostic-enhancement.ts", "utf8");
    const start = source.indexOf("function openAnalysisFromPractice(");
    const end = source.indexOf("function mountAnalysisTopLayer", start);
    const opening = source.slice(start, end);
    const close = opening.indexOf("sourceDialog.close()");
    const focus = opening.indexOf("#keyboard-capture");
    const open = opening.indexOf("analysis.open()");

    expect(opening).toContain("sourceDialog?.open");
    expect(close).toBeGreaterThanOrEqual(0);
    expect(focus).toBeGreaterThan(close);
    expect(open).toBeGreaterThan(focus);
    expect(opening).toContain("return home");
  });
});
