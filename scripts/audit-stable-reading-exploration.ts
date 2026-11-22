import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS,
} from "../src/app/generated/catalog.js";
import { selectFormalSyntaxUtterance } from "../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { selectIsolatedReadingExploration } from "../src/curriculum/isolated-reading-exploration.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import {
  createProductEnvironment, createFreshProgressForEnvironment, createProductState,
} from "../src/product/session.js";
import type { ProductEnvironment, ProductProgress } from "../src/product/types.js";
import type { CatalogEntry } from "../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../src/syntax/types.js";
import { PRODUCT_READING_POLICY } from "../src/readings/product-reading-policy.js";
import type { GrammarUtteranceCandidate } from "../src/grammar/types.js";

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--triage" || args[2] !== "--output") {
  throw new Error("usage: tsx scripts/audit-stable-reading-exploration.ts --triage review-only.json --output result.json");
}
interface RoleCandidate {
  entryId: string;
  dictionarySourceStatus: string;
}
interface RoleReview {
  word: string;
  upos: string;
  classification: string;
  positiveReadings: string[];
  candidates: RoleCandidate[];
}
interface SourceTriage {
  schemaVersion: string;
  sourceEdition: string;
  productionChanged: boolean;
  rows: RoleReview[];
}
const triage = JSON.parse(readFileSync(resolve(args[1]!), "utf8")) as SourceTriage;
if (triage.schemaVersion !== "unresolved-reading-explicit-pos-triage-v1"
  || triage.sourceEdition !== "20260929"
  || triage.productionChanged !== false
  || !Array.isArray(triage.rows)) {
  throw new Error("requires exact source-backed review-only POS triage");
}

const full = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
const entriesById = new Map(PRACTICE_CATALOG.map(entry => [entry.id, entry]));
const reviewed = new Map<string, string>();
const reviewGroupSize = new Map<string, number>();
for (const row of triage.rows.filter(row =>
  row.classification === "singleton-explicit-pos-double-source-review")) {
  if (row.positiveReadings.length !== 1 || row.candidates.length < 2
    || row.candidates.some(c => c.dictionarySourceStatus !== "both-exact")) {
    throw new Error("incomplete exact POS review candidate");
  }
  const key = JSON.stringify([row.word, row.upos]);
  const id = row.positiveReadings[0]!;
  if (reviewed.has(key) || !row.candidates.some(c => c.entryId === id)
    || row.candidates.some(c => entriesById.get(c.entryId)?.prompt.text !== row.word)) {
    throw new Error("role review disagrees with original catalog identities");
  }
  reviewed.set(key, id);
  reviewGroupSize.set(key, row.candidates.length);
}
if (reviewed.size !== 48) {
  throw new Error("48 review-only POS singleton groups expected; any source change needs review");
}
const researchEligibility = (
  entry: CatalogEntry, profile: RuntimeSyntaxProfile,
  slot: Parameters<NonNullable<typeof PRODUCT_READING_POLICY.readingEligibility>>[2],
  previous: CatalogEntry | null,
) => PRODUCT_READING_POLICY.readingEligibility(entry, profile, slot, previous)
  && (reviewed.get(JSON.stringify([entry.prompt.text, profile.upos])) === undefined
    || reviewed.get(JSON.stringify([entry.prompt.text, profile.upos])) === entry.id);

function generate(
  env: ProductEnvironment,
  progress: ProductProgress,
  seed: string,
  useRoleReview: boolean,
): GrammarUtteranceCandidate {
  return selectFormalSyntaxUtterance({
    entries: env.catalogs.practice,
    bindingEvidence: Object.values(progress.measurements.semantic.bindings),
    mode: progress.mode,
    layoutId: progress.layoutId,
    history: {
      recentEntryIds: progress.selection.recentEntryIds,
      recentUtteranceIds: progress.selection.recentUtteranceIds,
      recentWrittenForms: progress.selection.recentWrittenForms,
      recentConstructionIds: progress.selection.recentConstructionIds,
    },
    policy: env.utterancePolicy,
    profiles: env.catalogs.syntaxProfiles,
    ...PRODUCT_READING_POLICY,
    ...(useRoleReview ? {readingEligibility: researchEligibility} : {}),
    preparedFormalSyntaxLexicon: env.preparedPracticeLexicon,
    preparedFrequencyFirstEntries: env.preparedPracticeEntries,
    preparedFormalSyntaxExecution: env.preparedPracticeFormalSyntaxExecution,
    random: createSeededRandom(seed),
  }).utterance;
}
function fingerprint(utterance: GrammarUtteranceCandidate): string {
  return JSON.stringify([
    utterance.entries.map(entry => entry.id), utterance.syntaxProfileIds,
    utterance.syntaxDerivationId,
  ]);
}

type Counts = Map<string, number>;
function reviewCounts(
  utterance: GrammarUtteranceCandidate,
  profilesById: ReadonlyMap<string, RuntimeSyntaxProfile>,
): Counts {
  if (utterance.syntaxProfileIds?.length !== utterance.entries.length) {
    throw new Error("missing profile alignment in existing sentence generator");
  }
  const found: Counts = new Map();
  for (let index = 0; index < utterance.entries.length; index++) {
    const entry = utterance.entries[index]!;
    const profile = profilesById.get(utterance.syntaxProfileIds[index]!);
    if (profile === undefined || profile.entryId !== entry.id) {
      throw new Error("sentence entry/profile mismatch");
    }
    const role = JSON.stringify([entry.prompt.text, profile.upos]);
    const approved = reviewed.get(role);
    if (approved === undefined) continue;
    if (entry.id !== approved) {
      throw new Error("unreviewed reading identity selected for reviewed role: " + entry.id);
    }
    const identity = JSON.stringify([role, entry.id]);
    found.set(identity, (found.get(identity) ?? 0) + 1);
  }
  return found;
}
function gainsCandidateReading(
  trial: GrammarUtteranceCandidate,
  baseline: GrammarUtteranceCandidate,
  byProfile: ReadonlyMap<string, RuntimeSyntaxProfile>,
): boolean {
  const original = reviewCounts(baseline, byProfile);
  const candidate = reviewCounts(trial, byProfile);
  return [...candidate].some(([key, count]) => count > (original.get(key) ?? 0));
}
const percentile95 = (samples: readonly number[]): number => {
  if (samples.length === 0) return 0;
  const sorted = [...samples].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * 0.95) - 1]! * 10) / 10;
};

function run(scope: "tier1" | "all", env: ProductEnvironment) {
  const byProfile = new Map(env.catalogs.syntaxProfiles.map(p => [p.id, p]));
  const totalRounds = 512;
  const rate = 0.25;
  const attempts = 2;
  let skipped = 0, restored = 0, reverted = 0, candidateCalls = 0;
  let changedWithoutNovelTarget = 0, changedFinalSentences = 0;
  let newMatchedOccurrences = 0, baselineOccurrences = 0, chosenOccurrences = 0;
  const timings: number[] = [];
  const examples: Array<{
    seed: number; before: string; after: string;
    beforeIds: string[]; afterIds: string[];
  }> = [];
  for (let index = 0; index < totalRounds; index++) {
    const progress = createFreshProgressForEnvironment(
      env, "stable-reading-extension:" + scope + ":" + index, "guided", "zhuyin-standard",
    );
    const seed = progress.seed + ":practice:" + progress.practiceRoundsCompleted;
    const baseline = generate(env, progress, seed, false);
    if (index === 0) {
      const shipped = createProductState(env, progress, 0).round.selection.utterance;
      if (fingerprint(shipped) !== fingerprint(baseline)) {
        throw new Error("unchanged original product sentence is not reproducible");
      }
    }
    const startMs = performance.now();
    const selected = selectIsolatedReadingExploration({
      baseline, seed, explorationRate: rate,
      maximumExplorationAttempts: attempts,
      generateTrial: isolatedSeed => {
        candidateCalls++;
        return generate(env, progress, isolatedSeed, true);
      },
      gainsVerifiedTarget: (trial, original) => gainsCandidateReading(trial, original, byProfile),
    });
    timings.push(performance.now() - startMs);
    const changed = fingerprint(selected.chosen) !== fingerprint(baseline);
    if (selected.outcome === "skipped") skipped++;
    if (selected.outcome === "reverted") reverted++;
    if (selected.outcome === "restored") restored++;
    if (changed) changedFinalSentences++;
    const baseCounts = reviewCounts(baseline, byProfile);
    const selectedCounts = reviewCounts(selected.chosen, byProfile);
    baselineOccurrences += [...baseCounts.values()].reduce((a, b) => a + b, 0);
    chosenOccurrences += [...selectedCounts.values()].reduce((a, b) => a + b, 0);
    const gains = [...selectedCounts].reduce(
      (sum, [key, count]) => sum + Math.max(0, count - (baseCounts.get(key) ?? 0)), 0,
    );
    newMatchedOccurrences += gains;
    if (changed && gains === 0) changedWithoutNovelTarget++;
    if (selected.outcome !== "restored" && selected.chosen !== baseline) {
      throw new Error("unsuccessful exploration must return exact baseline reference");
    }
    if (selected.outcome === "restored" && (gains === 0 || !changed)) {
      throw new Error("restoration must introduce exact candidate reading and change the result");
    }
    if (changed && examples.length < 10) examples.push({
      seed: index, before: baseline.text, after: selected.chosen.text,
      beforeIds: baseline.entries.map(e => e.id), afterIds: selected.chosen.entries.map(e => e.id),
    });
  }
  if (changedWithoutNovelTarget !== 0 || changedFinalSentences !== restored) {
    throw new Error("candidate-pool drift escaped isolated exploration gate");
  }
  return {
    scope, rounds: totalRounds, explorationRate: rate, attemptLimit: attempts,
    skippedUnchanged: skipped, attemptedButRevertedUnchanged: reverted,
    acceptedRestorations: restored, changedFinalSentences, changedWithoutNovelTarget,
    baselineReviewedRoleOccurrences: baselineOccurrences,
    selectedReviewedRoleOccurrences: chosenOccurrences,
    newMatchingOccurrencesOnChangedSentences: newMatchedOccurrences,
    candidateGeneratorCalls: candidateCalls,
    explorationOnlyMillisecondsP95: percentile95(timings),
    examples,
  };
}
const report = {
  schemaVersion: "isolated-reading-exploration-paired-v1",
  scope: "EXPERIMENT ONLY in original sentence generator, same existing UI and grammar",
  caveat: "48 source-bracket-POS singletons are review CANDIDATES, NOT semantic reading gold or release licenses",
  sourceEdition: "20260929", groupsUnderReview: reviewed.size,
  sourceRoleCandidateSetSizes: Object.fromEntries([...reviewGroupSize]),
  productPolicyUnchanged: true,
  tier1: run("tier1", createProductEnvironment(
    catalogsForCommonnessTiers(full, COMMONNESS_TIER_THRESHOLDS, [1]))),
  all: run("all", createProductEnvironment(full)),
};
writeFileSync(resolve(args[3]!), JSON.stringify(report, null, 2) + "\n", "utf8");
console.log("ISOLATED_READING_EXPLORATION_JSON " + JSON.stringify({
  groupsUnderReview: report.groupsUnderReview,
  tier1: {
    changed: report.tier1.changedFinalSentences,
    newlyMatched: report.tier1.newMatchingOccurrencesOnChangedSentences,
    skipped: report.tier1.skippedUnchanged,
    reverted: report.tier1.attemptedButRevertedUnchanged,
    p95ms: report.tier1.explorationOnlyMillisecondsP95,
  },
  all: {
    changed: report.all.changedFinalSentences,
    newlyMatched: report.all.newMatchingOccurrencesOnChangedSentences,
    skipped: report.all.skippedUnchanged,
    reverted: report.all.attemptedButRevertedUnchanged,
    p95ms: report.all.explorationOnlyMillisecondsP95,
  },
  productPolicyUnchanged: true,
}));
