import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import { REVIEWED_CLOSED_CLASS_POSITIONS } from "../src/readings/closed-class-license.js";
import { REVIEWED_PRONOMINAL_ROLE_READINGS } from "../src/readings/pronominal-role-license.js";
import { CONSTRUCTION_READINGS } from "../src/syntax/lexical-feature-match.js";
import type { Upos } from "../src/syntax/types.js";

interface Sentence {
  readonly seedIndex: number;
  readonly text: string | null;
  readonly entryIds: readonly string[];
  readonly root: string | null;
}
interface Hit {
  readonly seedIndex: number;
  readonly text: string;
  readonly selectedUpos: Upos | null;
  readonly selectedEntryId: string;
}
interface Report {
  readonly sampleCount: number;
  readonly successfulSentences: number;
  readonly failedSentences: number;
  readonly ambiguousTextCount: number;
  readonly sentences: readonly Sentence[];
  readonly hits: readonly Hit[];
}

function load(path: string): Report {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Report;
  if (!Array.isArray(raw.sentences) || !Array.isArray(raw.hits)
    || raw.sentences.length !== raw.sampleCount) {
    throw new Error("expected full per-seed audit report at " + path);
  }
  raw.sentences.forEach((row, i) => {
    if (row.seedIndex !== i) throw new Error("non-canonical sample sequence in " + path);
  });
  return raw;
}

type AllowedReadings = ReadonlyMap<string, ReadonlySet<string>>;

function closedClassLicenses(): AllowedReadings {
  const allowed = new Map<string, ReadonlySet<string>>();
  for (const [text, poses] of Object.entries(REVIEWED_CLOSED_CLASS_POSITIONS)) {
    const readings = CONSTRUCTION_READINGS[text];
    if (readings === undefined) throw new Error("missing pinned construction readings: " + text);
    for (const upos of poses) {
      allowed.set(text + "/" + upos, new Set(readings.map(reading => catalogEntryId(text, reading))));
    }
  }
  return allowed;
}

function reviewedRoleLicenses(): AllowedReadings {
  const allowed = new Map(closedClassLicenses());
  for (const [text, roles] of Object.entries(REVIEWED_PRONOMINAL_ROLE_READINGS)) {
    for (const [upos, readings] of Object.entries(roles)) {
      if (readings === undefined) continue;
      const key = text + "/" + upos;
      if (allowed.has(key)) throw new Error("reviewed role overlap: " + key);
      allowed.set(key, new Set(readings.map(reading => catalogEntryId(text, reading))));
    }
  }
  return allowed;
}

function tally(report: Report, allowed: AllowedReadings) {
  const exposure = new Map<string, number>();
  const mismatched = new Map<string, number>();
  for (const hit of report.hits) {
    const key = hit.text + "/" + (hit.selectedUpos ?? "unknown");
    const ids = allowed.get(key);
    if (ids === undefined) continue;
    exposure.set(key, (exposure.get(key) ?? 0) + 1);
    if (!ids.has(hit.selectedEntryId)) {
      mismatched.set(key, (mismatched.get(key) ?? 0) + 1);
    }
  }
  return { exposure: Object.fromEntries([...exposure].sort()), mismatched: Object.fromEntries([...mismatched].sort()) };
}

const [baselinePath, closedPath, rolesPath, outputPath] = process.argv.slice(2);
if (!baselinePath || !closedPath || !rolesPath || !outputPath) {
  throw new Error("usage: tsx scripts/compare-polyphonic-role-trial.ts <baseline> <closed> <roles> <summary.json>");
}

const baseline = load(baselinePath);
const closed = load(closedPath);
const roles = load(rolesPath);

if (baseline.sampleCount !== closed.sampleCount || baseline.sampleCount !== roles.sampleCount
  || baseline.ambiguousTextCount !== closed.ambiguousTextCount
  || baseline.ambiguousTextCount !== roles.ambiguousTextCount) {
  throw new Error("cannot compare reports from differing sample/catalog populations");
}
if (baseline.failedSentences !== 0 || closed.failedSentences !== 0 || roles.failedSentences !== 0) {
  throw new Error("a tested reading policy caused or retained utterance-generation failure");
}
const closedPins = closedClassLicenses();
const rolePins = reviewedRoleLicenses();
const changedSeeds = (other: Report): readonly number[] =>
  baseline.sentences.flatMap((sentence, i) => {
    const after = other.sentences[i]!;
    const changed = sentence.text !== after.text
      || sentence.root !== after.root
      || sentence.entryIds.join("\\u0000") !== after.entryIds.join("\\u0000");
    return changed ? [sentence.seedIndex] : [];
  });

const potentiallyAffectedSeeds = (allowed: AllowedReadings): ReadonlySet<number> =>
  new Set(baseline.hits.filter(hit => {
    const key = hit.text + "/" + (hit.selectedUpos ?? "unknown");
    const ids = allowed.get(key);
    return ids !== undefined && !ids.has(hit.selectedEntryId);
  }).map(hit => hit.seedIndex));

function assertNoUnrelatedSeedDrift(changed: readonly number[], allowed: AllowedReadings, policy: string) {
  const affected = potentiallyAffectedSeeds(allowed);
  const unrelated = changed.filter(seed => !affected.has(seed));
  if (unrelated.length > 0) {
    throw new Error(policy + " changed originally licensed/untargeted seeds: "
      + unrelated.slice(0, 20).join(", "));
  }
  return affected.size;
}

const baseClosed = tally(baseline, closedPins);
const trialClosed = tally(closed, closedPins);
const baseRoles = tally(closed, rolePins);
const trialRoles = tally(roles, rolePins);
const closedChanges = changedSeeds(closed);
const roleChanges = changedSeeds(roles);
const closedAffectedSeeds = assertNoUnrelatedSeedDrift(closedChanges, closedPins, "reviewed-closed");
const roleAffectedSeeds = assertNoUnrelatedSeedDrift(roleChanges, rolePins, "reviewed-roles");
const disallowedClosed = Object.values(trialClosed.mismatched).reduce((a, b) => a + b, 0);
const disallowedRoles = Object.values(trialRoles.mismatched).reduce((a, b) => a + b, 0);
if (disallowedClosed !== 0 || disallowedRoles !== 0) {
  throw new Error("reviewed reading policy emitted a disallowed syntactic role");
}
const report = {
  schemaVersion: "polyphonic-reading-role-trial-comparison-v1",
  status: "diagnostic-only—not a general error-rate estimate",
  sampleCount: baseline.sampleCount,
  successfulSentences: {
    original: baseline.successfulSentences,
    reviewedClosed: closed.successfulSentences,
    reviewedRoles: roles.successfulSentences,
  },
  changedSentenceCount: {
    reviewedClosed: closedChanges.length,
    reviewedRoles: roleChanges.length,
  },
  originalSeedsContainingDisallowedIdentity: {
    reviewedClosed: closedAffectedSeeds,
    reviewedRoles: roleAffectedSeeds,
  },
  unrelatedSeedChanges: 0,
  reviewedClosedMismatchCountByRole: {
    original: baseClosed.mismatched,
    reviewedClosed: trialClosed.mismatched,
  },
  reviewedRoleMismatchCountByRole: {
    closedClassOnly: baseRoles.mismatched,
    reviewedRoles: trialRoles.mismatched,
  },
  reviewedRoleExposureCountByRole: {
    closedClassOnly: baseRoles.exposure,
    reviewedRoles: trialRoles.exposure,
  },
};
writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
