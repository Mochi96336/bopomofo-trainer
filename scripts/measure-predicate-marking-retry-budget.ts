import { writeFileSync } from "node:fs";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../src/app/generated/catalog.js";
import {
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
} from "../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";

const SAMPLE_COUNT = 1024;
const labelIndex = process.argv.indexOf("--label");
const label = labelIndex >= 0 ? process.argv[labelIndex + 1] ?? "unknown" : "unknown";
const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;
const policy = {
  ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  version: `predicate-marking-retry-probe-${label}`,
  predicateMarkingPracticeWeights: { ordinary: 0, modal: 0, aspect: 0, negation: 1 },
} as const;

let success = 0;
let overtNegative = 0;
let markingFallback = 0;
let markingSearchExhausted = 0;
let anyFallback = 0;
const failingRounds: Array<{
  round: number;
  text: string | null;
  fallbacks: readonly string[];
}> = [];

for (let round = 0; round < SAMPLE_COUNT; round += 1) {
  const composition = composeFormalSyntaxUtterances({
    eligibleEntries: PRACTICE_CATALOG,
    profiles: SYNTAX_PROFILES,
    random: createSeededRandom(`predicate-marking-retry-probe:${round}`),
    samplingMode: "product-family",
    samplingPolicy: policy,
    minimumLexicalEntries: 2,
    maximumCandidates: 1,
    maximumAttempts: 64,
    bounds: PRODUCT_BOUNDS,
  });
  const candidate = composition.candidates[0] ?? null;
  if (candidate !== null) success += 1;
  if (candidate !== null && /[不未別沒非無]/u.test(candidate.text)) overtNegative += 1;
  if (composition.fallbackReasons.includes("formal-syntax-predicate-marking-availability-fallback")) {
    markingFallback += 1;
  }
  if (composition.fallbackReasons.includes("formal-syntax-predicate-marking-search-exhausted")) {
    markingSearchExhausted += 1;
  }
  if (composition.fallbackReasons.length > 0) anyFallback += 1;
  if (candidate === null || !/[不未別沒非無]/u.test(candidate.text)) {
    if (failingRounds.length < 24) {
      failingRounds.push({
        round,
        text: candidate?.text ?? null,
        fallbacks: composition.fallbackReasons,
      });
    }
  }
}

const report = {
  label,
  sampleCount: SAMPLE_COUNT,
  success,
  overtNegative,
  unmarkedOrFailed: SAMPLE_COUNT - overtNegative,
  markingFallback,
  markingSearchExhausted,
  anyFallback,
  failingRounds,
};
console.log(JSON.stringify(report, null, 2));
writeFileSync(`predicate-marking-retry-${label}.json`, `${JSON.stringify(report, null, 2)}\n`);
