// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { keyboardMarkup } from "../../src/app/diagnostic-keyboard.js";
import { DEFAULT_DIAGNOSTIC_PREFERENCES } from "../../src/app/diagnostic-preferences.js";
import {
  KEYBOARD_GEOMETRY_ROWS,
  keyboardColumnSpan,
} from "../../src/app/keyboard-geometry.js";
import type { DiagnosticModel } from "../../src/diagnostics/types.js";
import { mountApp, type MountedApp } from "./app-harness.js";

/**
 * The practice hint and the diagnostic view draw the same physical keyboard.
 *
 * They used to do it from two copies of the row geometry, with two copies of the
 * column-span arithmetic. The copies happened to agree, and nothing would have
 * said so if they had stopped -- on the surface a learner uses to find which key
 * a token wants. They read one module now, and this is what reports it if a
 * second source is ever reintroduced.
 */

const EMPTY_MODEL: DiagnosticModel = {
  summary: { keysWithData: 0, repeatedConfusions: 0, slowerTransitions: 0 },
  keys: [],
  transitions: [],
  confusions: [],
  keyProgress: {},
};

function renderedKeys(host: ParentNode, selector: string): readonly (readonly [string, string])[] {
  return [...host.querySelectorAll<HTMLElement>(selector)].map((key) => [
    key.dataset.code ?? "",
    key.style.getPropertyValue("--key-columns"),
  ] as const);
}

describe("keyboard geometry agreement", () => {
  let mounted: MountedApp | null = null;

  it("draws the practice hint and the diagnostic keyboard from the same board", () => {
    const app = mountApp();
    mounted = app;
    try {
      app.openPanel();
      app.find<HTMLInputElement>("#toggle-keyboard-sketch").click();
      app.dialog.close();

      const sketch = renderedKeys(app.find("#keyboard-sketch"), ".keyboard-sketch-key");

      const diagnostic = document.createElement("div");
      diagnostic.innerHTML = keyboardMarkup(EMPTY_MODEL, DEFAULT_DIAGNOSTIC_PREFERENCES, {
        selectedKey: null,
        selectedRelationId: null,
      });
      const board = renderedKeys(diagnostic, ".diagnostic-keyboard-key");

      const expected = KEYBOARD_GEOMETRY_ROWS.flat()
        .map((key) => [key.code, String(keyboardColumnSpan(key))] as const);

      expect(sketch).toEqual(expected);
      expect(board).toEqual(expected);
    } finally {
      mounted?.destroy();
      mounted = null;
    }
  });
});
