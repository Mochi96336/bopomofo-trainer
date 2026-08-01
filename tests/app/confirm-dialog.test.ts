import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  confirmDialogMarkup,
  type ConfirmDialogOptions,
} from "../../src/app/confirm-dialog.js";

const RESET: ConfirmDialogOptions = {
  title: "清除所有本機進度？",
  sections: [{ heading: "將清除", items: ["練習進度", "最近紀錄"] }],
  note: "已下載的存檔檔案不受影響。",
  confirmLabel: "清除全部資料",
  tone: "danger",
};

const IMPORT: ConfirmDialogOptions = {
  title: "匯入這份存檔？",
  sections: [
    { heading: "目前資料", items: ["128 句完成"] },
    { heading: "匯入資料", items: ["94 句完成"] },
  ],
  note: "",
  confirmLabel: "匯入並取代",
  tone: "normal",
};

const source = readFileSync("src/app/confirm-dialog.ts", "utf8");
/**
 * The source with its comments removed. A rule stated as "this file never
 * mentions X" is otherwise broken by the comment explaining why it does not,
 * which makes the prose unrewritable without the test going red for no reason.
 */
const code = source
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

describe("confirmation markup", () => {
  it("names the action on the button rather than answering yes", () => {
    const markup = confirmDialogMarkup(RESET);
    expect(markup).toContain(">清除全部資料<");
    expect(markup).toContain(">取消<");
    expect(markup).not.toMatch(/>(確定|是|OK)</);
  });

  // Cancel is the form's first submit button, so Enter answers with the
  // reversible choice, and it is what opens focused.
  it("writes cancel before the action it can decline", () => {
    const markup = confirmDialogMarkup(RESET);
    expect(markup.indexOf("confirm-cancel")).toBeLessThan(markup.indexOf("confirm-accept"));
  });

  it("marks a destructive action and leaves a replacement unmarked", () => {
    expect(confirmDialogMarkup(RESET)).toContain('class="confirm-accept danger"');
    expect(confirmDialogMarkup(IMPORT)).toContain('class="confirm-accept"');
    expect(confirmDialogMarkup(IMPORT)).not.toContain("danger");
  });

  it("carries the answer on each button so the close can read it back", () => {
    const markup = confirmDialogMarkup(RESET);
    expect(markup).toContain('value="cancel"');
    expect(markup).toContain('value="accept"');
    expect(markup).toContain('method="dialog"');
  });

  it("renders every section heading and every item", () => {
    const markup = confirmDialogMarkup(IMPORT);
    for (const text of ["目前資料", "128 句完成", "匯入資料", "94 句完成"]) {
      expect(markup).toContain(text);
    }
  });

  it("omits the note element when there is nothing to add", () => {
    expect(confirmDialogMarkup(RESET)).toContain("已下載的存檔檔案不受影響。");
    expect(confirmDialogMarkup(IMPORT)).not.toContain("confirm-note");
  });

  // The other half -- that the element actually carries the matching
  // `aria-labelledby` -- is asserted against a built dialog in
  // `app-shell.test.ts`, where the attribute exists rather than being described.
  it("labels the dialog by the title it renders", () => {
    expect(confirmDialogMarkup(RESET)).toContain('id="confirm-dialog-title"');
  });

  it("escapes text rather than trusting it as markup", () => {
    const markup = confirmDialogMarkup({
      ...RESET,
      title: "<script>x</script>",
      sections: [{ heading: "a<b", items: ["c&d"] }],
    });
    expect(markup).not.toContain("<script>");
    expect(markup).toContain("a&lt;b");
    expect(markup).toContain("c&amp;d");
  });
});

/*
 * The top layer is what makes a native dialog worth using and is also what a
 * shim cannot reproduce: a backdrop, inertness behind it, and focus containment
 * are the platform's, and a shim that reported them would only produce tests
 * that pass for the wrong reason. That reasoning is unchanged. What has changed
 * is that the half of the Escape rule which is application code -- the capture
 * listener that keeps the event away from the shell's own handler -- is now
 * driven against a running shell in `app-shell.test.ts`, and that test was
 * checked to go red when the interception is removed.
 *
 * What stays here is the rule that no behaviour can demonstrate: containment is
 * delegated rather than hand-rolled. Absence of a focus trap is not observable
 * by testing -- a correct trap and a delegated one behave identically under a
 * shim that implements neither -- so it is pinned to the source, and the rest is
 * in the manual protocol.
 */
describe("confirmation containment", () => {
  it("leaves modal containment to the platform", () => {
    expect(code).toContain("showModal()");
    expect(code).not.toContain('"Tab"');
    expect(code).not.toContain("inert");
  });

  // Preventing the default would keep the browser from closing the top dialog,
  // which is the one part of the rule the platform performs.
  it("stops propagation without cancelling the browser's own close", () => {
    const start = code.indexOf("const interceptEscape");
    expect(code.slice(start, code.indexOf("};", start))).not.toContain("preventDefault");
  });
});
