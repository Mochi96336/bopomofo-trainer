import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../src/app/generated/catalog.js";
import { COMMONNESS_TIERS } from "../src/commonness/tiers.js";
import { FREQUENCY_FIRST_UTTERANCE_POLICY, updateFrequencyFirstSelectionState } from "../src/curriculum/frequency-first-utterance.js";
import { READING_ALLOCATION_POLICY } from "../src/curriculum/reading-allocation.js";
import type { FormalSyntaxFeasibility } from "../src/curriculum/formal-syntax-feasibility.js";
import { clauseConstructionClassification, sentenceConstructionClassification } from "../src/curriculum/formal-syntax-taxonomy.js";
import { activeSentenceConstructionFamilies, sentenceConstructionFamilyPrior } from "../src/curriculum/formal-syntax-sampling-policy.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../src/readings/product-reading-policy.js";
import { auditPolyphonicCandidate, buildPolyphonicReadingIndex, type PolyphonicContextHit } from "../src/readings/polyphonic-audit.js";
import { buildSameUposReviewQueue } from "../src/readings/same-upos-review.js";
import { READING_ABSTENTION_POLICY } from "../src/readings/reading-frontier.js";
import { quantile } from "../src/measurement-v2/selection-evidence.js";
import { sha256Canonical } from "../src/reference/importers/canonical-json.js";

const samples = Number(process.argv[2] ?? 128);
if (!Number.isSafeInteger(samples) || samples < 32 || samples > 4096) throw new Error("sample count must be 32..4096");
const output = process.argv[3] ?? "data/generated/product-selection-quality.json";
const whole = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
const tierByEntryId = new Map(COMMONNESS_TIERS.flatMap(level =>
  catalogsForCommonnessTiers(whole, COMMONNESS_TIER_THRESHOLDS, [level]).practice
    .map(entry => [entry.id, String(level)] as const)));
function increment(map: Map<string, number>, key: string): void { map.set(key, (map.get(key) ?? 0) + 1); }
function sorted(map: Map<string, number>) { return Object.fromEntries([...map].sort(([a], [b]) => a.localeCompare(b))); }
function distribution(values: readonly number[]) {
  return { median: quantile(values, 0.5), p95: quantile(values, 0.95), maximum: Math.max(...values) };
}

const scenarios = [];
for (const tier of [null, ...COMMONNESS_TIERS]) {
  const catalogs = tier === null ? whole : catalogsForCommonnessTiers(whole, COMMONNESS_TIER_THRESHOLDS, [tier]);
  const environment = createProductEnvironment(catalogs);
  let progress = createFreshProgressForEnvironment(environment, `selection-quality-v2:${tier ?? "all"}`, "guided", "standard");
  const profiles = new Map(catalogs.syntaxProfiles.map(profile => [profile.id, profile]));
  const polyphonicIndex = buildPolyphonicReadingIndex(catalogs.practice);
  const polyphonicHits: PolyphonicContextHit[] = [];
  let rootAvailability: FormalSyntaxFeasibility["roots"] = [];
  const families = new Map<string, number>();
  const constructions = new Map<string, number>();
  const clauses = new Map<string, number>();
  const texts = new Map<string, number>();
  const readings = new Map<string, number>();
  const profilesUsed = new Map<string, number>();
  const realizedProfileFrames = new Map<string, number>();
  const writtenFormTiers = new Map<string, number>();
  const tokens = new Map<string, number>();
  const fallbacks = new Map<string, number>();
  const syllables: number[] = [], keystrokes: number[] = [], attempts: number[] = [];
  let repeatedSentences = 0, repeatedConstructions = 0, repeatedWords = 0, bestEffort = 0;
  const gates = [PRODUCT_READING_POLICY.readingEligibility, PRODUCT_READING_POLICY.preDrawReadingEligibility,
    PRODUCT_READING_POLICY.finalCandidateReadingEligibility, PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
    ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities];
  for (let round = 0; round < samples; round += 1) {
    const state = createProductState(environment, progress, 0);
    const selection = state.round.selection;
    const { utterance, score } = selection;
    polyphonicHits.push(...auditPolyphonicCandidate(round, utterance, polyphonicIndex, profiles));
    if (round === 0) rootAvailability = selection.rootAvailability ?? [];
    if (!(score.acceptanceProbability > 0 && score.acceptanceProbability <= 1)) throw new Error("invalid candidate acceptance probability");
    for (let i = 0; i < utterance.entries.length; i += 1) {
      const entry = utterance.entries[i]!;
      const profile = profiles.get(utterance.syntaxProfileIds![i]!)!;
      const previous = utterance.entries[i - 1] ?? null;
      if (profile === undefined || gates.some(gate => !gate(entry, profile, null, previous))) {
        throw new Error(`unlicensed product reading: tier=${tier} round=${round} entry=${entry.id}`);
      }
      increment(texts, entry.prompt.text);
      increment(readings, entry.id);
      increment(profilesUsed, profile.id);
      increment(writtenFormTiers, tierByEntryId.get(entry.id) ?? "unknown");
      // A profile can support several frames. These are capability labels on
      // selected profiles, not mutually exclusive sentence-frame frequencies.
      for (const frame of profile.valencyFrames) increment(realizedProfileFrames, frame);
      for (const syllable of entry.syllables) for (const token of syllable.tokens) increment(tokens, token);
      if (progress.selection.recentWrittenForms.includes(entry.prompt.text)) repeatedWords += 1;
    }
    increment(families, score.rootFamilyId ?? "unclassified");
    increment(constructions, score.constructionId ?? "unclassified");
    for (const id of utterance.syntaxProductionRuleIds ?? []) {
      const clause = clauseConstructionClassification(id);
      if (clause !== null) increment(clauses, clause.family);
    }
    for (const reason of selection.grammarFallbackReasons) increment(fallbacks, reason);
    repeatedSentences += Number(score.recentUtteranceFactor < 1);
    repeatedConstructions += Number(score.constructionId === progress.selection.recentConstructionIds.at(-1));
    bestEffort += Number(selection.acceptance === "bounded-best-effort");
    syllables.push(score.syllables); keystrokes.push(score.keystrokes); attempts.push(selection.generationAttempts);
    // Sampling audit only: advance delivery recency, without inventing typing evidence.
    progress = { ...progress, practiceRoundsCompleted: round + 1,
      selection: updateFrequencyFirstSelectionState(progress.selection, selection, environment.utterancePolicy) };
  }
  const availableFamilies = new Set(rootAvailability.filter(root => root.potentialShapeCount !== "0")
    .map(root => sentenceConstructionClassification(root.ruleId)?.family));
  const priorMass = activeSentenceConstructionFamilies().reduce((sum, family) =>
    sum + (availableFamilies.has(family) ? sentenceConstructionFamilyPrior(family) : 0), 0);
  const familyPrior = Object.fromEntries(activeSentenceConstructionFamilies().map(family => [family, {
    configured: sentenceConstructionFamilyPrior(family),
    conditionedFirstAttempt: availableFamilies.has(family) ? sentenceConstructionFamilyPrior(family) / priorMass : 0,
    delivered: (families.get(family) ?? 0) / samples,
  }]));
  scenarios.push({ tier: tier ?? "all", entries: catalogs.practice.length, samples,
    rootAvailability,
    familyPrior,
    families: sorted(families), constructions: sorted(constructions), clauses: sorted(clauses),
    uniqueWrittenForms: texts.size, uniqueReadings: readings.size, uniqueProfiles: profilesUsed.size,
    lexicalOccurrences: [...texts.values()].reduce((sum, count) => sum + count, 0),
    syllableOccurrences: syllables.reduce((sum, count) => sum + count, 0),
    writtenFormExposure: sorted(texts), readingExposure: sorted(readings), profileExposure: sorted(profilesUsed),
    profileCapabilityExposure: sorted(realizedProfileFrames), tierExposure: sorted(writtenFormTiers), tokenExposure: sorted(tokens),
    readingContextReview: buildSameUposReviewQueue(polyphonicHits),
    mostFrequentWords: [...texts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 12),
    repeatedSentences, repeatedConstructions, repeatedWords, bestEffort,
    syllables: distribution(syllables), keystrokes: distribution(keystrokes), attempts: distribution(attempts),
    fallbacks: sorted(fallbacks),
  });
}
const report = { schemaVersion: "product-selection-quality-v3", readingAllocation: READING_ALLOCATION_POLICY,
  readingAbstention: READING_ABSTENTION_POLICY, policyVersion: FREQUENCY_FIRST_UTTERANCE_POLICY.version,
  catalogDigest: sha256Canonical(PRACTICE_CATALOG), profilesDigest: sha256Canonical(SYNTAX_PROFILES), scenarios,
  boundary: "Deterministic delivery sampling, not natural Mandarin frequency or learning-effectiveness evidence." };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output, scenarios: scenarios.map(({ tier, samples, uniqueWrittenForms, repeatedSentences, bestEffort, syllables, keystrokes }) =>
  ({ tier, samples, uniqueWrittenForms, repeatedSentences, bestEffort, syllables, keystrokes })) }));
