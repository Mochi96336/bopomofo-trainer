import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * MOE Revised: 那/ㄋㄚ1 (nā) is a surname; unlike 那/ㄋㄚ4 (nà,
 * demonstrative) or 那/ㄋㄚ3 (nǎ, interrogative).
 *
 * Do NOT globally remove the valid surname identity. The observed
 * 2048-seed learner failures all select it with ordinary PRON or ADV
 * syntax profiles, which cannot denote the surname.
 *
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=2940
 */
export const NA_SURNAME_FIRST_TONE_ID = catalogEntryId("那", "ㄋㄚ1");

export function reviewedMoeNaSurnameRoleEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("surname reading policy must inspect actual selected catalog identity");
  }
  return entry.id !== NA_SURNAME_FIRST_TONE_ID
    || (profile.upos !== "PRON" && profile.upos !== "ADV");
}
