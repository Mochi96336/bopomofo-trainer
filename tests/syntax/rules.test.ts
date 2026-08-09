import { describe, expect, it } from "vitest";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import {
  FORMAL_SYNTAX_FIXTURES,
  FORMAL_SYNTAX_RULES,
  PHRASE_PRODUCTION_RULES,
} from "../../src/syntax/rules.js";
import { UPOS_VALUES } from "../../src/syntax/types.js";
import { validateGrammarBundle } from "../../src/syntax/validate.js";

describe("formal phrase production inventory", () => {
  it("validates every rule and concrete positive/negative fixture", () => {
    expect(validateGrammarBundle(FORMAL_SYNTAX_RULES, FORMAL_SYNTAX_FIXTURES).errors)
      .toEqual([]);
  });

  it("makes all 17 UD UPOS values structurally reachable", () => {
    const reachable = new Set(PHRASE_PRODUCTION_RULES.flatMap((rule) =>
      rule.constituents.flatMap((item) => item.allowedUpos)));
    expect([...reachable].sort()).toEqual([...UPOS_VALUES].sort());
  });

  it("licenses classifiers through UD NOUN + clf evidence rather than PART", () => {
    const rule = PHRASE_PRODUCTION_RULES.find(
      (item) => item.id === "phrase.numeral.classifier",
    );
    const classifier = rule?.constituents.find((item) => item.key === "classifier");
    expect(classifier).toMatchObject({
      allowedUpos: ["NOUN"],
      requiredFunctions: ["classifier"],
    });
    expect(classifier?.allowedUpos).not.toContain("PART");
  });

  it("locks phrase repetition to the declared termination bounds", () => {
    const noun = PHRASE_PRODUCTION_RULES.find(
      (rule) => rule.id === "phrase.noun.expanded",
    );
    const verb = PHRASE_PRODUCTION_RULES.find(
      (rule) => rule.id === "phrase.verb.expanded",
    );
    expect(noun?.constituents.find((item) => item.key === "modifier")?.maximum)
      .toBe(3);
    expect(verb?.constituents.find((item) => item.key === "adverbial")?.maximum)
      .toBe(3);
    expect(verb?.constituents.find((item) => item.key === "complement")?.maximum)
      .toBe(2);
  });

  it("fixtures exercise optional constituents both absent and maximally present", () => {
    const minimum = FORMAL_SYNTAX_FIXTURES.find(
      (fixture) => fixture.id === "phrase.verb.expanded:minimum",
    );
    const maximum = FORMAL_SYNTAX_FIXTURES.find(
      (fixture) => fixture.id === "phrase.verb.expanded:maximum",
    );
    expect(minimum?.constituentCounts).toMatchObject({
      negation: 0,
      modal: 0,
      adverbial: 0,
      complement: 0,
      object: 0,
      aspect: 0,
    });
    expect(maximum?.constituentCounts).toMatchObject({
      negation: 1,
      modal: 2,
      adverbial: 3,
      complement: 2,
      object: 2,
      aspect: 1,
    });
  });

  it("does not inherit the phrase function through an adposition object", () => {
    // clause.locative requires an oblique AdpositionPhrase. The phrase is the
    // oblique; the noun inside 在<NP> is the object of the adposition and must
    // not be forced to have been observed as an oblique dependent itself.
    for (const ruleId of ["phrase.adposition.preposed", "phrase.adposition.postposed"]) {
      const rule = PHRASE_PRODUCTION_RULES.find((item) => item.id === ruleId);
      expect(rule, ruleId).toBeDefined();
      expect(rule?.constituents.find((item) => item.key === "object")?.inheritFunctions)
        .toBeUndefined();
    }
  });

  it("keeps oblique on the locative phrase without pushing it onto the noun", () => {
    const keep = new Set([
      "clause.locative",
      "phrase.adposition.preposed",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
    ]);
    const slots = [...enumerateStructuralDerivations({
      rootCategory: "Clause",
      rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
    })].flatMap((shape) => shape.lexicalSlots);
    const nounSlots = slots.filter((slot) => slot.allowedUpos.includes("NOUN"));
    expect(nounSlots.length).toBeGreaterThan(0);
    // The subject noun still carries its own subject requirement; no noun
    // anywhere in the derivation is forced to be an oblique dependent.
    expect(nounSlots.some((slot) => slot.requiredFunctions.includes("oblique")))
      .toBe(false);
  });
});
