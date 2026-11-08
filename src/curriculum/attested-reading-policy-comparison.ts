import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import { reviewedRoleReadingEligible } from "../readings/pronominal-role-license.js";
import { reviewedZhongRolePilotEligible } from "../readings/zhong-role-pilot.js";
import type { AttestedReadingReviewCandidate } from "./attested-reading-review.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";

/** Predictions are *grammar policy proposals*, NOT human or source reading
 * labels. Do not copy one of these results to a reviewer packet or gold set.
 */
export interface PolicyHypothesisCounts {
  readonly noMatchingProfile: number;
  readonly noPermittedReading: number;
  readonly uniqueReadingProposal: number;
  readonly unresolvedMultipleReadings: number;
}
export interface AmbiguousReadingPolicyComparison {
  readonly candidateCount: number;
  readonly existingProductPolicy: PolicyHypothesisCounts;
  readonly existingPlusUnshippedZhongPilot: PolicyHypothesisCounts;
  readonly newlyUniqueZhongOnly: number;
  readonly differentOrZeroAfterPilot: number;
  readonly interpretation: "policy-only-source-upos-hypotheses-not-reading-gold";
}

function empty(): Record<keyof PolicyHypothesisCounts, number> {
  return {
    noMatchingProfile: 0, noPermittedReading: 0,
    uniqueReadingProposal: 0, unresolvedMultipleReadings: 0,
  };
}

type ReadingPolicy = (entry: CatalogEntry, profile: RuntimeSyntaxProfile) => boolean;

function survivingReadingIds(
  ids: readonly string[],
  sourceUpos: string,
  byEntry: ReadonlyMap<string, CatalogEntry>,
  profilesByEntry: ReadonlyMap<string, readonly RuntimeSyntaxProfile[]>,
  policy: ReadingPolicy,
): { readonly profileFound: boolean; readonly ids: ReadonlySet<string> } {
  const remaining = new Set<string>();
  let profileFound = false;
  for (const id of ids) {
    const entry = byEntry.get(id);
    if (entry === undefined) continue;
    for (const profile of profilesByEntry.get(id) ?? []) {
      if (profile.upos !== sourceUpos) continue;
      profileFound = true;
      if (policy(entry, profile)) remaining.add(id);
    }
  }
  return { profileFound, ids: remaining };
}
function record(
  counts: Record<keyof PolicyHypothesisCounts, number>,
  result: ReturnType<typeof survivingReadingIds>,
): void {
  if (!result.profileFound) counts.noMatchingProfile++;
  else if (result.ids.size === 0) counts.noPermittedReading++;
  else if (result.ids.size === 1) counts.uniqueReadingProposal++;
  else counts.unresolvedMultipleReadings++;
}

export function compareAttestedReadingPolicies(
  cases: readonly AttestedReadingReviewCandidate[],
  sentences: readonly (readonly UdOccurrenceToken[])[],
  entries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
): AmbiguousReadingPolicyComparison {
  const byEntry = new Map(entries.map(entry => [entry.id, entry]));
  if (byEntry.size !== entries.length) throw new Error("catalog contains duplicate reading identities");
  const profilesByEntry = new Map<string, RuntimeSyntaxProfile[]>();
  for (const profile of profiles) {
    const group = profilesByEntry.get(profile.entryId) ?? [];
    group.push(profile);
    profilesByEntry.set(profile.entryId, group);
  }
  const existing = empty(), pilot = empty();
  let newlyUniqueZhongOnly = 0, differentOrZeroAfterPilot = 0;
  for (const row of cases) {
    const token = sentences[row.sourceSentenceIndex]?.[row.sourceTokenIndex];
    if (token === undefined || token.id !== row.sourceTokenId || token.form !== row.text) {
      throw new Error("attested reading comparison source token mismatch");
    }
    if (row.possibleEntryIds.length < 2
      || new Set(row.possibleEntryIds).size !== row.possibleEntryIds.length
      || row.possibleEntryIds.some(id => byEntry.get(id)?.prompt.text !== row.text)) {
      throw new Error("attested reading comparison requires genuine competing catalog identities");
    }
    const baseline = survivingReadingIds(
      row.possibleEntryIds, token.upos, byEntry, profilesByEntry, reviewedRoleReadingEligible,
    );
    const proposed = survivingReadingIds(
      row.possibleEntryIds, token.upos, byEntry, profilesByEntry, reviewedZhongRolePilotEligible,
    );
    record(existing, baseline);
    record(pilot, proposed);
    if (baseline.ids.size !== proposed.ids.size
      || [...proposed.ids].some(id => !baseline.ids.has(id))) {
      differentOrZeroAfterPilot++;
      if (row.text === "種" && baseline.ids.size !== 1 && proposed.ids.size === 1) {
        newlyUniqueZhongOnly++;
      }
    }
  }
  for (const row of [existing, pilot]) {
    if (Object.values(row).reduce((a, b) => a + b, 0) !== cases.length) {
      throw new Error("review reading policy comparison partition drift");
    }
  }
  return {
    candidateCount: cases.length,
    existingProductPolicy: existing,
    existingPlusUnshippedZhongPilot: pilot,
    newlyUniqueZhongOnly, differentOrZeroAfterPilot,
    interpretation: "policy-only-source-upos-hypotheses-not-reading-gold",
  };
}
