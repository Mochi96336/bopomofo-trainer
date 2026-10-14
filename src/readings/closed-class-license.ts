import type { CatalogEntry } from "../core/model.js";
import { catalogEntryId } from "../core/catalog-entry-id.js";
import { CONSTRUCTION_READINGS } from "../syntax/lexical-feature-match.js";
import type { RuntimeSyntaxProfile, Upos } from "../syntax/types.js";

/**
 * Narrow trial: enforce already-reviewed construction readings *only* when a
 * lexical profile is playing the corresponding closed-class part of speech.
 *
 * Crucially, this does NOT choose a dominant reading for the written word.
 * Different readings remain eligible for their non-closed-class functions.
 * Missing evidence is out of scope, not an implicit denial.
 */
const CLOSED_CLASS_POSITIONS: Readonly<Record<string, readonly Upos[]>> = {
  和: ["CCONJ"],
  與: ["CCONJ"],
  了: ["AUX"],
  著: ["AUX"],
  過: ["AUX"],
  把: ["ADP"],
  將: ["ADP"],
  比: ["ADP"],
  得: ["PART"],
  的: ["PART"],
  嗎: ["PART"],
};

const APPROVED_IDS: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  Object.entries(CLOSED_CLASS_POSITIONS).map(([text]) => {
    const readings = CONSTRUCTION_READINGS[text];
    if (readings === undefined || readings.length === 0) {
      throw new Error("closed-class reading trial lacks reviewed construction identity: " + text);
    }
    return [text, new Set(readings.map((reading) => catalogEntryId(text, reading)))];
  }),
);

export function reviewedClosedClassReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (profile.entryId !== entry.id) {
    throw new Error("reading eligibility must inspect the actually selected catalog identity");
  }
  const closedPositions = CLOSED_CLASS_POSITIONS[entry.prompt.text];
  if (closedPositions === undefined || !closedPositions.includes(profile.upos)) return true;
  return APPROVED_IDS.get(entry.prompt.text)?.has(entry.id) ?? false;
}

/** Exposed for tests and auditing; no automatic production activation. */
export const REVIEWED_CLOSED_CLASS_POSITIONS = CLOSED_CLASS_POSITIONS;
