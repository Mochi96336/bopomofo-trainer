import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import type { PolyphonicContextHit } from "./polyphonic-audit.js";

export const DONGXI_SENSE_READINGS = [
  { id: catalogEntryId("東西", "ㄉㄨㄥ1 ㄒㄧ1"), dictionarySenseFamily: "cardinal-directions" },
  { id: catalogEntryId("東西", "ㄉㄨㄥ1 ㄒㄧ5"), dictionarySenseFamily: "objects" },
] as const;

export interface DongxiContextOrigin {
  readonly origin: "unbiased-reviewed-roles" | "biased-research-probe";
  readonly hit: PolyphonicContextHit;
}

/**
 * Source dictionary senses explain what an identity means in an attested
 * lexeme; none of the *generated* sentences receives a correctness label.
 */
export interface DongxiContextReviewItem {
  readonly reviewId: string;
  readonly origin: DongxiContextOrigin["origin"];
  readonly seedIndex: number;
  readonly entryIndex: number;
  readonly sentence: string;
  readonly selectedEntryId: string;
  readonly dictionarySenseFamily: "cardinal-directions" | "objects";
  readonly selectedUpos: string | null;
  readonly selectedFunctions: readonly string[];
  readonly selectedProfileId: string | null;
  readonly syntaxRootRuleId: string | null;
  readonly previousEntryText: string | null;
  readonly nextEntryText: string | null;
  readonly lexicalBoundary: "selected-atomic-host-entry";
  readonly actualContextualSense: "pending";
  readonly contextualReadingReview: "pending";
  readonly sentenceNaturalnessReview: "pending";
  readonly notTrainingGroundTruth: true;
  readonly notProductRule: true;
}

export interface DongxiContextReviewReport {
  readonly schemaVersion: "dongxi-same-upos-sense-review-v1";
  readonly observed: Readonly<Record<string, {
    readonly unbiasedHits: number;
    readonly biasedHits: number;
    readonly reviewItems: number;
    readonly profileCount: number;
  }>>;
  readonly profileSignaturesEqualIgnoringIdentity: boolean;
  readonly noAutomaticSenseDecision: true;
  readonly reviewItems: readonly DongxiContextReviewItem[];
}

/** Compare only compatibility-relevant fields, deliberately NOT catalog IDs,
 * profile IDs or evidence provenance. Equal signatures indicate a potential
 * grammar disambiguation blind spot, never proof of semantic interchangeability. */
function compatibilitySignature(profile: RuntimeSyntaxProfile): string {
  return JSON.stringify({
    upos: profile.upos,
    functions: [...profile.functions].sort(),
    valencyFrames: [...profile.valencyFrames].sort(),
    occurrenceCapabilities: [...(profile.occurrenceCapabilities ?? [])].sort(),
    dependencyEvidence: profile.dependencyEvidence,
  });
}

/** Builds a *pending* review queue from selected exact entry IDs, never string
 * matching or a guessed semantic classifier. Deduplicate only exact repeated
 * selected occurrences from the same origin/seed/entry position. */
export function buildDongxiContextReview(
  catalog: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
  occurrences: readonly DongxiContextOrigin[],
  perReadingLimit = 8,
): DongxiContextReviewReport {
  if (!Number.isSafeInteger(perReadingLimit) || perReadingLimit < 1) {
    throw new RangeError("perReadingLimit must be a positive integer");
  }
  const hostRows = catalog.filter(entry => entry.prompt.text === "東西");
  const expectedIds = new Set<string>(DONGXI_SENSE_READINGS.map(row => row.id));
  if (hostRows.length !== 2 || new Set(hostRows.map(entry => entry.id)).size !== 2
    || hostRows.some(row => !expectedIds.has(row.id))) {
    throw new Error("東西 requires exactly two pinned whole-word catalog reading identities");
  }
  const profileIds = new Set<string>();
  const signatures: string[][] = [];
  for (const reading of DONGXI_SENSE_READINGS) {
    const related = profiles.filter(profile => profile.entryId === reading.id);
    if (related.length === 0) throw new Error("missing runtime profile for " + reading.id);
    for (const profile of related) {
      if (profileIds.has(profile.id)) throw new Error("duplicate runtime profile IDs");
      profileIds.add(profile.id);
    }
    signatures.push(related.map(compatibilitySignature).sort());
  }
  const profilesById = new Map(profiles.map(profile => [profile.id, profile]));
  if (profilesById.size !== profiles.length) throw new Error("duplicate profiles in full runtime catalog");

  const items: DongxiContextReviewItem[] = [];
  const totals = new Map<string, { unbiased: number; biased: number; included: number; profileCount: number }>();
  const seen = new Set<string>();
  for (const reading of DONGXI_SENSE_READINGS) {
    totals.set(reading.id, {
      unbiased: 0, biased: 0, included: 0,
      profileCount: profiles.filter(profile => profile.entryId === reading.id).length,
    });
  }
  // Source order does not influence which example gets into the review queue.
  const sorted = [...occurrences].sort((a, b) =>
    a.origin.localeCompare(b.origin)
    || a.hit.seedIndex - b.hit.seedIndex
    || a.hit.entryIndex - b.hit.entryIndex
    || a.hit.selectedEntryId.localeCompare(b.hit.selectedEntryId),
  );
  for (const row of sorted) {
    const hit = row.hit;
    if (hit.text !== "東西" || !expectedIds.has(hit.selectedEntryId)) {
      throw new Error("review queue contains a non-東西 exact reading identity");
    }
    if (!Number.isSafeInteger(hit.seedIndex) || hit.seedIndex < 0
      || !Number.isSafeInteger(hit.entryIndex) || hit.entryIndex < 0) {
      throw new Error("invalid lexical seed/entry location");
    }
    const profile = hit.selectedProfileId === null ? undefined : profilesById.get(hit.selectedProfileId);
    if (hit.selectedProfileId !== null && (!profile || profile.entryId !== hit.selectedEntryId
      || profile.upos !== hit.selectedUpos)) {
      throw new Error("selected whole-word reading/profile identity mismatch");
    }
    const key = JSON.stringify([row.origin, hit.seedIndex, hit.entryIndex, hit.selectedEntryId]);
    if (seen.has(key)) throw new Error("duplicate reviewed occurrence identity");
    seen.add(key);
    const total = totals.get(hit.selectedEntryId)!;
    if (row.origin === "unbiased-reviewed-roles") total.unbiased++;
    else total.biased++;
    if (total.included >= perReadingLimit) continue;
    const sense = DONGXI_SENSE_READINGS.find(x => x.id === hit.selectedEntryId)!;
    items.push({
      reviewId: key,
      origin: row.origin,
      seedIndex: hit.seedIndex,
      entryIndex: hit.entryIndex,
      sentence: hit.sentence,
      selectedEntryId: hit.selectedEntryId,
      dictionarySenseFamily: sense.dictionarySenseFamily,
      selectedUpos: hit.selectedUpos,
      selectedFunctions: hit.selectedFunctions,
      selectedProfileId: hit.selectedProfileId,
      syntaxRootRuleId: hit.syntaxRootRuleId,
      previousEntryText: hit.previousEntryText,
      nextEntryText: hit.nextEntryText,
      lexicalBoundary: "selected-atomic-host-entry",
      actualContextualSense: "pending",
      contextualReadingReview: "pending",
      sentenceNaturalnessReview: "pending",
      notTrainingGroundTruth: true,
      notProductRule: true,
    });
    total.included++;
  }
  return {
    schemaVersion: "dongxi-same-upos-sense-review-v1",
    observed: Object.fromEntries([...totals].map(([id, x]) => [id, {
      unbiasedHits: x.unbiased,
      biasedHits: x.biased,
      reviewItems: x.included,
      profileCount: x.profileCount,
    }])),
    profileSignaturesEqualIgnoringIdentity: JSON.stringify(signatures[0]) === JSON.stringify(signatures[1]),
    noAutomaticSenseDecision: true,
    reviewItems: items,
  };
}
