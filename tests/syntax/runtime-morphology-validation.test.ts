import { describe, expect, it } from "vitest";
import { validRuntimeMorphologicalFeatureCounts } from "../../src/syntax/runtime-morphology.js";

describe("runtime morphology trust boundary", () => {
  it("accepts absent or reviewed presence-only morphology maps", () => {
    expect(validRuntimeMorphologicalFeatureCounts(undefined)).toBe(true);
    expect(validRuntimeMorphologicalFeatureCounts({})).toBe(true);
    expect(validRuntimeMorphologicalFeatureCounts({ "Voice=Cau": 1 })).toBe(true);
  });

  it("fails closed on malformed non-map JSON values", () => {
    expect(validRuntimeMorphologicalFeatureCounts(null)).toBe(false);
    expect(validRuntimeMorphologicalFeatureCounts("Voice=Cau")).toBe(false);
    expect(validRuntimeMorphologicalFeatureCounts(1)).toBe(false);
    expect(validRuntimeMorphologicalFeatureCounts(true)).toBe(false);
    expect(validRuntimeMorphologicalFeatureCounts([])).toBe(false);
    expect(validRuntimeMorphologicalFeatureCounts([["Voice=Cau", 1]])).toBe(false);
  });

  it("still rejects unreviewed features and non-presence counts", () => {
    expect(validRuntimeMorphologicalFeatureCounts({ "Aspect=Perf": 1 })).toBe(false);
    expect(validRuntimeMorphologicalFeatureCounts({ "Voice=Cau": 0 })).toBe(false);
    expect(validRuntimeMorphologicalFeatureCounts({ "Voice=Cau": 2 })).toBe(false);
  });
});
