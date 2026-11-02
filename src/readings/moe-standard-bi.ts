import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * MOE Concised dictionary identifies exactly three STANDARD standalone
 * readings of 比: ㄅㄧ3, ㄅㄧ4, ㄆㄧ2. The additional CC-CEDICT ㄅㄧ1
 * candidate has no corresponding listed MOE pronunciation for this headword.
 *
 * This is an exact entry identity gate, NOT a claim that one of the three
 * readings is correct for every grammatical role/context.
 *
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=1218
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=1285
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=2978
 */
export const NONSTANDARD_BI_FIRST_TONE_ID = catalogEntryId("比", "ㄅㄧ1");

const MOE_BI_IDENTITIES = new Set([
  catalogEntryId("比", "ㄅㄧ3"),
  catalogEntryId("比", "ㄅㄧ4"),
  catalogEntryId("比", "ㄆㄧ2"),
]);

export function reviewedMoeStandardBiReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("standard reading must inspect actual selected catalog identity");
  }
  return entry.prompt.text !== "比" || MOE_BI_IDENTITIES.has(entry.id);
}
