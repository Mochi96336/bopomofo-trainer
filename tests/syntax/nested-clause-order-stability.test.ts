import { describe, expect, it } from "vitest";
import type { RandomSource } from "../../src/core/model.js";
import {
  stableRuntimeDigestCanonicalJson,
  stableRuntimeDigestCanonicalJsonFirstUint32,
} from "../../src/core/stable-id.js";
import type { StructuralLexicalSlot } from "../../src/syntax/derive.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import {
  NESTED_CLAUSE_RULE_ORDER_VERSION,
  sampleStructuralDerivation,
} from "../../src/syntax/sample.js";
import type {
  ProductionConstituent,
  ProductionRule,
  SyntaxCategory,
  Upos,
} from "../../src/syntax/types.js";

class CountingSequenceRandom implements RandomSource {
  private index = 0;

  constructor(private readonly values: readonly number[]) {}

  get calls(): number {
    return this.index;
  }

  next(): number {
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }
}

function constituent(
  key: string,
  category: SyntaxCategory,
  allowedUpos: readonly Upos[] = category === "Lexeme" ? ["NOUN"] : [],
): ProductionConstituent {
  return {
    key,
    category,
    minimum: 1,
    maximum: 1,
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

const sentenceRule = production(
  "sentence.wrapper",
  "Sentence",
  [constituent("clause", "Clause")],
);
const clauseRules = ["alpha", "beta", "gamma"].map((name) =>
  production(`clause.${name}`, "Clause", [constituent("head", "Lexeme")]),
);
const rules = [sentenceRule, ...clauseRules];
const randomValues = [0.12, 0.34, 0.56, 0.78, 0.9, 0.11] as const;

type Reachability = (slot: StructuralLexicalSlot) => boolean;

function sampleWith(
  inputRules: readonly ProductionRule[],
  values: readonly number[] = randomValues,
  isLexicalSlotReachable?: Reachability,
) {
  const random = new CountingSequenceRandom(values);
  const shape = sampleStructuralDerivation({
    rootCategory: "Sentence",
    rootProductionRuleId: "sentence.wrapper",
    rules: inputRules,
    random,
    maximumAttempts: 1,
    ...(isLexicalSlotReachable === undefined ? {} : { isLexicalSlotReachable }),
  });
  expect(shape).not.toBeNull();
  return { shape: shape!, randomCalls: random.calls };
}

describe("nested Clause rule-order stability", () => {
  it("versions the fixed-cost keyed candidate-substream contract", () => {
    expect(NESTED_CLAUSE_RULE_ORDER_VERSION).toBe("stable-keyed-rule-substream-v2");
  });

  it("keeps the selected remaining rule and RNG trajectory when an unselected peer is removed", () => {
    const baseline = sampleWith(rules);
    const selectedClauseRuleId = baseline.shape.productionRulePath[1];
    expect(selectedClauseRuleId).toMatch(/^clause\./u);

    const removedRuleId = clauseRules
      .map((rule) => rule.id)
      .find((ruleId) => ruleId !== selectedClauseRuleId);
    expect(removedRuleId).toBeDefined();

    const reduced = sampleWith(rules.filter((rule) => rule.id !== removedRuleId));

    expect(reduced.shape.productionRulePath).toEqual(baseline.shape.productionRulePath);
    expect(reduced.shape.lexicalSlots).toEqual(baseline.shape.lexicalSlots);
    expect(reduced.randomCalls).toBe(baseline.randomCalls);
  });

  it("preserves full digest ordering when priority first lanes collide", () => {
  const collisionRuleIds = [
    "clause.collision.q2ht6isztaqs",
    "clause.collision.cdy5up25acqx",
  ] as const;
  const prioritySource = (ruleId: string) => JSON.stringify({
    purpose: "priority",
    ruleId,
    ticket: 0,
    version: NESTED_CLAUSE_RULE_ORDER_VERSION,
  });
  const firstLanes = collisionRuleIds.map((ruleId) =>
    stableRuntimeDigestCanonicalJsonFirstUint32(prioritySource(ruleId)),
  );
  expect(firstLanes[0]).toBe(firstLanes[1]);
  expect(firstLanes[0]!.toString(16).padStart(8, "0")).toBe("d80e15a2");

  const expectedRuleId = [...collisionRuleIds].sort((left, right) => {
    const digestOrder = stableRuntimeDigestCanonicalJson(prioritySource(left))
      .localeCompare(stableRuntimeDigestCanonicalJson(prioritySource(right)));
    return digestOrder !== 0 ? digestOrder : left.localeCompare(right);
  })[0];
  const collisionRules = collisionRuleIds.map((ruleId) =>
    production(ruleId, "Clause", [constituent("head", "Lexeme")]),
  );
  const sampled = sampleWith([sentenceRule, ...collisionRules], [0]);
  expect(sampled.shape.productionRulePath[1]).toBe(expectedRuleId);
});

  it("does not let a failed peer candidate consume the parent RNG trajectory", () => {
    const failed = production(
      "clause.failed",
      "Clause",
      [constituent("unreachable", "Lexeme", ["VERB"])],
    );
    const success = production(
      "clause.success",
      "Clause",
      [constituent("head", "Lexeme", ["NOUN"])],
    );
    const candidateRules = [sentenceRule, failed, success];
    const reachable: Reachability = (slot) => !slot.allowedUpos.includes("VERB");

    let observed: {
      readonly baseline: ReturnType<typeof sampleWith>;
      readonly reduced: ReturnType<typeof sampleWith>;
    } | null = null;

    for (let ticket = 1; ticket < 256; ticket += 1) {
      let failedVisits = 0;
      const values = [ticket / 256, 0.21, 0.43, 0.65, 0.87];
      const baseline = sampleWith(candidateRules, values, (slot) => {
        if (slot.allowedUpos.includes("VERB")) failedVisits += 1;
        return reachable(slot);
      });
      if (failedVisits === 0) continue;
      const reduced = sampleWith([sentenceRule, success], values, reachable);
      observed = { baseline, reduced };
      break;
    }

    expect(observed).not.toBeNull();
    expect(observed!.baseline.shape.productionRulePath).toEqual(
      observed!.reduced.shape.productionRulePath,
    );
    expect(observed!.baseline.shape.lexicalSlots).toEqual(observed!.reduced.shape.lexicalSlots);
    expect(observed!.baseline.randomCalls).toBe(observed!.reduced.randomCalls);
  });
});
