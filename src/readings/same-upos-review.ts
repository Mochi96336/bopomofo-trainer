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
  /**
   * Read-only headword pronunciation evidence, NOT confirmation that a
   * particular generated sentence selected the right lexical sense.
   * The whole observed reading set must match an independently reviewed set.
   */
  readonly moeAttestedReadings: {
    readonly sourceUrl: string;
    readonly note: string;
  } | null;
}

export interface SameUposReviewQueue {
  readonly schemaVersion: "same-upos-review-queue-v1";
  readonly sampledPolyphonicOccurrences: number;
  readonly ambiguousGroupsInSample: number;
  readonly occurrencesInAmbiguousGroups: number;
  readonly unreviewedGroups: number;
  readonly unreviewedOccurrences: number;
  /** Subset of unreviewed groups: their observed sounds are dictionary-attested. */
  readonly moeAttestedReadingGroups: number;
  readonly moeAttestedReadingOccurrences: number;
  readonly groups: readonly SameUposReviewGroup[];
}

/**
 * Small, evidence-backed review aids. These checks must never act as
 * pronunciation eligibility gates: dictionary-valid headword readings alone
 * do NOT establish that the selected meaning fits the generated context.
 *
 * Evidence:
 * - 那: MOE Revised ID 2960, includes ㄋㄚ3 question pronoun,
 *   ㄋㄚ4 demonstrative (labeled 形) and classical ㄋㄨㄛ2 "如何" pronoun.
 *   PRON is a syntax profile grouping, not identical to MOE word-class labels.
 * - 給: MOE Revised ID 3994, both ㄍㄟ3 and ㄐㄧ3 have verb meanings.
 * - 供: MOE Revised ID 4405, both ㄍㄨㄥ1 and ㄍㄨㄥ4 have verb meanings.
 *
 * Exact observed sets are mandatory: if new readings appear, the evidence
 * status falls back to unreviewed until someone checks that new identity.
 */
const MOE_ATTESTED_SAME_UPOS_READING_SETS = [
  {
    text: "那", upos: "PRON",
    entryIds: ["word:那:ㄋㄚ3", "word:那:ㄋㄚ4", "word:那:ㄋㄨㄛ2"],
    sourceUrl: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=2960",
    note: "Three valid headword pronunciations; demonstrative ㄋㄚ4 is labeled 形 by MOE, while ㄋㄚ3 and classical ㄋㄨㄛ2 have 代 meanings. Sentence-specific sense remains unverified.",
  },
  {
    text: "給", upos: "VERB",
    entryIds: ["word:給:ㄍㄟ3", "word:給:ㄐㄧ3"],
    sourceUrl: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=3994",
    note: "Both ㄍㄟ3 (hand over) and ㄐㄧ3 (supply, grant) have attested verbal meanings. Sentence-specific sense remains unverified.",
  },
  {
    text: "供", upos: "VERB",
    entryIds: ["word:供:ㄍㄨㄥ1", "word:供:ㄍㄨㄥ4"],
    sourceUrl: "https://dict.revised.moe.edu.tw/dictView.jsp?ID=4405",
    note: "Both ㄍㄨㄥ1 (provide/testify) and ㄍㄨㄥ4 (set out/offer) have attested verbal meanings. Sentence-specific sense remains unverified.",
  },
] as const satisfies readonly {
  readonly text: string;
  readonly upos: Upos;
  readonly entryIds: readonly string[];
  readonly sourceUrl: string;
  readonly note: string;
}[];

function moeAttestedReadings(text: string, upos: Upos, entryIds: readonly string[]) {
  const match = MOE_ATTESTED_SAME_UPOS_READING_SETS.find(
    (row) => row.text === text && row.upos === upos,
  );
  if (match === undefined
    || match.entryIds.length !== entryIds.length
    || !entryIds.every((id) => match.entryIds.some((expected) => id === expected))) {
    return null;
  }
  return { sourceUrl: match.sourceUrl, note: match.note };
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
      moeAttestedReadings: moeAttestedReadings(text, upos, selectedReadingEntryIds),
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
  const moeAttested = unreviewed.filter((group) => group.moeAttestedReadings !== null);
  return {
    schemaVersion: "same-upos-review-queue-v1",
    sampledPolyphonicOccurrences: hits.length,
    ambiguousGroupsInSample: output.length,
    occurrencesInAmbiguousGroups: output.reduce((total, group) => total + group.occurrences, 0),
    unreviewedGroups: unreviewed.length,
    unreviewedOccurrences: unreviewed.reduce((total, group) => total + group.occurrences, 0),
    moeAttestedReadingGroups: moeAttested.length,
    moeAttestedReadingOccurrences: moeAttested.reduce((total, group) => total + group.occurrences, 0),
    groups: output,
  };
}
