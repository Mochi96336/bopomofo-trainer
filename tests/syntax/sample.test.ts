import { describe, expect, it } from "vitest";
import type { RandomSource } from "../../src/core/model.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import type { ProductionRule } from "../../src/syntax/types.js";

class SequenceRandom implements RandomSource {
  private index = 0;
  constructor(private readonly values: readonly number[]) {}
  next(): number {
    const value = this.values[this.index % this.values.length] ?? 0;
    this.index += 1;
    return value;
  }
}

const rules: readonly ProductionRule[] = [
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

describe("random structural sampling", () => {
  it("samples a deterministic shape from an injected random source", () => {
    const first = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      random: new SequenceRandom([0]),
    });
    const second = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      random: new SequenceRandom([0]),
    });
    expect(first).toEqual(second);
    expect(first?.lexicalSlots[0]?.allowedUpos).toEqual(["NOUN"]);
  });

  it("propagates transitive valency while keeping observed root role out of the lexical head", () => {
    const keep = new Set([
      "sentence.declarative",
      "clause.transitive",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
      "predicate.verb.lexical",
    ]);
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
      random: new SequenceRandom([0]),
      maximumAttempts: 1,
    });
    expect(shape?.lexicalSlots).toHaveLength(3);
    expect(shape?.lexicalSlots[0]).toMatchObject({
      allowedUpos: ["NOUN"],
      requiredFunctions: ["subject"],
    });
    expect(shape?.lexicalSlots[1]).toMatchObject({
      allowedUpos: ["VERB"],
      requiredFunctions: [],
      requiredValencyFrames: ["ambitransitive", "transitive"],
    });
    expect(shape?.lexicalSlots[2]).toMatchObject({
      allowedUpos: ["NOUN"],
      requiredFunctions: ["object"],
    });
  });

  it("prunes a shape as soon as a lexical requirement is unreachable", () => {
    const keep = new Set([
      "sentence.declarative",
      "clause.transitive",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
      "predicate.verb.lexical",
    ]);
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
      random: new SequenceRandom([0]),
      maximumAttempts: 1,
      isLexicalSlotReachable: (slot) => !slot.requiredValencyFrames.includes("transitive"),
    });
    expect(shape).toBeNull();
  });

  it("rejects random values outside the unit interval", () => {
    expect(() => sampleStructuralDerivation({
      rootCategory: "Sentence",
      rules,
      random: { next: () => 1 },
    })).toThrow(/\[0, 1\)/u);
  });
});
