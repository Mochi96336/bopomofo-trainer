import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import {
  selectFormalSyntaxUtterance,
  type FrequencyFirstUtteranceSelection,
} from "../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import type { LearnerBindingEvidence } from "../src/curriculum/types.js";
import { createProductEnvironment } from "../src/product/session.js";
import { reviewedRoleReadingEligible } from "../src/readings/pronominal-role-license.js";

/**
 * Read-only, paired random-seed audit of the *real production selector*.
 *
 * This is not a grammar-composer exposure proxy: each selection goes through
 * selectFormalSyntaxUtterance, which applies FrequencyFirst entry weighting
 * BEFORE drawing each lexical slot, then scores the completed sentence.
 * Keep all cohorts at the same catalog, syntax, root policy, history and seed.
 *
 * npx tsx scripts/audit-learner-token-exposure.ts --samples 256 \
 *   --output data/generated/learner-token-exposure-ab.json
 */
const NAMESPACE = "learner-token-exposure-ab-v2";
const MODE = "guided" as const;
const LAYOUT_ID = "standard";
const TARGETS = ["tone:4", "zhuyin:ㄗ", "tone:3"] as const;
type Token = (typeof TARGETS)[number];
type Cohort = "baseline" | "weak-tone-4" | "weak-zhuyin-zi" | "weak-tone-3";
const COHORTS: readonly Cohort[] = [
  "baseline",
  "weak-tone-4",
  "weak-zhuyin-zi",
  "weak-tone-3",
];
const TARGET_BY_COHORT: Readonly<Partial<Record<Cohort, Token>>> = {
  "weak-tone-4": "tone:4",
  "weak-zhuyin-zi": "zhuyin:ㄗ",
  "weak-tone-3": "tone:3",
};

function cli() {
  let samples = 256;
  let output = "data/generated/learner-token-exposure-ab.json";
  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    const value = process.argv[++i];
    if (value === undefined) throw new Error("missing value for " + arg);
    if (arg === "--samples") {
      samples = Number(value);
      if (!Number.isSafeInteger(samples) || samples < 16 || samples > 4096) {
        throw new Error("--samples must be 16..4096");
      }
    } else if (arg === "--output") {
      output = value;
    } else {
      throw new Error("unknown argument " + arg);
    }
  }
  return { samples, output };
}

function errorEvidence(tokenId: Token): readonly LearnerBindingEvidence[] {
  // Model a documented eligible error aggregate, not invented per-user data.
  // Keep timing disabled to isolate the *error* boost.
  return [{
    scope: { mode: MODE, layoutId: LAYOUT_ID, tokenId },
    attempts: 16,
    errors: 12,
    timingSamples: 0,
    currentTimeToTypeMs: null,
    bestTimeToTypeMs: null,
  }];
}

interface Selected {
  readonly id: string;
  readonly text: string;
  readonly entryIds: readonly string[];
  readonly expectedTokens: readonly string[];
  readonly targetTokenOccurrences: Readonly<Record<Token, number>>;
  readonly syllableCount: number;
  readonly boostOnSelectedToken: number;
  readonly totalWeight: number;
  readonly generationAttempts: number;
  readonly fallbacks: readonly string[];
  readonly goodAdjectiveCount: number;
  readonly badAdjectiveCount: number;
}

const { samples, output } = cli();
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const profilesById = new Map(SYNTAX_PROFILES.map(profile => [profile.id, profile]));

const catalogSupport = Object.fromEntries(TARGETS.map(token => [
  token,
  PRACTICE_CATALOG.filter(entry => entry.syllables.some(syllable =>
    syllable.tokens.includes(token)
  )).length,
]));
for (const token of TARGETS) {
  if (catalogSupport[token] === 0) throw new Error("missing catalog support for " + token);
}

function runOne(cohort: Cohort, seedIndex: number): Selected {
  const target = TARGET_BY_COHORT[cohort];
  const selection: FrequencyFirstUtteranceSelection = selectFormalSyntaxUtterance({
    entries: environment.catalogs.practice,
    profiles: environment.catalogs.syntaxProfiles,
    bindingEvidence: target === undefined ? [] : errorEvidence(target),
    mode: MODE,
    layoutId: LAYOUT_ID,
    history: { recentEntryIds: [], recentUtteranceIds: [], recentTemplateIds: [] },
    policy: environment.utterancePolicy,
    readingEligibility: reviewedRoleReadingEligible,
    preparedFormalSyntaxLexicon: environment.preparedPracticeLexicon,
    preparedFormalSyntaxExecution: environment.preparedPracticeFormalSyntaxExecution,
    preparedFrequencyFirstEntries: environment.preparedPracticeEntries,
    random: createSeededRandom(NAMESPACE + ":" + seedIndex + ":practice:0"),
  });
  const candidate = selection.utterance;
  if (candidate.syntaxProfileIds?.length !== candidate.entries.length) {
    throw new Error("missing exact identity/profile alignment");
  }
  let goodAdjectiveCount = 0;
  let badAdjectiveCount = 0;
  for (let i = 0; i < candidate.entries.length; i++) {
    const entry = candidate.entries[i]!;
    const profile = profilesById.get(candidate.syntaxProfileIds[i]!);
    if (profile === undefined || profile.entryId !== entry.id) {
      throw new Error("sampled profile identity mismatch");
    }
    if (!reviewedRoleReadingEligible(entry, profile)) {
      throw new Error("unlicensed selected reading: " + entry.id);
    }
    if (entry.prompt.text === "好" && profile.upos === "ADJ") {
      if (entry.id === "word:好:ㄏㄠ3") goodAdjectiveCount++;
      else badAdjectiveCount++;
    }
  }
  const allExpectedTokens = candidate.entries.flatMap(entry =>
    entry.syllables.flatMap(syllable => syllable.tokens)
  );
  const expectedTokens = [...new Set(allExpectedTokens)].sort();
  const targetTokenOccurrences = Object.fromEntries(TARGETS.map(token => [
    token, allExpectedTokens.filter(actual => actual === token).length,
  ])) as Record<Token, number>;
  const syllableCount = candidate.entries.reduce((n, entry) => n + entry.syllables.length, 0);
  const boostOnSelectedToken = target === undefined ? 1
    : selection.score.expectedTokenTrace.find(trace => trace.tokenId === target)?.boost ?? 1;
  return {
    id: candidate.id, text: candidate.text,
    entryIds: candidate.entries.map(entry => entry.id),
    expectedTokens, targetTokenOccurrences, syllableCount, boostOnSelectedToken,
    totalWeight: selection.score.totalWeight,
    generationAttempts: selection.generationAttempts,
    fallbacks: selection.grammarFallbackReasons,
    goodAdjectiveCount,
    badAdjectiveCount,
  };
}

const table = Object.fromEntries(COHORTS.map(cohort =>
  [cohort, [] as Selected[]],
)) as Record<Cohort, Selected[]>;
for (let seedIndex = 0; seedIndex < samples; seedIndex++) {
  for (const cohort of COHORTS) {
    table[cohort].push(runOne(cohort, seedIndex));
  }
}

function countHit(rows: readonly Selected[], token: Token): number {
  return rows.filter(row => row.expectedTokens.includes(token)).length;
}
function summary(cohort: Cohort) {
  const rows = table[cohort];
  const target = TARGET_BY_COHORT[cohort];
  return {
    sentences: rows.length,
    totalSyllables: rows.reduce((n, x) => n + x.syllableCount, 0),
    exposureByToken: Object.fromEntries(TARGETS.map(token => {
      const totalOccurrences = rows.reduce((n, row) => n + row.targetTokenOccurrences[token], 0);
      const totalSyllables = rows.reduce((n, row) => n + row.syllableCount, 0);
      return [token, {
        sentences: countHit(rows, token),
        fraction: countHit(rows, token) / samples,
        totalOccurrences,
        occurrencesPerSentence: totalOccurrences / samples,
        occurrencesPer100Syllables: 100 * totalOccurrences / totalSyllables,
      }];
    })),
    targetedReadingBoostPresent: target === undefined ? null
      : rows.filter(row => row.expectedTokens.includes(target)
        && row.boostOnSelectedToken > 1).length,
    goodAdjectiveCount: rows.reduce((n, x) => n + x.goodAdjectiveCount, 0),
    badAdjectiveCount: rows.reduce((n, x) => n + x.badAdjectiveCount, 0),
    generationAttemptAverage: rows.reduce((n, x) => n + x.generationAttempts, 0) / samples,
    meanCandidateScoreWeight: rows.reduce((n, x) => n + x.totalWeight, 0) / samples,
    fallbackSentenceCount: rows.filter(x => x.fallbacks.length > 0).length,
  };
}

function compare(left: Cohort, right: Cohort, token: Token) {
  const a = table[left], b = table[right];
  const diffs: Array<{
    seedIndex: number;
    from: string;
    to: string;
    fromContainsTarget: boolean;
    toContainsTarget: boolean;
  }> = [];
  let gainedTarget = 0, lostTarget = 0;
  let occurrenceDelta = 0;
  for (let i = 0; i < samples; i++) {
    const old = a[i]!, now = b[i]!;
    const before = old.expectedTokens.includes(token);
    const after = now.expectedTokens.includes(token);
    occurrenceDelta += now.targetTokenOccurrences[token] - old.targetTokenOccurrences[token];
    if (!before && after) gainedTarget++;
    if (before && !after) lostTarget++;
    if (old.id !== now.id) {
      diffs.push({
        seedIndex: i, from: old.text, to: now.text,
        fromContainsTarget: before,
        toContainsTarget: after,
      });
    }
  }
  return {
    left, right, targetToken: token,
    changedSentenceCount: diffs.length,
    gainedTarget,
    lostTarget,
    netTargetExposureDelta: gainedTarget - lostTarget,
    percentagePointDelta: 100 * (gainedTarget - lostTarget) / samples,
    netTokenOccurrenceDelta: occurrenceDelta,
    occurrenceDeltaPerSentence: occurrenceDelta / samples,
    changedExamples: diffs.slice(0, 24),
  };
}

const report = {
  schemaVersion: "learner-token-exposure-ab-v2",
  purpose: "Read-only production selector experiment; generated exposure, not human learning effectiveness",
  seedNamespace: NAMESPACE,
  sampleCountPerCohort: samples,
  catalogEntryCount: PRACTICE_CATALOG.length,
  syntaxProfileCount: SYNTAX_PROFILES.length,
  targetCatalogEntrySupport: catalogSupport,
  evidence: {
    attempts: 16, errors: 12, timingSamples: 0,
    mode: MODE, layoutId: LAYOUT_ID,
    recentHistory: "empty/frozen",
    sameCatalogGrammarSeedAndPolicy: true,
  },
  cohorts: Object.fromEntries(COHORTS.map(cohort => [cohort, summary(cohort)])),
  weaknessVersusBaseline: [
    compare("baseline", "weak-tone-4", "tone:4"),
    compare("baseline", "weak-zhuyin-zi", "zhuyin:ㄗ"),
    compare("baseline", "weak-tone-3", "tone:3"),
  ],
  limitations: [
    "Synthetic weakness evidence, not real user history or accuracy.",
    "This isolates current error-based per-token weighting; historical recency and timing do not vary.",
    "A finite paired sample cannot guarantee exposure monotonicity or infer statistical significance.",
    "Expected-token boost inside scoreCandidate is post-generation; actual exposure counts are the primary metric.",
    "No sentence-level naturalness gold labels; role identity gating is not human semantic validation.",
  ],
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  output,
  sampleCountPerCohort: samples,
  catalogSupport,
  exposure: Object.fromEntries(COHORTS.map(cohort => [
    cohort, summary(cohort).exposureByToken,
  ])),
  weaknessVersusBaseline: report.weaknessVersusBaseline.map(r => ({
    token: r.targetToken, netTargetExposureDelta: r.netTargetExposureDelta,
    percentagePointDelta: r.percentagePointDelta,
    netTokenOccurrenceDelta: r.netTokenOccurrenceDelta,
    changedSentences: r.changedSentenceCount,
  })),
}, null, 2));
