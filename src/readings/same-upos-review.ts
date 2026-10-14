import type { PolyphonicContextHit } from "./polyphonic-audit.js";
import { REVIEWED_CLOSED_CLASS_POSITIONS } from "./closed-class-license.js";
import { REVIEWED_PRONOMINAL_ROLE_READINGS } from "./pronominal-role-license.js";
import type { Upos } from "../syntax/types.js";

export interface SameUposReviewGroup {
  readonly text: string;
  readonly upos: Upos;
  readonly occurrences: number;
  readonly selectedReadingEntryIds: readonly string[];
  /**
   * Multiple readings in one UPOS are a review queue, NOT a count of errors.
   * A reviewed role can intentionally admit multiple legitimate readings.
   */
  readonly kind: "reviewed-role-variation" | "unreviewed-role-variation";
  readonly examplesByReadingId: Readonly<Record<string, readonly PolyphonicContextHit[]>>;
}

export interface SameUposReviewQueue {
  readonly schemaVersion: "same-upos-review-queue-v1";
  readonly sampledPolyphonicOccurrences: number;
  readonly ambiguousGroupsInSample: number;
  readonly occurrencesInAmbiguousGroups: number;
  readonly unreviewedGroups: number;
  readonly unreviewedOccurrences: number;
  readonly groups: readonly SameUposReviewGroup[];
}

function isReviewedRole(text: string, upos: Upos): boolean {
  if (REVIEWED_CLOSED_CLASS_POSITIONS[text]?.includes(upos)) return true;
  return REVIEWED_PRONOMINAL_ROLE_READINGS[text]?.[upos] !== undefined;
}

/** Collapses repeated samples into a reproducible review queue without assuming
 * that two different readings in the same UPOS are interchangeable or erroneous.
 * The syntax profile's `functions` may itself contain aggregate surface-keyed
 * evidence; it is included for inspection, not treated as word-sense proof.
 */
export function buildSameUposReviewQueue(
  hits: readonly PolyphonicContextHit[],
  examplesPerReading = 2,
): SameUposReviewQueue {
  if (!Number.isSafeInteger(examplesPerReading) || examplesPerReading < 1) {
    throw new RangeError("examplesPerReading must be a positive integer");
  }
  const groups = new Map<string, PolyphonicContextHit[]>();
  for (const hit of hits) {
    if (hit.selectedUpos === null) {
      throw new Error("same-UPOS review requires a profile-joined polyphonic audit");
    }
    const key = JSON.stringify([hit.text, hit.selectedUpos]);
    const values = groups.get(key) ?? [];
    values.push(hit);
    groups.set(key, values);
  }

  const output: SameUposReviewGroup[] = [];
  for (const [key, values] of groups) {
    const [text, upos] = JSON.parse(key) as [string, Upos];
    const readings = new Map<string, PolyphonicContextHit[]>();
    for (const hit of values) {
      const examples = readings.get(hit.selectedEntryId) ?? [];
      examples.push(hit);
      readings.set(hit.selectedEntryId, examples);
    }
    if (readings.size < 2) continue;
    const selectedReadingEntryIds = [...readings.keys()].sort();
    output.push({
      text,
      upos,
      occurrences: values.length,
      selectedReadingEntryIds,
      kind: isReviewedRole(text, upos)
        ? "reviewed-role-variation"
        : "unreviewed-role-variation",
      examplesByReadingId: Object.fromEntries(selectedReadingEntryIds.map((id) => [
        id,
        [...readings.get(id)!]
          .sort((a, b) => a.seedIndex - b.seedIndex || a.entryIndex - b.entryIndex)
          .slice(0, examplesPerReading),
      ])),
    });
  }
  output.sort((a, b) =>
    b.occurrences - a.occurrences
    || a.text.localeCompare(b.text, "zh-Hant")
    || a.upos.localeCompare(b.upos),
  );
  const unreviewed = output.filter(group => group.kind === "unreviewed-role-variation");
  return {
    schemaVersion: "same-upos-review-queue-v1",
    sampledPolyphonicOccurrences: hits.length,
    ambiguousGroupsInSample: output.length,
    occurrencesInAmbiguousGroups: output.reduce((total, group) => total + group.occurrences, 0),
    unreviewedGroups: unreviewed.length,
    unreviewedOccurrences: unreviewed.reduce((total, group) => total + group.occurrences, 0),
    groups: output,
  };
}
