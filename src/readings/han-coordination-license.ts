import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

export const HAN_COORDINATION_ENTRY_ID = catalogEntryId("和", "ㄏㄢ4");

/**
 * MOE Concised 和 hàn refers specifically to hé sense 7 (與、跟), and
 * Revised identifies it as the spoken reading of the conjunction sense.
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=19725
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=19016
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=4733
 *
 * GSD supplies written-form syntax, not an independent hàn pronunciation
 * annotation. Its ADP profile even includes one cc occurrence, so the
 * positive license requires the CCONJ profile as well as coordinator/cc.
 */
export function hanCoordinationProfileLicensed(
  entryId: string | undefined,
  profile: RuntimeSyntaxProfile,
): boolean {
  return entryId === HAN_COORDINATION_ENTRY_ID
    && profile.entryId === entryId
    && profile.upos === "CCONJ"
    && profile.functions.includes("coordinator")
    && (profile.dependencyEvidence.dependencyRelationCounts.cc ?? 0) > 0;
}

/** Other hàn roles remain context-required; existing identities are unchanged. */
export function reviewedHanCoordinationReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("reading eligibility must inspect the actually selected catalog identity");
  }
  return entry.id !== HAN_COORDINATION_ENTRY_ID
    || hanCoordinationProfileLicensed(entry.id, profile);
}
