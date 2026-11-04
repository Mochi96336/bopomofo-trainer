import type { PolyphonicContextHit } from "./polyphonic-audit.js";
import type { SameUposReviewQueue } from "./same-upos-review.js";
import type { Upos } from "../syntax/types.js";

/**
 * Read-only readiness for manual pronunciation review. The audit has selected
 * headword reading, UPOS, profile-wide function *sets*, and nearest lexical
 * neighbors, but it has no observed per-occurrence word-sense identity.
 *
 * IMPORTANT: different/same profile function sets do not prove a reading is
 * right or wrong. This output must never gate selection or declare errors.
 */
export interface SenseReadinessGroup {
  readonly text: string;
  readonly upos: Upos;
  readonly occurrences: number;
  readonly sourceUrl: string;
  readonly perInstanceSenseEvidence: "not-collected";
  readonly profileFunctionsAllReadingsIdentical: boolean;
  readonly distinctProfileFunctionSets: number;
  readonly readingEvidence: readonly {
    readonly entryId: string;
    readonly occurrences: number;
    readonly profileIds: readonly string[];
    readonly profileFunctionSets: readonly string[][];
    readonly examples: readonly {
      readonly seedIndex: number;
      readonly entryIndex: number;
      readonly sentence: string;
      readonly previousEntryText: string | null;
      readonly nextEntryText: string | null;
    }[];
  }[];
}

function signature(hit: PolyphonicContextHit): string {
  // Canonical order independent of a profile's serialization order.
  return JSON.stringify([...new Set(hit.selectedFunctions)].sort());
}

function lexicalKey(text: string, upos: Upos): string {
  return JSON.stringify([text, upos]);
}

export function auditSameUposSenseReadiness(
  queue: SameUposReviewQueue,
  hits: readonly PolyphonicContextHit[],
) {
  const byRole = new Map<string, PolyphonicContextHit[]>();
  for (const hit of hits) {
    if (hit.selectedUpos === null || hit.selectedProfileId === null) {
      throw new Error("sense-readiness audit requires profile-joined selected hits");
    }
    const key = lexicalKey(hit.text, hit.selectedUpos);
    const arr = byRole.get(key) ?? [];
    arr.push(hit);
    byRole.set(key, arr);
  }

  const groups: SenseReadinessGroup[] = queue.groups
    .filter(group => group.kind === "unreviewed-role-variation"
      && group.moeAttestedReadings !== null)
    .map(group => {
      const rows = byRole.get(lexicalKey(group.text, group.upos)) ?? [];
      const actualIds = [...new Set(rows.map(h => h.selectedEntryId))].sort();
      if (rows.length !== group.occurrences
        || JSON.stringify(actualIds) !== JSON.stringify(group.selectedReadingEntryIds)) {
        throw new Error("same-UPOS sense-readiness evidence drift: "
          + group.text + "/" + group.upos);
      }
      const readingEvidence = actualIds.map(entryId => {
        const readingHits = rows.filter(h => h.selectedEntryId === entryId)
          .sort((a,b) => a.seedIndex-b.seedIndex || a.entryIndex-b.entryIndex);
        const functionSets = [...new Set(readingHits.map(signature))].sort();
        return {
          entryId,
          occurrences: readingHits.length,
          profileIds: [...new Set(readingHits.map(h => h.selectedProfileId!))].sort(),
          profileFunctionSets: functionSets.map(s => JSON.parse(s) as string[]),
          examples: readingHits.slice(0, 3).map(h => ({
            seedIndex: h.seedIndex,
            entryIndex: h.entryIndex,
            sentence: h.sentence,
            previousEntryText: h.previousEntryText,
            nextEntryText: h.nextEntryText,
          })),
        };
      });
      const allFunctionSets = new Set(rows.map(signature));
      return {
        text: group.text,
        upos: group.upos,
        occurrences: group.occurrences,
        sourceUrl: group.moeAttestedReadings!.sourceUrl,
        perInstanceSenseEvidence: "not-collected" as const,
        profileFunctionsAllReadingsIdentical: allFunctionSets.size === 1,
        distinctProfileFunctionSets: allFunctionSets.size,
        readingEvidence,
      };
    });

  if (groups.length !== queue.moeAttestedReadingGroups
    || groups.reduce((n,g) => n+g.occurrences,0) !== queue.moeAttestedReadingOccurrences) {
    throw new Error("MOE-attested sound group inventory drifted from review queue");
  }

  return {
    schemaVersion: "same-upos-sense-readiness-v1" as const,
    purpose: "Expose why headword attestation and aggregate profile functions cannot establish per-sentence pronunciation correctness.",
    sourceScope: "final-delivered same-UPOS multi-reading exposure",
    sampledPolyphonicOccurrences: queue.sampledPolyphonicOccurrences,
    unchangedUnreviewedGroups: queue.unreviewedGroups,
    unchangedUnreviewedOccurrences: queue.unreviewedOccurrences,
    moeAttestedGroups: groups.length,
    moeAttestedOccurrences: groups.reduce((n,g)=>n+g.occurrences,0),
    groupsWithIdenticalProfileFunctions: groups.filter(g=>g.profileFunctionsAllReadingsIdentical).length,
    groups,
    caveat: "No per-instance sense ID is recorded. A dictionary-attested pronunciation is not a confirmed pronunciation for any generated sentence; neighbor words and profile functions are only review aids.",
  };
}
