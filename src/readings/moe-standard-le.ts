import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * Official Taiwan MOE standard for the EXACT standalone written character 了.
 * Both readings are valid; CC-CEDICT's additional liào4 identity is not
 * among the MOE-reviewed standard Mandarin pronunciations for this word.
 *
 * Neither character-composition inside larger lexemes nor clause/word
 * naturalness is used to license readings.
 *
 * MOE Concised ㄌㄧㄠ3: https://dict.concised.moe.edu.tw/dictView.jsp?ID=14406
 * MOE Concised ˙ㄌㄜ: https://dict.concised.moe.edu.tw/dictView.jsp?ID=13268
 * MOE approved polyphonic index, record 0026:
 * https://language.moe.gov.tw/001/Upload/Files/wxiao89/a.pdf
 */
const APPROVED_LE_IDENTITIES = new Set([
  catalogEntryId("了", "ㄌㄧㄠ3"),
  catalogEntryId("了", "ㄌㄜ5"),
]);

export function reviewedMoeStandardLeReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (profile.entryId !== entry.id) {
    throw new Error("standard reading must inspect actual selected catalog identity");
  }
  return entry.prompt.text !== "了" || APPROVED_LE_IDENTITIES.has(entry.id);
}
