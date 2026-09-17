import type { RandomSource } from "../src/core/model.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { sampleStructuralDerivation } from "../src/syntax/sample.js";

class SeededRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

let nonNull = 0;
for (let seed = 1; seed <= 1024; seed += 1) {
  const shape = sampleStructuralDerivation({
    rootCategory: "Sentence",
    rules: FORMAL_SYNTAX_RULES,
    random: new SeededRandom(seed),
    maximumAttempts: 32,
  });
  if (shape !== null) nonNull += 1;
  process.stdout.write(`${JSON.stringify({ seed, shape })}\n`);
}
process.stderr.write(`nonNull=${nonNull}/1024\n`);
