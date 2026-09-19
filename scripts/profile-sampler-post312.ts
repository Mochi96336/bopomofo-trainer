import { performance } from "node:perf_hooks";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import {
  prepareStructuralSamplingContext,
  sampleStructuralDerivation,
} from "../src/syntax/sample.js";
import type { RandomSource } from "../src/core/model.js";

class CountingRandom implements RandomSource {
  draws = 0;
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.draws += 1;
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  }
}

const context = prepareStructuralSamplingContext(FORMAL_SYNTAX_RULES);

function sampleRound(round: number): { draws: number; checksum: number; nonNull: number } {
  const random = new CountingRandom((0x9e3779b9 ^ Math.imul(round + 1, 0x85ebca6b)) >>> 0);
  const shape = sampleStructuralDerivation({
    rootCategory: "Sentence",
    rules: FORMAL_SYNTAX_RULES,
    random,
    maximumAttempts: 16,
    isLexicalRequirementsReachable: () => true,
  }, context);
  if (shape === null) return { draws: random.draws, checksum: 0, nonNull: 0 };
  let checksum = shape.id.length + shape.productionRulePath.length + shape.lexicalSlots.length;
  checksum += shape.clauseCount + shape.lexicalSlotCount;
  return { draws: random.draws, checksum, nonNull: 1 };
}

for (let round = 0; round < 128; round += 1) sampleRound(round);

const rounds = 2048;
let draws = 0;
let checksum = 0;
let nonNull = 0;
const started = performance.now();
for (let round = 0; round < rounds; round += 1) {
  const result = sampleRound(round);
  draws += result.draws;
  checksum += result.checksum;
  nonNull += result.nonNull;
}
const elapsedMs = performance.now() - started;
console.log(JSON.stringify({ rounds, elapsedMs, draws, checksum, nonNull }));
