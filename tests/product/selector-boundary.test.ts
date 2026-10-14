import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("production selector boundary", () => {
  it("does not import legacy Measurement V1 or transition compatibility", () => {
    const source = readFileSync("src/curriculum/frequency-first-utterance.ts", "utf8");
    expect(source).not.toMatch(/from "\.\.\/measurement\//u);
    expect(source).not.toContain("transitionScopeKey");
    expect(source).not.toContain("MeasurementSummary");
    expect(source).not.toContain("legacyTransitions");
  });

  it("keeps the browser product on the current selector module", () => {
    const source = readFileSync("src/product/session.ts", "utf8");
    expect(source).toContain('from "../curriculum/frequency-first-utterance.js"');
    expect(source).not.toContain("legacy-frequency-first-utterance");
  });
});
