import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { catalogEntryFrequencyWeight } from "../src/commonness/catalog-projection.js";
import { composeFormalSyntaxUtterances, prepareFormalSyntaxLexicon } from "../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { auditPolyphonicCandidate, buildPolyphonicReadingIndex } from "../src/readings/polyphonic-audit.js";
import { reviewedRoleReadingEligible } from "../src/readings/pronominal-role-license.js";
import {
  buildPolyphonicIdentityTargets,
  classifyPolyphonicIdentityCoverage,
  type IdentityProbeOutcome,
} from "../src/readings/targeted-identity-coverage.js";

/**
 * Follow-up to the existing 2,048-seed unbiased audit.
 * "Targeted" means the target entry's selection weight is temporarily
 * increased for a bounded, seed-stable *research-only* probe. These
 * deliberately biased samples do NOT represent the site's production mix.
 *
 * npm run app:catalog
 * npm run readings:audit -- --policy reviewed-roles --output data/generated/polyphonic-context-reviewed-roles.json
 * npx tsx scripts/audit-targeted-polyphonic-identities.ts --probes 3
 */
const BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;
const argv = process.argv.slice(2);
let baselinePath = "data/generated/polyphonic-context-reviewed-roles.json";
let outputPath = "data/generated/polyphonic-targeted-identity-coverage.json";
let probes = 3;
let maxTargets: number | null = null;
let onlyId: string | null = null;
for (let i = 0; i < argv.length; i += 2) {
  const flag = argv[i];
  const value = argv[i + 1];
  if (value === undefined) throw new Error("missing argument for " + flag);
  if (flag === "--baseline") baselinePath = value;
  else if (flag === "--output") outputPath = value;
  else if (flag === "--probes") {
    probes = Number(value);
    if (!Number.isSafeInteger(probes) || probes < 1 || probes > 20) {
      throw new Error("--probes must be in [1, 20]");
    }
  } else if (flag === "--max-targets") {
    maxTargets = Number(value);
    if (!Number.isSafeInteger(maxTargets) || maxTargets < 1) {
      throw new Error("--max-targets must be a positive integer");
    }
  } else if (flag === "--entry-id") onlyId = value;
  else throw new Error("unknown argument: " + flag);
}
const baseline = JSON.parse(await readFile(baselinePath, "utf8")) as {
  readonly schemaVersion: string;
  readonly readingEligibilityPolicy: string;
  readonly occurrenceCountByEntryId: Readonly<Record<string, number>>;
  readonly sampleCount: number;
  readonly catalogEntryCount: number;
};
if (baseline.schemaVersion !== "polyphonic-context-exposure-v1"
  || baseline.readingEligibilityPolicy !== "reviewed-roles"
  || baseline.catalogEntryCount !== PRACTICE_CATALOG.length
  || baseline.sampleCount <= 0
  || baseline.occurrenceCountByEntryId === null
  || typeof baseline.occurrenceCountByEntryId !== "object") {
  throw new Error("targeted probes require a reviewed-roles baseline for the exact active practice catalog");
}
const targets = buildPolyphonicIdentityTargets(
  PRACTICE_CATALOG, SYNTAX_PROFILES, baseline.occurrenceCountByEntryId,
);
if (onlyId !== null && !targets.some(target => target.entryId === onlyId)) {
  throw new Error("--entry-id does not identify an ambiguous active catalog entry");
}
const needed = targets.filter(target => target.baselineOccurrences === 0
  && target.staticStatus === "has-licensed-profile"
  && (onlyId === null || target.entryId === onlyId));
const selected = maxTargets === null ? needed : needed.slice(0, maxTargets);
const ready = prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES);
const polyphonicIndex = buildPolyphonicReadingIndex(PRACTICE_CATALOG);
const profilesById = new Map(SYNTAX_PROFILES.map(profile => [profile.id, profile]));
const outcomes = new Map<string, IdentityProbeOutcome>();
for (const target of selected) {
  const examples: IdentityProbeOutcome["selectedExamples"][number][] = [];
  let withoutCandidate = 0;
  let attempts = 0;
  for (let seedIndex = 0; seedIndex < probes; seedIndex += 1) {
    attempts++;
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      random: createSeededRandom("polyphonic-targeted-v1:" + target.entryId + ":" + seedIndex),
      samplingMode: "product-family",
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 32,
      bounds: BOUNDS,
      readingEligibility: reviewedRoleReadingEligible,
      // Deliberately not the shipped reading distribution: make a particular
      // reading easy to select IF a sampled lexical slot actually admits it.
      entryWeight: (entry) => entry.id === target.entryId
        ? 100_000_000
        : catalogEntryFrequencyWeight(entry),
    }, ready);
    const candidate = result.candidates[0];
    if (candidate === undefined) {
      withoutCandidate++;
      continue;
    }
    const matched = auditPolyphonicCandidate(seedIndex, candidate, polyphonicIndex, profilesById)
      .filter(hit => hit.selectedEntryId === target.entryId);
    for (const hit of matched) {
      examples.push({
        seedIndex,
        text: hit.sentence,
        syntaxRootRuleId: hit.syntaxRootRuleId,
        selectedProfileId: hit.selectedProfileId,
        selectedUpos: hit.selectedUpos,
        previousEntryText: hit.previousEntryText,
        nextEntryText: hit.nextEntryText,
      });
    }
    // Two independently sampled examples per identity is enough to establish
    // selection reachability; more evidence needs real corpus validation.
    if (examples.length >= 2) break;
  }
  outcomes.set(target.entryId, {
    entryId: target.entryId,
    attempts,
    generationsWithoutCandidate: withoutCandidate,
    selectedExamples: examples.slice(0, 2),
  });
}
const counts = new Map<string, number>();
const rows = targets.map(target => {
  const status = classifyPolyphonicIdentityCoverage(target, outcomes.get(target.entryId));
  counts.set(status, (counts.get(status) ?? 0) + 1);
  return { ...target, coverageStatus: status, probe: outcomes.get(target.entryId) ?? null };
});
const report = {
  schemaVersion: "polyphonic-targeted-identity-coverage-v1",
  purpose: "Biased grammar selectability probes, not correct-pronunciation or naturalness evidence",
  baselineSamples: baseline.sampleCount,
  targetProbeAttempts: probes,
  targetWeightOverride: 100_000_000,
  catalogEntryCount: PRACTICE_CATALOG.length,
  ambiguousTextCount: polyphonicIndex.size,
  ambiguousReadingIdentityCount: rows.length,
  probedIdentityCount: outcomes.size,
  allUnobservedLicensedIdentitiesProbed: maxTargets === null && onlyId === null,
  statusCounts: Object.fromEntries([...counts].sort()),
  rows,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  outputPath,
  ambiguousTextCount: report.ambiguousTextCount,
  ambiguousReadingIdentityCount: report.ambiguousReadingIdentityCount,
  probedIdentityCount: report.probedIdentityCount,
  statusCounts: report.statusCounts,
  warning: "Not observed after bounded probes does not imply unreachable; a biased generated sentence does not prove a contextually correct pronunciation.",
}, null, 2));
