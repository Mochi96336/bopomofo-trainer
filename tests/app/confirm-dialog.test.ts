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

  it("labels the dialog by the title it renders", () => {
    expect(confirmDialogMarkup(RESET)).toContain('id="confirm-dialog-title"');
    expect(source).toContain('dialog.setAttribute("aria-labelledby", CONFIRM_TITLE_ID)');
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
 * The top layer is what makes a native dialog worth using and is also what
 * cannot be reproduced here: this project runs Vitest under Node with no DOM,
 * and a DOM shim would report a backdrop, focus containment and stacking it does
 * not actually implement -- tests that pass for the wrong reason. The two rules
 * that would be silently lost in a rewrite are pinned to the source instead, and
 * everything they stand in for is in the manual protocol.
 */
describe("confirmation containment", () => {
  it("leaves modal containment to the platform", () => {
    expect(code).toContain("showModal()");
    expect(code).not.toContain('"Tab"');
    expect(code).not.toContain("inert");
  });

  // Stopping propagation without preventing the default is the whole rule:
  // the browser closes the top dialog, and the shell's document-level handler
  // never sees the event, so the panel underneath stays open.
  it("stops Escape from reaching the panel it is stacked over", () => {
    const start = code.indexOf("const interceptEscape");
    const intercept = code.slice(start, code.indexOf("};", start));

    expect(intercept).toContain("event.stopImmediatePropagation()");
    expect(intercept).not.toContain("preventDefault");
    expect(code).toContain('window.addEventListener("keydown", interceptEscape, { capture: true })');
  });
});
