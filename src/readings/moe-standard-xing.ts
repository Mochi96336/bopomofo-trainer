import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * MOE Concised and Revised give standalone 行 exactly four readings:
 * ㄒㄧㄥ2, ㄒㄧㄥ4, ㄏㄤ2, ㄏㄤ4. Neither lists ㄏㄥ2.
 *
 * This unsupported CEDICT-like identity was sampled twice in the
 * #442 shipped 2048-seed population. Crucially, seed 967 obtained
 * it as the replacement for an earlier rejected 得/ㄉㄜ4.
 * Check the actual *delivered* lexical identity, not just its source.
 *
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=19765
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=4915
 */
export const NONSTANDARD_XING_HENG_SECOND_TONE_ID = catalogEntryId("行", "ㄏㄥ2");

export function reviewedMoeStandardXingReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("standard reading must inspect actual selected catalog identity");
  }
  return entry.id !== NONSTANDARD_XING_HENG_SECOND_TONE_ID;
}
