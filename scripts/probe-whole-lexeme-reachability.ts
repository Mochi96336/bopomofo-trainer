import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { catalogEntryFrequencyWeight } from "../src/commonness/catalog-projection.js";
import {
  composeFormalSyntaxUtterances,
  prepareFormalSyntaxLexicon,
} from "../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { reviewedRoleReadingEligible } from "../src/readings/pronominal-role-license.js";
import {
  inspectHostLexemeReadiness,
  inspectHostLexemeSelection,
} from "../src/readings/whole-lexeme-reachability.js";

const BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;
const WEIGHT = 100_000_000;
let probes = 16;
let output = "data/generated/polyphonic-host-lexeme-reachability.json";
let baselinePath = "data/generated/polyphonic-lexeme-boundary-readiness.json";
for (let i = 2; i < process.argv.length; i += 2) {
  const arg = process.argv[i];
  const value = process.argv[i + 1];
  if (!value) throw new Error("missing value for " + arg);
  if (arg === "--probes") {
    probes = Number(value);
    if (!Number.isSafeInteger(probes) || probes < 1 || probes > 64) {
      throw new Error("--probes must be an integer in [1, 64]");
    }
  } else if (arg === "--output") output = value;
  else if (arg === "--baseline") baselinePath = value;
  else throw new Error("unknown argument: " + arg);
}
interface BaselineRow {
  readonly caseId: string;
  readonly targetReadingEntryId: string;
  readonly hostLexeme: string;
  readonly hostCatalogEntryIds: readonly string[];
  readonly sampledAtomicHostOccurrences: number;
}
interface Baseline {
  readonly schemaVersion: string;
  readonly sampledSeeds: number;
  readonly cases: readonly BaselineRow[];
}
const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as Baseline;
if (baseline.schemaVersion !== "polyphonic-lexeme-boundary-readiness-v1"
  || baseline.sampledSeeds !== 2048 || baseline.cases.length !== 3) {
  throw new Error("host probes require exact 2048-seed compound-boundary baseline");
}
const source = JSON.parse(await readFile(
  "data/readings/moe-online-headword-sense-evidence.json", "utf8",
)) as { entries: { caseId: string; entryId: string; evidenceBoundary: string; exampleHostLexeme: string | null }[] };
const linked = source.entries.filter(row => row.evidenceBoundary === "attested-in-larger-lexeme");
if (linked.length !== baseline.cases.length) throw new Error("host source count mismatch");
const profilesById = new Map(SYNTAX_PROFILES.map(profile => [profile.id, profile]));
if (profilesById.size !== SYNTAX_PROFILES.length) throw new Error("duplicate runtime profile identity");
const prepared = prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES);
const cases = [];
for (const sourceRow of linked) {
  const reference = baseline.cases.find(row => row.caseId === sourceRow.caseId);
  const hostLexeme = sourceRow.exampleHostLexeme;
  if (!hostLexeme || !reference || reference.hostLexeme !== hostLexeme
    || reference.targetReadingEntryId !== sourceRow.entryId) {
    throw new Error("source/baseline compound-host identity mismatch");
  }
  const readiness = inspectHostLexemeReadiness(hostLexeme, PRACTICE_CATALOG, SYNTAX_PROFILES);
  if (JSON.stringify(readiness.exactEntryIds) !== JSON.stringify(reference.hostCatalogEntryIds)) {
    throw new Error("baseline/targeted catalog host identities disagree");
  }
  let generatedSentences = 0;
  let generatedWithoutCandidate = 0;
  let attemptedSeeds = 0;
  let atomicHostOccurrences = 0;
  let surfaceOnlyCollisions = 0;
  const selectedExamples: {
    readonly seedIndex: number;
    readonly sentence: string;
    readonly selectedHostEntryIds: readonly string[];
    readonly selectedHostProfileIds: readonly (string | null)[];
    readonly syntaxRootRuleId: string | null;
  }[] = [];
  if (readiness.status === "licensed-profile-present") {
    const targetIds = new Set(readiness.exactEntryIds);
    for (let index = 0; index < probes; index += 1) {
      attemptedSeeds++;
      const generation = composeFormalSyntaxUtterances({
        eligibleEntries: PRACTICE_CATALOG,
        profiles: SYNTAX_PROFILES,
        random: createSeededRandom("whole-lexeme-targeted-v1:" + hostLexeme + ":" + index),
        samplingMode: "product-family",
        minimumLexicalEntries: 2,
        maximumCandidates: 1,
        maximumAttempts: 64,
        bounds: BOUNDS,
        readingEligibility: reviewedRoleReadingEligible,
        entryWeight: (entry) => targetIds.has(entry.id)
          ? WEIGHT : catalogEntryFrequencyWeight(entry),
      }, prepared);
      const candidate = generation.candidates[0];
      if (!candidate) {
        generatedWithoutCandidate++;
        continue;
      }
      generatedSentences++;
      const hit = inspectHostLexemeSelection(candidate, readiness, profilesById);
      atomicHostOccurrences += hit.atomicHostOccurrences;
      surfaceOnlyCollisions += Number(hit.surfaceOnlyCollision);
      if (hit.atomicHostOccurrences > 0 && selectedExamples.length < 3) {
        selectedExamples.push({
          seedIndex: index,
          sentence: candidate.text,
          selectedHostEntryIds: hit.hostEntryIds,
          selectedHostProfileIds: hit.hostProfileIds,
          syntaxRootRuleId: candidate.syntaxRootRuleId ?? null,
        });
      }
      if (selectedExamples.length >= 3) break;
    }
  }
  cases.push({
    caseId: sourceRow.caseId,
    targetReadingEntryId: sourceRow.entryId,
    hostLexeme,
    baselineAtomicOccurrences: reference.sampledAtomicHostOccurrences,
    ...readiness,
    probeStatus: readiness.status !== "licensed-profile-present"
      ? "not-probed-no-licensed-profile"
      : atomicHostOccurrences > 0
        ? "selected-only-in-biased-probe"
        : "not-observed-after-bounded-biased-probes",
    attemptedSeeds,
    generatedSentences,
    generatedWithoutCandidate,
    atomicHostOccurrences,
    surfaceOnlyCollisions,
    selectedExamples,
    verdict: "selection reachability only; not a correct reading or natural sentence label",
  });
}
const report = {
  schemaVersion: "polyphonic-host-lexeme-targeted-reachability-v1",
  purpose: "research-only; biased host-lexeme selectability, not frequency or contextual reading correctness",
  baselineSamples: baseline.sampledSeeds,
  targetWeightOverride: WEIGHT,
  maximumSeedsPerHost: probes,
  generationAttemptsPerSeed: 64,
  cases,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  output,
  cases: cases.map(row => ({
    hostLexeme: row.hostLexeme,
    readiness: row.status,
    baseline: row.baselineAtomicOccurrences,
    probeStatus: row.probeStatus,
    attemptedSeeds: row.attemptedSeeds,
    generatedSentences: row.generatedSentences,
    atomic: row.atomicHostOccurrences,
    surfaceOnly: row.surfaceOnlyCollisions,
    examples: row.selectedExamples.map(x => x.sentence),
  })),
  warning: "Bounded failures are inconclusive; biased selection is not production exposure, naturalness, or pronunciation validation.",
}, null, 2));
