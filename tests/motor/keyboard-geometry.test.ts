import { describe, expect, it } from "vitest";
import {
  assignedHandForCode,
  physicalKeyErgonomics,
} from "../../src/motor/keyboard-geometry.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";

describe("keyboard hand geometry", () => {
  it("classifies conventional left, right, ambiguous, and unknown keys", () => {
    expect(assignedHandForCode("KeyV")).toBe("left");
    expect(assignedHandForCode("KeyJ")).toBe("right");
    expect(assignedHandForCode("Space")).toBe("ambiguous");
    expect(assignedHandForCode("F13")).toBe("unknown");
    expect(physicalKeyErgonomics("KeyV")).toEqual({
      code: "KeyV",
      assignedHand: "left",
    });
  });

  it("has an explicit geometry decision for every standard Bopomofo binding", () => {
    const unknownCodes = Object.keys(STANDARD_BOPOMOFO_LAYOUT.bindings)
      .filter((code) => assignedHandForCode(code) === "unknown");

    expect(unknownCodes).toEqual([]);
  });
});
