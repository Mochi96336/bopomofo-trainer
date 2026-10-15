import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { catalogEntryFrequencyWeight } from "../src/commonness/catalog-projection.js";
import { composeFormalSyntaxUtterances, prepareFormalSyntaxLexicon } from "../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import {
  auditPolyphonicCandidate,
  buildPolyphonicReadingIndex,
  type PolyphonicContextHit,
} from "../src/readings/polyphonic-audit.js";
import { reviewedRoleReadingEligible } from "../src/readings/pronominal-role-license.js";
import {
  buildDongxiContextReview, DONGXI_SENSE_READINGS,
  type DongxiContextOrigin,
} from "../src/readings/dongxi-context-review.js";

/** Selection reachability and sense ambiguity are separate questions:
 * This script performs no semantics, segmentation guesswork or pronunciation
 * classification; every generated example must be reviewed independently. */
const BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;
const TARGET_WEIGHT = 100_000_000;
let samplesPerReading = 24;
let baselinePath = "data/generated/polyphonic-context-reviewed-roles.json";
let outputPath = "data/generated/dongxi-context-review.json";
for (let i = 2; i < process.argv.length; i += 2) {
  const flag = process.argv[i];
  const value = process.argv[i + 1];
  if (!value) throw new Error("missing value for " + flag);
  if (flag === "--samples-per-reading") {
    samplesPerReading = Number(value);
    if (!Number.isSafeInteger(samplesPerReading) || samplesPerReading < 1 || samplesPerReading > 128) {
      throw new Error("samples-per-reading must be an integer from 1 to 128");
    }
  } else if (flag === "--baseline") baselinePath = value;
  else if (flag === "--output") outputPath = value;
  else throw new Error("unsupported option: " + flag);
}
const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as {
  readonly schemaVersion: string;
  readonly readingEligibilityPolicy: string;
  readonly sampleCount: number;
  readonly successfulSentences: number;
  readonly catalogEntryCount: number;
  readonly hits: readonly PolyphonicContextHit[];
};
if (baseline.schemaVersion !== "polyphonic-context-exposure-v1"
  || baseline.readingEligibilityPolicy !== "reviewed-roles"
  || baseline.sampleCount !== 2048
  || baseline.successfulSentences !== baseline.sampleCount
  || baseline.catalogEntryCount !== PRACTICE_CATALOG.length
  || !Array.isArray(baseline.hits)) {
  throw new Error("東西 comparison needs exact 2048-seed reviewed-role baseline");
}
const evidence = JSON.parse(await readFile(
  "data/readings/moe-online-headword-sense-evidence.json", "utf8",
)) as {
  readonly entries: readonly {
    readonly entryId: string;
    readonly evidenceBoundary: string;
    readonly exampleHostLexeme: string | null;
    readonly usableAsTrainingLabel: boolean;
    readonly usableAsProductRule: boolean;
  }[];
};
const senseRows = evidence.entries.filter(row => row.entryId.startsWith("word:東西:"));
if (senseRows.length !== 2 || senseRows.some(row =>
  row.evidenceBoundary !== "same-upos-sense-needed"
  || row.exampleHostLexeme !== null
  || row.usableAsTrainingLabel !== false
  || row.usableAsProductRule !== false,
) || DONGXI_SENSE_READINGS.some(reading => !senseRows.some(row => row.entryId === reading.id))) {
  throw new Error("MOE evidence cannot license automatic 東西 context reading labels");
}

const index = buildPolyphonicReadingIndex(PRACTICE_CATALOG);
const profilesById = new Map(SYNTAX_PROFILES.map(profile => [profile.id, profile]));
const prepared = prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES);
const hits: DongxiContextOrigin[] = baseline.hits
  .filter(hit => hit.text === "東西")
  .map(hit => ({ origin: "unbiased-reviewed-roles", hit }));
const generatedByReading: Record<string, {
  attemptedSeeds: number;
  generatedSentences: number;
  noCandidate: number;
  selectedOccurrences: number;
}> = {};
for (const reading of DONGXI_SENSE_READINGS) {
  const selectedId = reading.id;
  let generatedSentences = 0;
  let noCandidate = 0;
  let selectedOccurrences = 0;
  for (let seedIndex = 0; seedIndex < samplesPerReading; seedIndex++) {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      random: createSeededRandom("dongxi-same-upos-targeted-v1:" + selectedId + ":" + seedIndex),
      samplingMode: "product-family",
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 64,
      bounds: BOUNDS,
      readingEligibility: reviewedRoleReadingEligible,
      entryWeight: (entry) => entry.id === selectedId ? TARGET_WEIGHT : catalogEntryFrequencyWeight(entry),
    }, prepared);
    const candidate = result.candidates[0];
    if (!candidate) {
      noCandidate++;
      continue;
    }
    generatedSentences++;
    const selected = auditPolyphonicCandidate(seedIndex, candidate, index, profilesById)
      .filter(hit => hit.text === "東西" && hit.selectedEntryId === selectedId);
    selectedOccurrences += selected.length;
    hits.push(...selected.map(hit => ({ origin: "biased-research-probe" as const, hit })));
  }
  generatedByReading[selectedId] = {
    attemptedSeeds: samplesPerReading,
    generatedSentences,
    noCandidate,
    selectedOccurrences,
  };
}

const review = buildDongxiContextReview(PRACTICE_CATALOG, SYNTAX_PROFILES, hits, 8);
const output = {
  ...review,
  baselineSamples: baseline.sampleCount,
  samplesPerReading,
  targetWeightOverride: TARGET_WEIGHT,
  generatedByReading,
  warning: "Two catalog readings and an identical UPOS profile do NOT establish actual sentence sense or a correct pronunciation. No production rule or model label.",
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  outputPath,
  profileSignaturesEqualIgnoringIdentity: output.profileSignaturesEqualIgnoringIdentity,
  totals: output.observed,
  generatedByReading,
  examples: output.reviewItems.slice(0, 12).map(row => ({
    origin: row.origin,
    id: row.selectedEntryId,
    sentence: row.sentence,
    upos: row.selectedUpos,
    senseReview: row.actualContextualSense,
    naturalness: row.sentenceNaturalnessReview,
  })),
  warning: output.warning,
}, null, 2));
