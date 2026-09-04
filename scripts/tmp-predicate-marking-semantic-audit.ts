import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY } from "../src/curriculum/formal-syntax-sampling-policy.js";
import { sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";

const SAMPLE_COUNT = Number.parseInt(process.env.SAMPLE_COUNT ?? "2048", 10);
const presentWeightText = process.env.NEGATION_PRESENT_WEIGHT;
const presentWeight = presentWeightText === undefined ? null : Number.parseFloat(presentWeightText);
if (!Number.isInteger(SAMPLE_COUNT) || SAMPLE_COUNT <= 0) throw new Error("invalid SAMPLE_COUNT");
if (presentWeight !== null && (!Number.isFinite(presentWeight) || presentWeight < 0 || presentWeight > 1)) {
  throw new Error("NEGATION_PRESENT_WEIGHT must be in [0,1]");
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

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function sortedObject(counts: Map<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

const rootCounts = new Map<string, number>();
const familyCounts = new Map<string, number>();
const fallbackCounts = new Map<string, number>();
const negativeRootCounts = new Map<string, number>();
const negativeFamilyCounts = new Map<string, number>();
const ticketRootCounts = new Map<string, number>();
const ticketFamilyCounts = new Map<string, number>();
const negativeOriginCounts = new Map<string, number>();
const records: Array<Record<string, unknown>> = [];
let successCount = 0;
let negativeCandidateCount = 0;
let aNotACandidateCount = 0;
let ticketNegationSuccessCount = 0;

const samplingPolicy = presentWeight === null
  ? undefined
  : ({
      ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
      version: `predicate-marking-semantic-sweep-${presentWeight}`,
      predicateMarkingPracticeWeights: {
        ordinary: 1 - presentWeight,
        negation: presentWeight,
      },
    } as typeof PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY);

for (let seed = 0; seed < SAMPLE_COUNT; seed += 1) {
  const composition = composeFormalSyntaxUtterances({
    eligibleEntries: PRACTICE_CATALOG,
    profiles: SYNTAX_PROFILES,
    random: createSeededRandom(`predicate-marking-prior:${seed}`),
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
  const lexicalSlots = candidate?.syntaxLexicalSlots ?? [];
  const productionRulePath = candidate?.syntaxProductionRulePath ?? [];
  const negativeSlots = lexicalSlots.filter((slot) => slot.requiredFeatures.polarity === "negative");
  const aNotASlots = lexicalSlots.filter((slot) => slot.requiredFeatures.questionType === "a-not-a");
  const hasNegativeSlot = negativeSlots.length > 0;
  const hasANotASlot = aNotASlots.length > 0;
  const ticketIntent = candidate?.syntaxPredicateMarkingPracticeIntent ?? null;
  let negativeOrigin: string | null = null;
  if (hasNegativeSlot) {
    if (productionRulePath.includes("clause.negative")) negativeOrigin = "legacy-clause-negative";
    else if (productionRulePath.some((ruleId) => ruleId.startsWith("ba-predicate."))) negativeOrigin = "ba-predicate-negative";
    else if (productionRulePath.includes("predicate.verb.expanded")) negativeOrigin = "predicate-expanded-negative";
    else negativeOrigin = "other-polarity-negative";
  }

  if (candidate !== undefined) {
    successCount += 1;
    if (rootRuleId !== null) increment(rootCounts, rootRuleId);
    if (family !== null) increment(familyCounts, family);
    if (hasNegativeSlot) {
      negativeCandidateCount += 1;
      if (rootRuleId !== null) increment(negativeRootCounts, rootRuleId);
      if (family !== null) increment(negativeFamilyCounts, family);
      if (negativeOrigin !== null) increment(negativeOriginCounts, negativeOrigin);
    }
    if (hasANotASlot) aNotACandidateCount += 1;
    if (ticketIntent === "negation") {
      ticketNegationSuccessCount += 1;
      if (rootRuleId !== null) increment(ticketRootCounts, rootRuleId);
      if (family !== null) increment(ticketFamilyCounts, family);
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
    productionRulePath,
    hasNegativeSlot,
    negativeSlotCount: negativeSlots.length,
    negativeOrigin,
    hasANotASlot,
    aNotASlotCount: aNotASlots.length,
    ticketIntent,
  });
}

console.log(JSON.stringify({
  sampleCount: SAMPLE_COUNT,
  presentWeight,
  catalogEntryCount: PRACTICE_CATALOG.length,
  syntaxProfileCount: SYNTAX_PROFILES.length,
  successCount,
  negativeCandidateCount,
  negativeShare: negativeCandidateCount / SAMPLE_COUNT,
  aNotACandidateCount,
  aNotAShare: aNotACandidateCount / SAMPLE_COUNT,
  ticketNegationSuccessCount,
  ticketNegationSuccessShare: ticketNegationSuccessCount / SAMPLE_COUNT,
  rootCounts: sortedObject(rootCounts),
  familyCounts: sortedObject(familyCounts),
  fallbackCounts: sortedObject(fallbackCounts),
  negativeRootCounts: sortedObject(negativeRootCounts),
  negativeFamilyCounts: sortedObject(negativeFamilyCounts),
  ticketRootCounts: sortedObject(ticketRootCounts),
  ticketFamilyCounts: sortedObject(ticketFamilyCounts),
  negativeOriginCounts: sortedObject(negativeOriginCounts),
  records,
}));
