import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import {
  prepareStructuralSamplingContext as prepareCandidate,
  sampleStructuralDerivation as sampleCandidate,
} from "../src/syntax/sample.js";
import type { RandomSource } from "../src/core/model.js";
import type {
  PreparedStructuralSamplingContext,
  StructuralSamplingOptions,
} from "../src/syntax/sample.js";

type Sampler = (
  options: StructuralSamplingOptions,
  preparedContext?: PreparedStructuralSamplingContext,
) => ReturnType<typeof sampleCandidate>;
type Prepare = typeof prepareCandidate;

class CountingRandom implements RandomSource {
  draws = 0;
  private state: number;
  constructor(seed: number) { this.state = seed >>> 0; }
  next(): number {
    this.draws += 1;
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000;
  }
}

interface LegResult {
  readonly elapsedMs: number;
  readonly digest: string;
  readonly draws: number;
  readonly nonNull: number;
}

function runLeg(sampler: Sampler, context: PreparedStructuralSamplingContext, rounds: number): LegResult {
  const shapes: ReturnType<Sampler>[] = new Array(rounds);
  let draws = 0;
  let nonNull = 0;
  const started = performance.now();
  for (let round = 0; round < rounds; round += 1) {
    const random = new CountingRandom((0x9e3779b9 ^ Math.imul(round + 1, 0x85ebca6b)) >>> 0);
    const shape = sampler({
      rootCategory: "Sentence",
      rules: FORMAL_SYNTAX_RULES,
      random,
      maximumAttempts: 16,
      isLexicalRequirementsReachable: () => true,
    }, context);
    shapes[round] = shape;
    draws += random.draws;
    if (shape !== null) nonNull += 1;
  }
  const elapsedMs = performance.now() - started;
  const hash = createHash("sha256");
  for (const shape of shapes) {
    hash.update(JSON.stringify(shape));
    hash.update("\n");
  }
  return { elapsedMs, digest: hash.digest("hex"), draws, nonNull };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
function median(values: readonly number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
}
function summarize(rounds: number, baseline: LegResult[], candidate: LegResult[]) {
  const baselineTimes = baseline.map((leg) => leg.elapsedMs);
  const candidateTimes = candidate.map((leg) => leg.elapsedMs);
  const baselineMean = mean(baselineTimes);
  const candidateMean = mean(candidateTimes);
  const baselineMedian = median(baselineTimes);
  const candidateMedian = median(candidateTimes);
  const digests = new Set([...baseline, ...candidate].map((leg) => leg.digest));
  const draws = new Set([...baseline, ...candidate].map((leg) => leg.draws));
  const nonNull = new Set([...baseline, ...candidate].map((leg) => leg.nonNull));
  if (digests.size !== 1 || draws.size !== 1 || nonNull.size !== 1) {
    throw new Error(`parity mismatch at ${rounds} rounds: digests=${[...digests]} draws=${[...draws]} nonNull=${[...nonNull]}`);
  }
  return {
    rounds,
    baselineMs: baselineTimes.map((value) => Math.round(value * 100) / 100),
    candidateMs: candidateTimes.map((value) => Math.round(value * 100) / 100),
    meanImprovementPct: Math.round(((baselineMean - candidateMean) / baselineMean) * 10_000) / 100,
    medianImprovementPct: Math.round(((baselineMedian - candidateMedian) / baselineMedian) * 10_000) / 100,
    candidateFasterPairs: candidateTimes.filter((value, index) => value < baselineTimes[index]!).length,
    digest: baseline[0]!.digest,
    draws: baseline[0]!.draws,
    nonNull: baseline[0]!.nonNull,
  };
}

const baselinePath = "../src/syntax/" + "sample-baseline-bench.ts";
const baselineModule = await import(baselinePath) as {
  prepareStructuralSamplingContext: Prepare;
  sampleStructuralDerivation: Sampler;
};
const baselineContext = baselineModule.prepareStructuralSamplingContext(FORMAL_SYNTAX_RULES);
const candidateContext = prepareCandidate(FORMAL_SYNTAX_RULES);

runLeg(baselineModule.sampleStructuralDerivation, baselineContext, 32);
runLeg(sampleCandidate, candidateContext, 32);

for (const rounds of [1024]) {
  const order = ["P", "C", "C", "P", "P", "C", "C", "P"] as const;
  const baseline: LegResult[] = [];
  const candidate: LegResult[] = [];
  for (const side of order) {
    const result = side === "P"
      ? runLeg(baselineModule.sampleStructuralDerivation, baselineContext, rounds)
      : runLeg(sampleCandidate, candidateContext, rounds);
    (side === "P" ? baseline : candidate).push(result);
  }
  console.log(JSON.stringify(summarize(rounds, baseline, candidate)));
}
