import type { RandomSource } from "../src/core/model.js";
import { FORMAL_GRAMMAR_VERSION } from "../src/syntax/features.js";
import { sampleStructuralDerivation } from "../src/syntax/sample.js";
import type { ProductionRule } from "../src/syntax/types.js";

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

const shape = sampleStructuralDerivation({
  rootCategory: "Sentence",
  rules,
  random: new SequenceRandom([0]),
  maximumAttempts: 1,
});
if (shape === null) throw new Error("expected deterministic shape");
console.log(JSON.stringify(shape, null, 2));
