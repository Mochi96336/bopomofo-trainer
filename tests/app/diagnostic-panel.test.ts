import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  inspectorToolbarMarkup,
  nextSegmentIndex,
} from "../../src/app/diagnostic-panel.js";
import {
  DEFAULT_DIAGNOSTIC_PREFERENCES,
  type DiagnosticPreferences,
} from "../../src/app/diagnostic-preferences.js";

function toolbar(preferences: Partial<DiagnosticPreferences> = {}): string {
  return inspectorToolbarMarkup({ ...DEFAULT_DIAGNOSTIC_PREFERENCES, ...preferences });
}

describe("diagnostic sort semantics", () => {
  it("is a named group of alternatives, not a row of switches", () => {
    const markup = toolbar({ activeTab: "key" });
    expect(markup).toContain('role="radiogroup"');
    expect(markup).toContain('aria-label="排序"');
    expect(markup.match(/role="radio"/g)).toHaveLength(2);
  });

  // aria-pressed says each button switches on its own. These do not: choosing
  // one releases the other, and there is no state where both or neither applies.
  it("no longer describes the options as independently pressable", () => {
    expect(toolbar({ activeTab: "key" })).not.toContain("aria-pressed");
  });

  it("checks exactly the option in effect", () => {
    const byError = toolbar({ activeTab: "key", keySort: "error-ratio" });
    expect(byError).toContain('data-value="error-ratio" aria-checked="true"');
    expect(byError).toContain('data-value="timing" aria-checked="false"');

    const byTiming = toolbar({ activeTab: "key", keySort: "timing" });
    expect(byTiming).toContain('data-value="error-ratio" aria-checked="false"');
    expect(byTiming).toContain('data-value="timing" aria-checked="true"');
  });

  // One tab stop for the group: reaching a pair of alternatives should not cost
  // one Tab press per alternative.
  it("gives the group a single tab stop, on the checked option", () => {
    const markup = toolbar({ activeTab: "key", keySort: "timing" });
    expect(markup).toContain('aria-checked="true" tabindex="0"');
    expect(markup).toContain('aria-checked="false" tabindex="-1"');
    expect(markup.match(/tabindex="0"/g)).toHaveLength(1);
  });

  // The sort basis is what the key list means; the other tabs have no such
  // choice to offer, and inventing an empty group for them would be worse.
  it("offers the row only on the tab whose list it sorts", () => {
    expect(toolbar({ activeTab: "transition" })).toBe("");
    expect(toolbar({ activeTab: "confusion" })).toBe("");
  });
});

describe("segment navigation", () => {
  it("moves forward on the keys that mean next", () => {
    expect(nextSegmentIndex("ArrowRight", 0, 2)).toBe(1);
    expect(nextSegmentIndex("ArrowDown", 0, 2)).toBe(1);
  });

  it("moves back on the keys that mean previous", () => {
    expect(nextSegmentIndex("ArrowLeft", 1, 2)).toBe(0);
    expect(nextSegmentIndex("ArrowUp", 1, 2)).toBe(0);
  });

  // With two options every arrow reaches the other one, so neither end is a
  // dead stop the learner has to back out of.
  it("wraps at both ends", () => {
    expect(nextSegmentIndex("ArrowRight", 1, 2)).toBe(0);
    expect(nextSegmentIndex("ArrowLeft", 0, 2)).toBe(1);
  });

  it("jumps to either end", () => {
    expect(nextSegmentIndex("Home", 1, 2)).toBe(0);
    expect(nextSegmentIndex("End", 0, 2)).toBe(1);
  });

  it("declines keys that are not navigation", () => {
    for (const key of ["Enter", " ", "Escape", "Tab", "a", "PageDown"]) {
      expect(nextSegmentIndex(key, 0, 2)).toBeNull();
    }
  });

  it("declines a group it cannot navigate", () => {
    expect(nextSegmentIndex("ArrowRight", 0, 0)).toBeNull();
    expect(nextSegmentIndex("ArrowRight", -1, 2)).toBeNull();
  });
});

/*
 * The handler that binds the two together needs a DOM and an open analysis,
 * neither of which exists under Vitest in Node. What a rewrite could silently
 * drop is pinned to the source instead, with comments stripped so that the
 * prose explaining a rule cannot be mistaken for a breach of it.
 */
const code = readFileSync("src/app/diagnostic-panel.ts", "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^[ \t]*\/\/.*$/gm, "");

describe("sort keyboard wiring", () => {
  it("routes pointer and keyboard through one selection", () => {
    const radioBranch = code.slice(
      code.indexOf('if (role === "radio")'),
      code.indexOf('if (role !== "tab") return;'),
    );
    expect(code).toContain("const selectKeySort =");
    expect(radioBranch).toContain("selectKeySort(value)");
    // Not a second copy of persist-then-render: an arrow key and a click have
    // to leave the same state behind, including what was written to storage.
    expect(radioBranch).not.toContain("persist()");
    expect(radioBranch).not.toContain("render()");
  });

  it("returns focus to the option that is now checked", () => {
    expect(code).toContain(
      `host.querySelector<HTMLButtonElement>('[data-action="key-sort"][aria-checked="true"]')`,
    );
  });

  // The tab list keeps its own key handling. Radios answer to four arrows and
  // a horizontal tab list to two, so sharing the mapping would have quietly
  // changed what the tabs respond to.
  it("leaves the tab list's own navigation alone", () => {
    const tabs = code.slice(code.indexOf('if (role !== "tab") return;'));
    expect(tabs).toContain('if (event.key === "ArrowRight")');
    expect(tabs).toContain('if (event.key === "ArrowLeft")');
    expect(tabs).toContain('if (event.key === "Home")');
    expect(tabs).toContain('if (event.key === "End")');
    expect(tabs).not.toContain("nextSegmentIndex");
  });
});
