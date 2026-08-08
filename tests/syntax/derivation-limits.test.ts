import { describe, expect, it } from "vitest";
import type { RandomSource } from "../../src/core/model.js";
import { countStructuralDerivationShapes } from "../../src/syntax/count.js";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { PHRASE_PRODUCTION_RULES } from "../../src/syntax/grammar.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import type {
  ConstituentCardinalityBound,
  DerivationBounds,
  ProductionRule,
} from "../../src/syntax/types.js";

class ConstantRandom implements RandomSource {
  public constructor(private readonly value: number) {}
  public next(): number {
    return this.value;
  }
}

const BASE_BOUNDS: DerivationBounds = {
  maximumPhraseDepth: 4,
  maximumClauseNesting: 3,
  maximumClausesPerSentence: 4,
  maximumCoordinationItems: 3,
  maximumConsecutiveModifiers: 3,
  maximumComplementsPerPredicate: 2,
  maximumLexicalEntriesPerUtterance: 12,
};

function repeatedRule(
  cardinalityBound: ConstituentCardinalityBound,
): ProductionRule {
  return {
    id: `sentence.${cardinalityBound}`,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output: "Sentence",
    constituents: [{
      key: "item",
      category: "Lexeme",
      minimum: 0,
      maximum: 3,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
      cardinalityBound,
    }],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["item"] }],
    constraints: [],
    positiveFixtureIds: ["positive"],
    negativeFixtureIds: ["negative"],
  };
}

function coordinationRule(id: string, items: number): ProductionRule {
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output: "Sentence",
    constituents: [{
      key: "item",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    }],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["item"] }],
    constraints: [],
    positiveFixtureIds: ["positive"],
    negativeFixtureIds: ["negative"],
    ruleClass: "coordination",
    coordinationItems: items,
  };
}

function shapes(rules: readonly ProductionRule[], bounds: DerivationBounds): number {
  return [...enumerateStructuralDerivations({ rootCategory: "Sentence", rules, bounds })].length;
}

describe("executable derivation limits", () => {
  it("caps repeated modifier cardinality in sampling, enumeration, and exact counting", () => {
    const rules = [repeatedRule("consecutive-modifiers")];
    const tight = { ...BASE_BOUNDS, maximumConsecutiveModifiers: 1 };
    const wide = { ...BASE_BOUNDS, maximumConsecutiveModifiers: 3 };

    expect(shapes(rules, tight)).toBe(2);
    expect(shapes(rules, wide)).toBe(4);
    expect(countStructuralDerivationShapes({ rootCategory: "Sentence", rules, bounds: tight })).toBe("2");
    expect(countStructuralDerivationShapes({ rootCategory: "Sentence", rules, bounds: wide })).toBe("4");
    expect(sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      bounds: tight,
      random: new ConstantRandom(0.999),
    })?.lexicalSlotCount).toBe(1);
    expect(sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      bounds: wide,
      random: new ConstantRandom(0.999),
    })?.lexicalSlotCount).toBe(3);
  });

  it("caps complements independently from modifier cardinality", () => {
    const rules = [repeatedRule("complements-per-predicate")];
    const tight = { ...BASE_BOUNDS, maximumComplementsPerPredicate: 1 };
    const wide = { ...BASE_BOUNDS, maximumComplementsPerPredicate: 3 };
    expect(shapes(rules, tight)).toBe(2);
    expect(shapes(rules, wide)).toBe(4);
    expect(countStructuralDerivationShapes({ rootCategory: "Sentence", rules, bounds: tight })).toBe("2");
    expect(countStructuralDerivationShapes({ rootCategory: "Sentence", rules, bounds: wide })).toBe("4");
  });

  it("removes over-limit coordination productions before derivation", () => {
    const rules = [coordinationRule("sentence.coord.two", 2), coordinationRule("sentence.coord.three", 3)];
    const two = { ...BASE_BOUNDS, maximumCoordinationItems: 2 };
    const three = { ...BASE_BOUNDS, maximumCoordinationItems: 3 };
    expect(shapes(rules, two)).toBe(1);
    expect(shapes(rules, three)).toBe(2);
    expect(countStructuralDerivationShapes({ rootCategory: "Sentence", rules, bounds: two })).toBe("1");
    expect(countStructuralDerivationShapes({ rootCategory: "Sentence", rules, bounds: three })).toBe("2");
  });

  it("marks real phrase coordination as flat two- and three-item productions", () => {
    const nounRules = PHRASE_PRODUCTION_RULES
      .filter((rule) => rule.id.startsWith("phrase.noun.coordination"));
    expect(nounRules.map((rule) => [rule.id, rule.ruleClass, rule.coordinationItems])).toEqual([
      ["phrase.noun.coordination", "coordination", 2],
      ["phrase.noun.coordination.three", "coordination", 3],
    ]);
    expect(nounRules.flatMap((rule) => rule.constituents)
      .filter((item) => item.category === "NounPhrase")
      .every((item) => item.excludedRuleClasses?.includes("coordination"))).toBe(true);
  });
});
