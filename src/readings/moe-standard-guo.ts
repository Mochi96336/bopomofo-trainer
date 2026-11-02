import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * Scope: exact standalone 過 / ㄍㄨㄛ5 under the Taiwan MOE dictionary standard.
 * MOE Concised lists ㄍㄨㄛ4 (verb/aspect particle) and ㄍㄨㄛ1 (surname);
 * MOE Revised lists the same pair and no neutral-tone headword reading.
 * A colloquial neutralized form in other Mandarin norms must not be confused
 * with the Taiwan MOE headword/practice-answer rule used by this project.
 *
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=17085
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=16923
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=4256
 */
export const NONSTANDARD_GUO_NEUTRAL_ID = catalogEntryId("過","ㄍㄨㄛ5");

export function reviewedMoeStandardGuoReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("standard reading must inspect actual selected catalog identity");
  }
  return entry.id !== NONSTANDARD_GUO_NEUTRAL_ID;
}
