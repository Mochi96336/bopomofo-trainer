import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";

const SAMPLE_COUNT = 2048;
const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

const rootCounts = new Map<string, number>();
const familyCounts = new Map<string, number>();
const fallbackCounts = new Map<string, number>();
const records = [];
let successCount = 0;

for (let seed = 0; seed < SAMPLE_COUNT; seed += 1) {
  const composition = composeFormalSyntaxUtterances({
    eligibleEntries: PRACTICE_CATALOG,
    profiles: SYNTAX_PROFILES,
    random: createSeededRandom(`ba-structural-product-drift:${seed}`),
    samplingMode: "product-family",
    minimumLexicalEntries: 2,
    maximumCandidates: 1,
    maximumAttempts: 64,
    bounds: PRODUCT_BOUNDS,
  });
  const candidate = composition.candidates[0];
  const rootRuleId = candidate?.syntaxRootRuleId ?? null;
  const family = rootRuleId === null
    ? null
    : sentenceConstructionClassification(rootRuleId)?.family ?? null;
  const fallbackReasons = [...composition.fallbackReasons].sort();

  if (candidate !== undefined) {
    successCount += 1;
    if (rootRuleId !== null) increment(rootCounts, rootRuleId);
    if (family !== null) increment(familyCounts, family);
  }
  for (const reason of fallbackReasons) increment(fallbackCounts, reason);

  records.push({
    seed,
    success: candidate !== undefined,
    rootRuleId,
    family,
    fallbackReasons,
    text: candidate?.text ?? null,
  });
}

console.log(JSON.stringify({
  sampleCount: SAMPLE_COUNT,
  successCount,
  rootCounts: Object.fromEntries([...rootCounts.entries()].sort()),
  familyCounts: Object.fromEntries([...familyCounts.entries()].sort()),
  fallbackCounts: Object.fromEntries([...fallbackCounts.entries()].sort()),
  records,
}));
