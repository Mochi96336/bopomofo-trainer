import { describe, expect, it } from "vitest";
import { validRuntimeOccurrenceCapabilities } from "../../src/syntax/runtime-occurrence-capabilities.js";

describe("runtime occurrence capability validation", () => {
  it("accepts missing evidence and the reviewed same-occurrence capability", () => {
    expect(validRuntimeOccurrenceCapabilities(undefined)).toBe(true);
    expect(validRuntimeOccurrenceCapabilities([])).toBe(true);
    expect(validRuntimeOccurrenceCapabilities(["voice-cau-ccomp-same-occurrence"])).toBe(true);
  });

  it("fails closed on malformed, duplicated, or unreviewed capabilities", () => {
    expect(validRuntimeOccurrenceCapabilities(null)).toBe(false);
    expect(validRuntimeOccurrenceCapabilities("voice-cau-ccomp-same-occurrence")).toBe(false);
    expect(validRuntimeOccurrenceCapabilities([
      "voice-cau-ccomp-same-occurrence",
      "voice-cau-ccomp-same-occurrence",
    ])).toBe(false);
    expect(validRuntimeOccurrenceCapabilities(["made-up-capability"])).toBe(false);
  });
});
