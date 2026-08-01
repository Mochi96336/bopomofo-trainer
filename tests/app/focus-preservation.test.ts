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

  // Closing the panel and anchoring focus before analysis opens is asserted
  // against the composed shell in `app-shell.test.ts`, which mounts the
  // diagnostics layer over the app the way `browser.ts` does and presses the
  // control a learner presses.
});
