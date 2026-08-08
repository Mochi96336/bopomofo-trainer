import { describe, expect, it } from "vitest";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { assertExecutableGrammarContract } from "../../src/syntax/executable-contract.js";
import type { ProductionRule } from "../../src/syntax/types.js";

function rule(): ProductionRule {
  return {
    id: "sentence.test",
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output: "Sentence",
    constituents: [{
      key: "head",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["VERB"],
      requiredFunctions: [],
      requiredValencyFrames: [],
      requiredFeatures: {},
    }],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["head"] }],
    constraints: [],
    positiveFixtureIds: ["positive"],
    negativeFixtureIds: ["negative"],
  };
}

describe("executable grammar contract", () => {
  it("rejects requiredFeatures on a non-lexical constituent", () => {
    const value = rule();
    expect(() => assertExecutableGrammarContract([{
      ...value,
      constituents: [{
        ...value.constituents[0]!,
        category: "VerbPhrase",
        allowedUpos: [],
        requiredFeatures: { polarity: "negative" },
      }],
    }])).toThrow(/non-executable structural features/u);
  });

  it("requires lexical bindings to connect at least two fixed lexical slots", () => {
    const value = rule();
    expect(() => assertExecutableGrammarContract([{
      ...value,
      constituents: [{ ...value.constituents[0]!, entryBinding: "same" }],
    }])).toThrow(/singleton lexical entry binding/u);

    expect(() => assertExecutableGrammarContract([{
      ...value,
      constituents: [
        { ...value.constituents[0]!, key: "left", entryBinding: "same" },
        { ...value.constituents[0]!, key: "right", entryBinding: "same" },
      ],
      surfaceOrders: [{ id: "canonical", constituentKeys: ["left", "right"] }],
    }])).not.toThrow();
  });
});
