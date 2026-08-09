import { describe, expect, it } from "vitest";
import { ARGUMENT_PRODUCTION_RULES } from "../../src/syntax/argument-rules.js";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { syntaxProfileMatchesRequirements } from "../../src/syntax/profile-match.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

function nounProfile(functions: RuntimeSyntaxProfile["functions"]): RuntimeSyntaxProfile {
  return {
    id: `profile:noun:${functions.join("+")}`,
    entryId: "entry:noun",
    upos: "NOUN",
    functions,
    valencyFrames: ["avalent"],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function canonicalTransitiveSlots() {
  const keep = new Set([
    "clause.transitive",
    "argument.subject.noun",
    "argument.object.noun",
    "predicate.verb.lexical",
    "phrase.noun.bare",
    "phrase.nominal-head.noun",
  ]);
  const shapes = [...enumerateStructuralDerivations({
    rootCategory: "Clause",
    rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
  })];
  expect(shapes).toHaveLength(1);
  return shapes[0]!.lexicalSlots;
}

describe("Clause-model v2 structural nominal argument roles", () => {
  it("represents subject, object, and indirect object as wrapper categories", () => {
    expect(ARGUMENT_PRODUCTION_RULES.map((rule) => [rule.id, rule.output])).toEqual([
      ["argument.subject.noun", "Subject"],
      ["argument.object.noun", "Object"],
      ["argument.indirect-object.noun", "IndirectObject"],
    ]);
    for (const rule of ARGUMENT_PRODUCTION_RULES) {
      expect(rule.constituents).toEqual([
        expect.objectContaining({
          key: "phrase",
          category: "NounPhrase",
          requiredFunctions: [],
        }),
      ]);
      expect(rule.constituents[0]?.inheritFunctions).toBeUndefined();
    }
  });

  it("uses structural categories at the canonical transitive Clause boundary", () => {
    const transitive = FORMAL_SYNTAX_RULES.find((rule) => rule.id === "clause.transitive");
    expect(transitive?.constituents.map((item) => [item.key, item.category])).toEqual([
      ["subject", "Subject"],
      ["predicate", "Predicate"],
      ["object", "Object"],
    ]);
  });

  it("does not require a noun to have been observed in its target argument role", () => {
    const nominalSlots = canonicalTransitiveSlots()
      .filter((slot) => slot.allowedUpos.includes("NOUN"));
    expect(nominalSlots).toHaveLength(2);
    expect(nominalSlots.every((slot) => slot.requiredFunctions.length === 0)).toBe(true);

    const observedOnlyAsModifier = nounProfile(["modifier"]);
    expect(nominalSlots.every((slot) =>
      syntaxProfileMatchesRequirements(observedOnlyAsModifier, slot)
    )).toBe(true);
  });

  it("does not globally remove function gating from non-argument noun phrases", () => {
    const keep = new Set([
      "clause.nominal-predicate",
      "argument.subject.noun",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
    ]);
    const shapes = [...enumerateStructuralDerivations({
      rootCategory: "Clause",
      rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
    })];
    expect(shapes).toHaveLength(1);
    const nounSlots = shapes[0]!.lexicalSlots.filter((slot) => slot.allowedUpos.includes("NOUN"));
    expect(nounSlots).toHaveLength(2);
    expect(nounSlots.map((slot) => slot.requiredFunctions).sort((a, b) => a.length - b.length))
      .toEqual([[], ["predicate"]]);
  });
});
