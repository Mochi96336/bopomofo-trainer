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

  // The slider's own change handler must not replace the slider mid-drag. That
  // is asserted against a running shell in `app-shell.test.ts`, where the
  // surviving element and the focus it holds are both observable.

  // Capture and restore around an analysis render is asserted against a built
  // panel in `diagnostic-analysis-dom.test.ts`: a sort control is pressed, the
  // markup it lives in is rebuilt under it, and focus is expected on the
  // replacement. Nothing focuses that control afterwards, so the check fails
  // exactly when the identity is not carried across -- which was verified by
  // removing the restore and watching focus fall to the body.

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
