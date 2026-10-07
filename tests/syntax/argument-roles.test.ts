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
  expect(shapes).toHaveLength(4);
  const overt = shapes.find((shape) =>
    shape.productionRulePath.includes("argument.subject.noun")
      && shape.productionRulePath.includes("argument.object.noun")
  );
  expect(overt).toBeDefined();
  return overt!.lexicalSlots;
}

describe("Clause-model v2 structural argument roles", () => {
  it("represents ordinary and construction-specific argument roles as wrapper categories", () => {
    expect(ARGUMENT_PRODUCTION_RULES.map((rule) => [rule.id, rule.output])).toEqual([
      ["argument.subject.noun", "Subject"],
      ["argument.subject.clause", "Subject"],
      ["argument.object.noun", "Object"],
      ["argument.indirect-object.noun", "IndirectObject"],
      ["argument.disposal-patient.noun", "DisposalPatient"],
      ["argument.passive-agent.noun", "PassiveAgent"],
    ]);

    const nominalRules = ARGUMENT_PRODUCTION_RULES
      .filter((rule) => rule.id !== "argument.subject.clause");
    for (const rule of nominalRules) {
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

  it("adds clausal Subject as a recursive structural role without a corpus-role gate", () => {
    const clausal = ARGUMENT_PRODUCTION_RULES
      .find((rule) => rule.id === "argument.subject.clause");
    expect(clausal?.constituents).toEqual([
      expect.objectContaining({
        key: "clause",
        category: "ContentClause",
        recursive: true,
        requiredFunctions: [],
      }),
    ]);
    expect(clausal?.constituents[0]?.inheritFunctions).toBeUndefined();
  });

  it("uses the shared Subject category across ordinary core predicate frames", () => {
    const coreWithSubject = [
      "clause.nominal-predicate",
      "clause.adjective-predicate",
      "clause.intransitive",
      "clause.transitive",
      "clause.ditransitive",
      "clause.copular",
    ] as const;
    for (const ruleId of coreWithSubject) {
      const rule = FORMAL_SYNTAX_RULES.find((item) => item.id === ruleId);
      expect(rule?.constituents.find((item) => item.key === "subject")?.category, ruleId)
        .toBe("Subject");
    }
  });

  it("does not leak the structural Subject role into the embedded predicate", () => {
    const keep = new Set([
      "argument.subject.clause",
      "content.clause",
      "clause.intransitive",
      "predicate.verb.lexical",
    ]);
    const shapes = [...enumerateStructuralDerivations({
      rootCategory: "Subject",
      rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
    })];
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.productionRulePath).toEqual([
      "argument.subject.clause",
      "content.clause",
      "clause.intransitive",
      "predicate.verb.lexical",
    ]);
    expect(shapes[0]?.lexicalSlots).toEqual([
      expect.objectContaining({
        allowedUpos: ["VERB"],
        requiredFunctions: [],
        requiredValencyFrames: ["ambitransitive", "intransitive"],
      }),
    ]);
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
