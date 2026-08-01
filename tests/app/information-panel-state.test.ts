import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  actionApplied,
  actionFailed,
  NO_ACTION_STATUS,
  panelActionStatusMarkup,
  rarityProgressText,
} from "../../src/app/information-panel-model.js";

describe("panel action status", () => {
  // A live region added along with its first message is announced unreliably:
  // the region has to be there before the text changes for the change to be a
  // change. Keeping it also stops the controls above it from moving.
  it("renders its region whether or not it has anything to say", () => {
    const empty = panelActionStatusMarkup("tuning-notice", NO_ACTION_STATUS);
    expect(empty).toContain('id="tuning-notice"');
    expect(empty).toContain('role="status"');
    expect(empty).toContain('aria-atomic="true"');
    expect(empty).not.toContain("hidden");
    expect(empty).toContain("></output>");
  });

  it("marks a failure and leaves a completed action unmarked", () => {
    expect(panelActionStatusMarkup("x", actionFailed("本次已套用，但無法保存。")))
      .toContain('class="panel-action-status failed"');
    expect(panelActionStatusMarkup("x", actionApplied("下一題生效")))
      .toContain('class="panel-action-status"');
  });

  // Colour is not the only difference: a failure says so in words, so the
  // message alone still distinguishes the two.
  it("says what happened rather than relying on the mark", () => {
    expect(actionFailed("本次已套用，但無法保存。").message).toContain("無法保存");
    expect(actionApplied("下一題生效").message).toBe("下一題生效");
  });

  it("escapes a message rather than trusting it as markup", () => {
    expect(panelActionStatusMarkup("x", actionApplied("<b>x</b>")))
      .toContain("&lt;b&gt;x&lt;/b&gt;");
  });
});

describe("rarity progress", () => {
  it("counts practised keys against what the next level asks for", () => {
    expect(rarityProgressText({ practisedKeys: 3, requiredKeys: 8 }, false)).toBe("3/8");
  });

  it("says so when nothing is left to unlock", () => {
    expect(rarityProgressText(null, false)).toBe("全部已解鎖");
  });

  // The review override opens the marks without earning them, so the count
  // stays honest and says which one it is.
  it("keeps the honest count under the review override", () => {
    expect(rarityProgressText({ practisedKeys: 3, requiredKeys: 8 }, true))
      .toBe("檢視用開放 · 3/8");
    expect(rarityProgressText(null, true)).toBe("全部已解鎖");
  });
});

// Where the unlock count and the action status end up, whether a status
// survives the visit that produced it, and whether the storage warning stands
// apart from both, are all asserted against a running shell in
// `app-shell.test.ts`.

const css = readFileSync("src/app/style.css", "utf8");

describe("panel status styling", () => {
  it("names only colours the theme already defines", () => {
    const start = css.indexOf(".panel-action-status {");
    const rules = css.slice(start, css.indexOf("\n}", css.indexOf("#data-notice")));
    expect(rules).not.toMatch(/#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/);
    expect(rules).toContain("var(--ink-muted)");
    expect(rules).toContain("var(--danger)");
  });

  // Without a reserved line the buttons above shift the moment a reply arrives.
  it("reserves the line before there is anything in it", () => {
    expect(css).toMatch(/\.panel-action-status \{[^}]*min-height:/);
  });
});
