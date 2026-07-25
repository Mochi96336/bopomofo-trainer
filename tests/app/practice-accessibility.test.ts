import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { practiceCurrentTargetText } from "../../src/app/practice-accessibility.js";

describe("practice keyboard accessibility", () => {
  it("describes the round, position, readable token, and physical key", () => {
    expect(practiceCurrentTargetText({
      roundNumber: 2,
      position: 4,
      total: 18,
      tokenLabel: "ㄓ",
      physicalKeyLabel: "5",
    })).toBe("第 2 句，位置 4 / 18。目前注音 ㄓ，實體鍵 5。");
  });

  it("wires stable instructions and live target text to the capture textarea", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain('id="practice-input-instructions"');
    expect(html).toContain('id="practice-current-target"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('aria-describedby="practice-input-instructions practice-current-target"');
  });

  it("returns from Tab before dialog handling, input conversion, and preventDefault", () => {
    const source = readFileSync("src/app/main.ts", "utf8");
    const handler = source.slice(
      source.indexOf('capture.addEventListener("keydown"'),
      source.indexOf('document.addEventListener("keydown"'),
    );
    const tabGuard = handler.indexOf('if (event.key === "Tab") return;');
    expect(tabGuard).toBeGreaterThan(-1);
    expect(tabGuard).toBeLessThan(handler.indexOf("#information-dialog"));
    expect(tabGuard).toBeLessThan(handler.indexOf("keyboardEventToInput"));
    expect(handler).not.toContain('event.code === "Tab"');
  });

  it("does not use an unconditional window-focus capture handler", () => {
    const source = readFileSync("src/app/main.ts", "utf8");
    expect(source).not.toContain('window.addEventListener("focus", focusCapture)');
    expect(source).toContain('window.addEventListener("focus", () => focusCapture())');
  });
});
