import { appendFileSync } from "node:fs";
import { DEFAULT_DERIVATION_BOUNDS } from "./src/syntax/features.js";
import { FORMAL_SYNTAX_RULES } from "./src/syntax/grammar.js";
import {
  prepareStructuralSamplingContext,
  sampleStructuralDerivation,
  type NestedProductionTarget,
  type PreparedStructuralSamplingContext,
} from "./src/syntax/sample.js";
import type { ProductionConstituent } from "./src/syntax/types.js";

function randomFor(seed: number) {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) >>> 0;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
    },
  };
}

const negativeTargets: readonly NestedProductionTarget[] = [
  { parentRuleId: "sentence.declarative", constituentKey: "clause", childRuleId: "clause.intransitive" },
  { parentRuleId: "clause.intransitive", constituentKey: "predicate", childRuleId: "predicate.verb.expanded" },
  { parentRuleId: "predicate.verb.expanded", constituentKey: "negation", exactCount: 1 },
  { parentRuleId: "predicate.verb.expanded", constituentKey: "modal", exactCount: 0 },
  { parentRuleId: "predicate.verb.expanded", constituentKey: "adverbial", exactCount: 0 },
  { parentRuleId: "predicate.verb.expanded", constituentKey: "complement", exactCount: 0 },
  { parentRuleId: "predicate.verb.expanded", constituentKey: "aspect", exactCount: 0 },
];

const baTargets: readonly NestedProductionTarget[] = [
  { parentRuleId: "sentence.declarative", constituentKey: "clause", childRuleId: "clause.ba" },
];

const prepared = prepareStructuralSamplingContext(
  FORMAL_SYNTAX_RULES,
  DEFAULT_DERIVATION_BOUNDS,
);

const reconstructedContext: PreparedStructuralSamplingContext = {
  rules: prepared.rules,
  bounds: prepared.bounds,
  rulesByOutput: prepared.rulesByOutput,
  orderedConstituentsBySurfaceOrder: prepared.orderedConstituentsBySurfaceOrder,
};

const clonedOrderedConstituents = new Map(
  [...prepared.orderedConstituentsBySurfaceOrder].map(([order, constituents]) => [
    order,
    constituents.map((constituent) => ({ ...constituent })) as readonly ProductionConstituent[],
  ]),
);
const clonedOrderedContext: PreparedStructuralSamplingContext = {
  rules: prepared.rules,
  bounds: prepared.bounds,
  rulesByOutput: prepared.rulesByOutput,
  orderedConstituentsBySurfaceOrder: clonedOrderedConstituents,
};

const output = process.env.OUTPUT_PATH!;
type OptionsWithoutRandom = Omit<
  Parameters<typeof sampleStructuralDerivation>[0],
  "random"
>;

function write(
  scenario: string,
  seed: number,
  options: OptionsWithoutRandom,
  context?: PreparedStructuralSamplingContext,
): void {
  const shape = sampleStructuralDerivation(
    { ...options, random: randomFor(seed) },
    context,
  );
  appendFileSync(output, JSON.stringify({ scenario, seed, shape }) + "\n");
}

for (let seed = 0; seed < 512; seed += 1) {
  write("ordinary", seed, {
    rootCategory: "Sentence",
    rules: FORMAL_SYNTAX_RULES,
    maximumAttempts: 16,
  });
}

const sentenceRuleIds = FORMAL_SYNTAX_RULES
  .filter((rule) => rule.output === "Sentence")
  .map((rule) => rule.id);
for (const ruleId of sentenceRuleIds) {
  for (let seed = 0; seed < 32; seed += 1) {
    write(`root:${ruleId}`, seed, {
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      rootProductionRuleId: ruleId,
      maximumAttempts: 16,
    });
  }
}

for (let seed = 0; seed < 160; seed += 1) {
  const targeted: OptionsWithoutRandom = {
    rootCategory: "Sentence",
    rules: FORMAL_SYNTAX_RULES,
    rootProductionRuleId: "sentence.declarative",
    nestedProductionTargets: negativeTargets,
    maximumAttempts: 64,
  };
  write("negative:raw-context", seed, targeted);
  write("negative:prepared-context", seed, targeted, prepared);
  write("negative:reconstructed-context", seed, targeted, reconstructedContext);
  write("negative:cloned-ordered-context", seed, targeted, clonedOrderedContext);

  const ba: OptionsWithoutRandom = {
    rootCategory: "Sentence",
    rules: FORMAL_SYNTAX_RULES,
    rootProductionRuleId: "sentence.declarative",
    nestedProductionTargets: baTargets,
    maximumAttempts: 64,
  };
  write("ba:prepared-context", seed, ba, prepared);
  write("ba:cloned-ordered-context", seed, ba, clonedOrderedContext);
}
