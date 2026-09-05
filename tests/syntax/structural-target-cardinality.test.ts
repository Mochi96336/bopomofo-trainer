import { describe, expect, it } from "vitest";
import type { RandomSource } from "../../src/core/model.js";
import { countStructuralDerivationShapes } from "../../src/syntax/count.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import {
  sampleStructuralDerivation,
  type NestedProductionTarget,
} from "../../src/syntax/sample.js";
import type {
  ProductionConstituent,
  ProductionRule,
  SyntaxCategory,
  Upos,
} from "../../src/syntax/types.js";

class ConstantRandom implements RandomSource {
  constructor(private readonly value: number) {}
  next(): number { return this.value; }
}

function constituent(
  key: string,
  category: SyntaxCategory,
  minimum = 1,
  maximum = 1,
  allowedUpos: readonly Upos[] = [],
): ProductionConstituent {
  return {
    key,
    category,
    minimum,
    maximum,
    recursive: false,
    allowedUpos,
    requiredFunctions: [],
    requiredValencyFrames: [],
    requiredFeatures: {},
  };
}

function production(
  id: string,
  output: SyntaxCategory,
  constituents: readonly ProductionConstituent[],
): ProductionRule {
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output,
    constituents,
    surfaceOrders: [{ id: "canonical", constituentKeys: constituents.map((item) => item.key) }],
    constraints: [],
    positiveFixtureIds: [`${id}:positive`],
    negativeFixtureIds: [`${id}:negative`],
  };
}

const predicateRule = production("predicate.expanded", "Predicate", [
  constituent("negation", "Lexeme", 0, 1, ["ADV"]),
  constituent("modal", "Lexeme", 0, 2, ["AUX"]),
  constituent("head", "Lexeme", 1, 1, ["VERB"]),
  constituent("aspect", "Lexeme", 0, 1, ["PART"]),
]);

const rules: readonly ProductionRule[] = [
  production("sentence.wrapper", "Sentence", [constituent("clause", "Clause")]),
  production("clause.core", "Clause", [constituent("predicate", "Predicate")]),
  predicateRule,
];

const pathTargets: readonly NestedProductionTarget[] = [
  { parentRuleId: "sentence.wrapper", constituentKey: "clause", childRuleId: "clause.core" },
  { parentRuleId: "clause.core", constituentKey: "predicate", childRuleId: "predicate.expanded" },
];

describe("structural constituent count targets", () => {
  it("forces optional lexical marking counts without changing production targeting", () => {
    const targets: readonly NestedProductionTarget[] = [
      ...pathTargets,
      { parentRuleId: "predicate.expanded", constituentKey: "negation", exactCount: 1 },
      { parentRuleId: "predicate.expanded", constituentKey: "modal", exactCount: 2 },
      { parentRuleId: "predicate.expanded", constituentKey: "aspect", exactCount: 1 },
    ];
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      random: new ConstantRandom(0),
      maximumAttempts: 1,
      rootProductionRuleId: "sentence.wrapper",
      nestedProductionTargets: targets,
    });

    expect(shape?.productionRulePath).toEqual([
      "sentence.wrapper",
      "clause.core",
      "predicate.expanded",
    ]);
    expect(shape?.lexicalSlots.map((slot) => slot.constituentKey)).toEqual([
      "negation", "modal", "modal", "head", "aspect",
    ]);
    expect(countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules,
      rootProductionRuleId: "sentence.wrapper",
      nestedProductionTargets: targets,
    })).toBe("1");
  });

  it("can explicitly suppress optional constituents while untargeted sampling stays unchanged", () => {
    const untargeted = sampleStructuralDerivation({
      rootCategory: "Predicate",
      rules: [predicateRule],
      random: new ConstantRandom(0.99),
      maximumAttempts: 1,
      rootProductionRuleId: "predicate.expanded",
    });
    expect(untargeted?.lexicalSlots.map((slot) => slot.constituentKey)).toEqual([
      "negation", "modal", "modal", "head", "aspect",
    ]);
    expect(countStructuralDerivationShapes({
      rootCategory: "Predicate",
      rules: [predicateRule],
      rootProductionRuleId: "predicate.expanded",
    })).toBe("12");

    const suppressed = sampleStructuralDerivation({
      rootCategory: "Predicate",
      rules: [predicateRule],
      random: new ConstantRandom(0.99),
      maximumAttempts: 1,
      rootProductionRuleId: "predicate.expanded",
      nestedProductionTargets: [
        { parentRuleId: "predicate.expanded", constituentKey: "negation", exactCount: 0 },
        { parentRuleId: "predicate.expanded", constituentKey: "modal", exactCount: 0 },
        { parentRuleId: "predicate.expanded", constituentKey: "aspect", exactCount: 0 },
      ],
    });
    expect(suppressed?.lexicalSlots.map((slot) => slot.constituentKey)).toEqual(["head"]);
  });

  it("fails closed on malformed count targets in sampler and exact counter", () => {
    const invalidTargets: readonly (readonly NestedProductionTarget[])[] = [
      [{ parentRuleId: "predicate.expanded", constituentKey: "negation" }],
      [{ parentRuleId: "predicate.expanded", constituentKey: "negation", exactCount: 2 }],
      [{ parentRuleId: "predicate.expanded", constituentKey: "negation", exactCount: 0.5 }],
      [
        { parentRuleId: "predicate.expanded", constituentKey: "negation", exactCount: 0 },
        { parentRuleId: "predicate.expanded", constituentKey: "negation", exactCount: 1 },
      ],
    ];

    for (const nestedProductionTargets of invalidTargets) {
      expect(() => sampleStructuralDerivation({
        rootCategory: "Predicate",
        rules: [predicateRule],
        random: new ConstantRandom(0),
        rootProductionRuleId: "predicate.expanded",
        nestedProductionTargets,
      })).toThrow();
      expect(() => countStructuralDerivationShapes({
        rootCategory: "Predicate",
        rules: [predicateRule],
        rootProductionRuleId: "predicate.expanded",
        nestedProductionTargets,
      })).toThrow();
    }
  });

  it("keeps child-production targets illegal on lexical constituents", () => {
    expect(() => sampleStructuralDerivation({
      rootCategory: "Predicate",
      rules,
      random: new ConstantRandom(0),
      rootProductionRuleId: "predicate.expanded",
      nestedProductionTargets: [{
        parentRuleId: "predicate.expanded",
        constituentKey: "head",
        childRuleId: "clause.core",
      }],
    })).toThrow(/lexical constituent/u);
  });
});
