import { describe, expect, it } from "vitest";
import type { RandomSource } from "../../src/core/model.js";
import { countStructuralDerivationShapes } from "../../src/syntax/count.js";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { buildSyntaxRuleIndex } from "../../src/syntax/rule-index.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import type {
  ProductionFixture,
  ProductionRule,
  RuntimeSyntaxProfile,
} from "../../src/syntax/types.js";
import { validateGrammar, validateGrammarBundle } from "../../src/syntax/validate.js";

class SequenceRandom implements RandomSource {
  private index = 0;
  public constructor(private readonly values: readonly number[]) {}
  public next(): number {
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }
}

const rule: ProductionRule = {
  id: "sentence.presence-constraints",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Sentence",
  constituents: [
    {
      key: "trigger",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
    {
      key: "requiredPeer",
      category: "Lexeme",
      minimum: 0,
      maximum: 1,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
    {
      key: "forbiddenPeer",
      category: "Lexeme",
      minimum: 0,
      maximum: 1,
      recursive: false,
      allowedUpos: ["NOUN"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    },
  ],
  surfaceOrders: [{
    id: "canonical",
    constituentKeys: ["trigger", "requiredPeer", "forbiddenPeer"],
  }],
  constraints: [
    {
      kind: "requires-constituent",
      ifPresentKey: "trigger",
      targetKey: "requiredPeer",
    },
    {
      kind: "forbids-cooccurrence",
      ifPresentKey: "trigger",
      targetKey: "forbiddenPeer",
    },
  ],
  positiveFixtureIds: ["presence:valid"],
  negativeFixtureIds: ["presence:missing-required", "presence:forbidden-cooccurrence"],
};

const fixtures: readonly ProductionFixture[] = [
  {
    id: "presence:valid",
    ruleId: rule.id,
    expected: "accept",
    surfaceOrderId: "canonical",
    constituentCounts: { trigger: 1, requiredPeer: 1, forbiddenPeer: 0 },
  },
  {
    id: "presence:missing-required",
    ruleId: rule.id,
    expected: "reject",
    surfaceOrderId: "canonical",
    constituentCounts: { trigger: 1, requiredPeer: 0, forbiddenPeer: 0 },
  },
  {
    id: "presence:forbidden-cooccurrence",
    ruleId: rule.id,
    expected: "reject",
    surfaceOrderId: "canonical",
    constituentCounts: { trigger: 1, requiredPeer: 1, forbiddenPeer: 1 },
  },
];

function profile(entryId: string): RuntimeSyntaxProfile {
  return {
    id: `profile:${entryId}`,
    entryId,
    upos: "NOUN",
    functions: [],
    valencyFrames: ["avalent"],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

describe("structural presence constraints", () => {
  it("accepts executable presence constraints and still rejects feature constraints", () => {
    expect(validateGrammarBundle([rule], fixtures).errors).toEqual([]);

    const featureConstrained: ProductionRule = {
      ...rule,
      id: "sentence.feature-constraint",
      constraints: [{
        kind: "feature-equals",
        constituentKey: "trigger",
        feature: "polarity",
        value: "negative",
      }],
      positiveFixtureIds: ["unused:positive"],
      negativeFixtureIds: ["unused:negative"],
    };
    expect(validateGrammar([featureConstrained]).errors.map((item) => item.code))
      .toContain("invalid-constraint");
  });

  it("enumerates and counts only the one valid presence shape", () => {
    const shapes = [...enumerateStructuralDerivations({ rootCategory: "Sentence", rules: [rule] })];
    expect(shapes).toHaveLength(1);
    expect(shapes[0]?.lexicalSlots.map((slot) => slot.constituentKey))
      .toEqual(["trigger", "requiredPeer"]);
    expect(countStructuralDerivationShapes({ rootCategory: "Sentence", rules: [rule] }))
      .toBe("1");
  });

  it("samples only a cardinality assignment that satisfies both constraints", () => {
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: [rule],
      random: new SequenceRandom([0, 0, 0.9, 0]),
      maximumAttempts: 1,
    });
    expect(shape?.lexicalSlots.map((slot) => slot.constituentKey))
      .toEqual(["trigger", "requiredPeer"]);
  });

  it("keeps rule-index reachability aligned with the executable presence shape", () => {
    const index = buildSyntaxRuleIndex({
      lexemes: [
        { id: "entry:a", text: "甲", generalRank: 1 },
        { id: "entry:b", text: "乙", generalRank: 2 },
      ],
      profiles: [profile("entry:a"), profile("entry:b")],
      rules: [rule],
    });

    const indexedRule = index.rules.find((item) => item.ruleId === rule.id);
    expect(indexedRule).toMatchObject({
      globallyRealizable: true,
      blockerConstituentKeys: [],
    });
    for (const entry of index.entries) {
      expect(entry.directPositionIds).toContain(`${rule.id}:trigger`);
      expect(entry.directPositionIds).toContain(`${rule.id}:requiredPeer`);
      expect(entry.directPositionIds).not.toContain(`${rule.id}:forbiddenPeer`);
    }
  });
});
