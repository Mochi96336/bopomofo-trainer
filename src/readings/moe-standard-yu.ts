import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * MOE Concised and Revised both list standalone 於 as ㄩ2 or ㄨ1.
 * Neither lists ㄩ1. Scope this policy to the exact *selected entry*;
 * rare legal readings and whole-word entries remain untouched.
 *
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=44183
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=42632
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=11601
 */
export const NONSTANDARD_YU_FIRST_TONE_ID = catalogEntryId("於","ㄩ1");

export function reviewedMoeStandardYuReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (profile.entryId !== entry.id) {
    throw new Error("standard reading must inspect actual selected catalog identity");
  }
  return entry.id !== NONSTANDARD_YU_FIRST_TONE_ID;
}
