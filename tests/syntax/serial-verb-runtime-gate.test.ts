import { describe, expect, it } from "vitest";
import { RETIRED_CLAUSE_RULE_V2_DECISIONS } from "../../src/syntax/clause-model-v2.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { VALENCY_FRAMES } from "../../src/syntax/types.js";

describe("retired generic serial-verb grammar", () => {
  it("has no executable generic VP + VP Clause consumer", () => {
    expect(FORMAL_SYNTAX_RULES.some((rule) => rule.id === "clause.serial-verb"))
      .toBe(false);
    const consumers = FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents
        .filter((item) => item.requiredValencyFrames.includes("serial-verb"))
        .map((item) => `${rule.id}:${item.key}`),
    );
    expect(consumers).toEqual([]);
  });

  it("records the source-backed ownership split instead of inventing a serial frame", () => {
    expect(RETIRED_CLAUSE_RULE_V2_DECISIONS["clause.serial-verb"]).toMatchObject({
      targetAxes: ["predicate-structure", "embedding"],
      evidenceContract: "pinned-gsd-direct-verb-pair-inventory-v1",
    });
  });

  it("keeps the legacy wire value reserved without renumbering later frames", () => {
    expect(VALENCY_FRAMES.slice(9, 14)).toEqual([
      "serial-verb",
      "causative",
      "resultative",
      "subject-controlled-open-complement",
      "object-controlled-open-complement",
    ]);
  });
});
