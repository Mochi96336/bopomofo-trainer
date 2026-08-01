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

  // Tab handling and the window-focus handler are asserted against a running
  // shell in `app-shell.test.ts`, which can watch what they do rather than
  // check that the source still reads a particular way.
});
