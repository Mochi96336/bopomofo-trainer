import { describe, expect, it } from "vitest";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { countStructuralDerivationShapes } from "../../src/syntax/count.js";
import type { ProductionRule } from "../../src/syntax/types.js";

const baseRules: readonly ProductionRule[] = [
  {
    id: "sentence.base",
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output: "Sentence",
    constituents: [{
      key: "noun",
      category: "NounPhrase",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: [],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    }],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["noun"] }],
    constraints: [],
    positiveFixtureIds: ["sentence.base:positive"],
    negativeFixtureIds: ["sentence.base:negative"],
  },
  {
    id: "noun.base",
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output: "NounPhrase",
    constituents: [{
      key: "head",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    }],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["head"] }],
    constraints: [],
    positiveFixtureIds: ["noun.base:positive"],
    negativeFixtureIds: ["noun.base:negative"],
  },
];

const alternateNounRule: ProductionRule = {
  ...baseRules[1]!,
  id: "noun.alternate",
  positiveFixtureIds: ["noun.alternate:positive"],
  negativeFixtureIds: ["noun.alternate:negative"],
};

const alternateSentenceRule: ProductionRule = {
  ...baseRules[0]!,
  id: "sentence.alternate",
  positiveFixtureIds: ["sentence.alternate:positive"],
  negativeFixtureIds: ["sentence.alternate:negative"],
};

describe("exact structural derivation shape counting", () => {
  it("counts the complete non-recursive closure without materializing shapes", () => {
    expect(countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules: baseRules,
    })).toBe("1");
  });

  it("counts every recursive depth variant exactly", () => {
    const recursive: ProductionRule = {
      ...baseRules[1]!,
      id: "noun.recursive",
      constituents: [{
        ...baseRules[0]!.constituents[0]!,
        category: "NounPhrase",
        recursive: true,
      }],
      surfaceOrders: [{ id: "canonical", constituentKeys: ["noun"] }],
      positiveFixtureIds: ["noun.recursive:positive"],
      negativeFixtureIds: ["noun.recursive:negative"],
    };
    expect(countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules: [...baseRules, recursive],
      bounds: {
        maximumPhraseDepth: 2,
        maximumClauseNesting: 1,
        maximumClausesPerSentence: 1,
        maximumCoordinationItems: 3,
        maximumConsecutiveModifiers: 3,
        maximumComplementsPerPredicate: 2,
        maximumLexicalEntriesPerUtterance: 12,
      },
    })).toBe("3");
  });

  it("narrows exact counting by root production without filtering descendant choices", () => {
    const rules = [...baseRules, alternateNounRule, alternateSentenceRule];
    expect(countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules,
    })).toBe("4");
    expect(countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules,
      rootProductionRuleId: "sentence.base",
    })).toBe("2");
  });

  it("targets one named child edge while leaving the same category otherwise general", () => {
    const rules = [...baseRules, alternateNounRule];
    expect(countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules,
      rootProductionRuleId: "sentence.base",
      nestedProductionTargets: [{
        parentRuleId: "sentence.base",
        constituentKey: "noun",
        childRuleId: "noun.alternate",
      }],
    })).toBe("1");
  });

  it("rejects malformed structural targets instead of silently counting another tree", () => {
    expect(() => countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules: baseRules,
      rootProductionRuleId: "noun.base",
    })).toThrow(/non-root production/u);

    expect(() => countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules: baseRules,
      nestedProductionTargets: [{
        parentRuleId: "sentence.base",
        constituentKey: "noun",
        childRuleId: "sentence.base",
      }],
    })).toThrow(/child category mismatch/u);
  });
});
