import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * Taiwan MOE Concised / Revised: standalone 南 has ㄋㄢ2 and ㄋㄚ2.
 * The special Buddhist-transliteration sound ㄋㄚ2 remains legitimate.
 * Neither source lists first-tone ㄋㄚ1. Never infer a pronunciation
 * merely from the sense or fluency of a constructed sentence.
 *
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=12395
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=12131
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=2927
 */
export const NONSTANDARD_NAN_FIRST_TONE_ID = catalogEntryId("南", "ㄋㄚ1");

export function reviewedMoeStandardNanReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("standard reading must inspect actual selected catalog identity");
  }
  return entry.id !== NONSTANDARD_NAN_FIRST_TONE_ID;
}
