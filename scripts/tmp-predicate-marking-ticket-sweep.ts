import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY } from "../src/curriculum/formal-syntax-sampling-policy.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";
import type { RandomSource } from "../src/core/model.js";
import { buildLexicalProfileIndex, compatibleProfilesForSlot } from "../src/syntax/realize.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { sampleStructuralDerivation } from "../src/syntax/sample.js";

const SAMPLE_COUNT = Number.parseInt(process.env.SAMPLE_COUNT ?? "1024", 10);
const ticketWeight = Number.parseFloat(process.env.NEGATION_TICKET_WEIGHT ?? "0");
if (!Number.isInteger(SAMPLE_COUNT) || SAMPLE_COUNT <= 0) throw new Error("invalid SAMPLE_COUNT");
if (!Number.isFinite(ticketWeight) || ticketWeight < 0 || ticketWeight > 1) {
  throw new Error("NEGATION_TICKET_WEIGHT must be in [0,1]");
}

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

class ZeroRandom implements RandomSource { next(): number { return 0; } }
const probe = sampleStructuralDerivation({
  rootCategory: "Predicate",
  rules: FORMAL_SYNTAX_RULES,
  random: new ZeroRandom(),
  maximumAttempts: 1,
  rootProductionRuleId: "predicate.verb.expanded",
  nestedProductionTargets: [
    { parentRuleId: "predicate.verb.expanded", constituentKey: "negation", exactCount: 1 },
    { parentRuleId: "predicate.verb.expanded", constituentKey: "modal", exactCount: 0 },
    { parentRuleId: "predicate.verb.expanded", constituentKey: "adverbial", exactCount: 0 },
    { parentRuleId: "predicate.verb.expanded", constituentKey: "complement", exactCount: 0 },
    { parentRuleId: "predicate.verb.expanded", constituentKey: "aspect", exactCount: 0 },
  ],
});
if (probe === null) throw new Error("negation probe unreachable");
const negationSlot = probe.lexicalSlots.find((slot) => slot.constituentKey === "negation");
if (negationSlot === undefined) throw new Error("negation probe slot missing");
const index = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
const negationProfileIds = new Set(compatibleProfilesForSlot(negationSlot, index).map((profile) => profile.id));

const rootCounts = new Map<string, number>();
const familyCounts = new Map<string, number>();
const fallbackCounts = new Map<string, number>();
const negativeRootCounts = new Map<string, number>();
const records = [];
let successCount = 0;
let negativeCandidateCount = 0;

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

const samplingPolicy = ticketWeight === 0
  ? undefined
  : {
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      // Keep one identity across the sweep so changing the weight moves one
      // deterministic threshold instead of reassigning every seed.
      version: "predicate-marking-ticket-sweep-v1",
      predicateMarkingPracticeWeights: {
        ordinary: 1 - ticketWeight,
        negation: ticketWeight,
      },
    };

for (let seed = 0; seed < SAMPLE_COUNT; seed += 1) {
  const composition = composeFormalSyntaxUtterances({
    eligibleEntries: PRACTICE_CATALOG,
    profiles: SYNTAX_PROFILES,
    random: createSeededRandom(`negation-post-stabilization:${seed}`),
    samplingMode: "product-family",
    ...(samplingPolicy === undefined ? {} : { samplingPolicy }),
    minimumLexicalEntries: 2,
    maximumCandidates: 1,
    maximumAttempts: 64,
    bounds: PRODUCT_BOUNDS,
  });
  const candidate = composition.candidates[0];
  const rootRuleId = candidate?.syntaxRootRuleId ?? null;
  const family = rootRuleId === null ? null : sentenceConstructionClassification(rootRuleId)?.family ?? null;
  const fallbackReasons = [...composition.fallbackReasons].sort();
  const hasNegationProfile = candidate?.syntaxProfileIds?.some((id) => negationProfileIds.has(id)) ?? false;
  if (candidate !== undefined) {
    successCount += 1;
    if (rootRuleId !== null) increment(rootCounts, rootRuleId);
    if (family !== null) increment(familyCounts, family);
    if (hasNegationProfile) {
      negativeCandidateCount += 1;
      if (rootRuleId !== null) increment(negativeRootCounts, rootRuleId);
    }
  }
  for (const reason of fallbackReasons) increment(fallbackCounts, reason);
  records.push({
    seed,
    success: candidate !== undefined,
    rootRuleId,
    family,
    fallbackReasons,
    syntaxDerivationId: candidate?.syntaxDerivationId ?? null,
    text: candidate?.text ?? null,
    hasNegationProfile,
  });
}

console.log(JSON.stringify({
  sampleCount: SAMPLE_COUNT,
  ticketWeight,
  catalogEntryCount: PRACTICE_CATALOG.length,
  syntaxProfileCount: SYNTAX_PROFILES.length,
  negationProfileCount: negationProfileIds.size,
  successCount,
  negativeCandidateCount,
  negativeShare: negativeCandidateCount / SAMPLE_COUNT,
  rootCounts: Object.fromEntries([...rootCounts.entries()].sort()),
  familyCounts: Object.fromEntries([...familyCounts.entries()].sort()),
  fallbackCounts: Object.fromEntries([...fallbackCounts.entries()].sort()),
  negativeRootCounts: Object.fromEntries([...negativeRootCounts.entries()].sort()),
  records,
}));
