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

  it("keeps range-change handling local instead of rebuilding the information panel", () => {
    const source = readFileSync("src/app/main.ts", "utf8");
    const start = source.indexOf("function bindInfluenceControl(");
    const end = source.indexOf("function downloadProductBackup", start);
    const binding = source.slice(start, end);
    expect(binding).toContain("updateTuningNotice()");
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

  it("closes the information panel before analysis captures its return target", () => {
    const source = readFileSync("src/app/diagnostic-enhancement.ts", "utf8");
    const start = source.indexOf("function openAnalysisFromPractice(");
    const end = source.indexOf("function mountAnalysisTopLayer", start);
    const opening = source.slice(start, end);

    expect(opening).toContain("sourceDialog?.open");
    expect(opening.indexOf("sourceDialog.close()")).toBeLessThan(opening.indexOf("analysis.open()"));
    expect(opening).toContain("return directly to practice");
  });
});
