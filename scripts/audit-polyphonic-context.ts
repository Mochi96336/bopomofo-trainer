import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances } from "../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { reviewedClosedClassReadingEligible } from "../src/readings/closed-class-license.js";
import { reviewedRoleReadingEligible } from "../src/readings/pronominal-role-license.js";
import { reviewedRoleAndOrdinalLineReadingEligible, reviewedOrdinalLineReadingEligible, reviewedContextualPreDrawReadingEligible } from "../src/readings/ordinal-line-context.js";
import { reviewedZhongRolePilotEligible } from "../src/readings/zhong-role-pilot.js";
import {
  auditPolyphonicCandidate,
  buildPolyphonicReadingIndex,
  type PolyphonicContextHit,
} from "../src/readings/polyphonic-audit.js";

/**
 * Runs the same deterministic grammar inputs as the pinned phase-one product
 * baseline, without changing composer logic or production selection weights.
 *
 * npm run app:catalog
 * npx tsx scripts/audit-polyphonic-context.ts
 * npx tsx scripts/audit-polyphonic-context.ts --samples 100
 */
const SEED_NAMESPACE = "formal-syntax-v2-phase1-product-baseline-v1";
const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

type ReadingAuditPolicy = "none" | "reviewed-closed" | "reviewed-roles" | "zhong-role-trial" | "ordinal-line-trial" | "contextual-valid-first";

function argumentsFromCli(): { samples: number; output: string; policy: ReadingAuditPolicy } {
  let samples = 2048;
  let output = "data/generated/polyphonic-context-exposure.json";
  let policy: ReadingAuditPolicy = "none";
  for (let i = 2; i < process.argv.length; i += 1) {
    const name = process.argv[i];
    const value = process.argv[++i];
    if (value === undefined) throw new Error("missing value for " + name);
    if (name === "--samples") {
      samples = Number(value);
      if (!Number.isSafeInteger(samples) || samples < 1 || samples > 100_000) {
        throw new Error("--samples must be an integer from 1 to 100000");
      }
    } else if (name === "--output") {
      output = value;
    } else if (name === "--policy") {
      if (value !== "none" && value !== "reviewed-closed" && value !== "reviewed-roles" && value !== "zhong-role-trial" && value !== "ordinal-line-trial" && value !== "contextual-valid-first") {
        throw new Error("--policy accepts none, reviewed-closed, reviewed-roles, zhong-role-trial or ordinal-line-trial or contextual-valid-first");
      }
      policy = value;
    } else {
      throw new Error("unknown option: " + name);
    }
  }
  return { samples, output, policy };
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedCounts(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries(
    [...map].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
  );
}

const { samples, output, policy } = argumentsFromCli();
const ambiguous = buildPolyphonicReadingIndex(PRACTICE_CATALOG);
const profilesById = new Map(SYNTAX_PROFILES.map((profile) => [profile.id, profile]));
const hits: PolyphonicContextHit[] = [];
const sentences: Array<{
  readonly seedIndex: number;
  readonly text: string | null;
  readonly entryIds: readonly string[];
  readonly root: string | null;
}> = [];
const perText = new Map<string, number>();
const perEntryId = new Map<string, number>();
const perTextAndUpos = new Map<string, number>();
const fallbacks = new Map<string, number>();
let successfulSentences = 0;
let sentencesWithAmbiguousReadings = 0;

for (let seedIndex = 0; seedIndex < samples; seedIndex += 1) {
  const composition = composeFormalSyntaxUtterances({
    eligibleEntries: PRACTICE_CATALOG,
    profiles: SYNTAX_PROFILES,
    random: createSeededRandom(SEED_NAMESPACE + ":" + seedIndex),
    samplingMode: "product-family",
    minimumLexicalEntries: 2,
    maximumCandidates: 1,
    maximumAttempts: 64,
    bounds: PRODUCT_BOUNDS,
    ...(policy === "reviewed-closed"
      ? { readingEligibility: reviewedClosedClassReadingEligible }
      : policy === "reviewed-roles"
        ? { readingEligibility: reviewedRoleReadingEligible }
        : (policy === "ordinal-line-trial" || policy === "contextual-valid-first")
          ? { readingEligibility: reviewedRoleAndOrdinalLineReadingEligible }
        : policy === "zhong-role-trial"
          ? { readingEligibility: reviewedZhongRolePilotEligible }
          : {}),
    ...(policy === "ordinal-line-trial"
      ? { preDrawReadingEligibility: (
          entry: (typeof PRACTICE_CATALOG)[number],
          profile: (typeof SYNTAX_PROFILES)[number],
          _slot: unknown,
          previousEntry: (typeof PRACTICE_CATALOG)[number] | null,
        ) => reviewedOrdinalLineReadingEligible(entry, profile, previousEntry) }
      : policy === "contextual-valid-first"
        ? { preDrawReadingEligibility: reviewedContextualPreDrawReadingEligible }
        : {}),
  });
  for (const reason of composition.fallbackReasons) increment(fallbacks, reason);
  const candidate = composition.candidates[0];
  sentences.push({
    seedIndex,
    text: candidate?.text ?? null,
    entryIds: candidate?.entries.map((entry) => entry.id) ?? [],
    root: candidate?.syntaxRootRuleId ?? null,
  });
  if (candidate === undefined) continue;
  successfulSentences += 1;
  const sentenceHits = auditPolyphonicCandidate(seedIndex, candidate, ambiguous, profilesById);
  if (sentenceHits.length > 0) sentencesWithAmbiguousReadings += 1;
  hits.push(...sentenceHits);
  for (const hit of sentenceHits) {
    increment(perText, hit.text);
    increment(perEntryId, hit.selectedEntryId);
    increment(perTextAndUpos, hit.text + "/" + (hit.selectedUpos ?? "unknown"));
  }
}

const unsampledTexts = [...ambiguous.keys()].filter((text) => !perText.has(text));
const report = {
  schemaVersion: "polyphonic-context-exposure-v1",
  purpose: "Read-only exposure audit; no judgement of reading correctness.",
  readingEligibilityPolicy: policy,
  seedNamespace: SEED_NAMESPACE,
  productBounds: PRODUCT_BOUNDS,
  sampleCount: samples,
  catalogEntryCount: PRACTICE_CATALOG.length,
  ambiguousTextCount: ambiguous.size,
  ambiguousSingleCharacterTextCount: [...ambiguous.keys()].filter(
    (text) => [...text].length === 1,
  ).length,
  successfulSentences,
  failedSentences: samples - successfulSentences,
  sentencesWithAmbiguousReadings,
  polyphonicOccurrences: hits.length,
  observedAmbiguousTextCount: perText.size,
  unsampledAmbiguousTexts: unsampledTexts,
  occurrenceCountByText: sortedCounts(perText),
  occurrenceCountByEntryId: sortedCounts(perEntryId),
  occurrenceCountByTextAndUpos: sortedCounts(perTextAndUpos),
  fallbacks: sortedCounts(fallbacks),
  sentences,
  hits,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  output,
  samples,
  policy,
  successfulSentences,
  ambiguousTextCount: ambiguous.size,
  observedAmbiguousTextCount: perText.size,
  polyphonicOccurrences: hits.length,
  sentencesWithAmbiguousReadings,
  warning: "Exposure is not evidence of an incorrect pronunciation.",
}, null, 2));
