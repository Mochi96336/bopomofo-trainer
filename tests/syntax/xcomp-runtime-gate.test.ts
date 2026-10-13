import { describe, expect, it } from "vitest";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { VALENCY_FRAMES } from "../../src/syntax/types.js";

describe("xcomp controller-typed runtime gate", () => {
  it("requires no controller-specific frame in the executable grammar", () => {
    const requiredFrames = FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents.flatMap((item) => item.requiredValencyFrames));

    expect(requiredFrames).not.toContain("subject-controlled-open-complement");
    expect(requiredFrames).not.toContain("object-controlled-open-complement");
  });

  it("keeps reserved controller frame values without renumbering the compact wire table", () => {
    expect(VALENCY_FRAMES.slice(0, 12)).toEqual([
      "avalent",
      "intransitive",
      "transitive",
      "ditransitive",
      "ambitransitive",
      "copular",
      "clausal-complement",
      "open-clausal-complement",
      "adpositional-complement",
      "serial-verb",
      "causative",
      "resultative",
    ]);
    expect(VALENCY_FRAMES.slice(12)).toEqual([
      "subject-controlled-open-complement",
      "object-controlled-open-complement",
    ]);
  });
});
