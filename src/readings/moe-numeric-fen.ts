import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * A selected independent NOUN 分 after an adjacent complete numeric expression
 * has the measurable unit / points reading fēn (ㄈㄣ1), not fèn (ㄈㄣ4).
 * MOE Revised: https://dict.revised.moe.edu.tw/dictView.jsp?ID=1688
 * This gate does not ban other fèn noun senses (份額、身分、情分).
 * The observed frozen cases are #459 seeds 1720/slot 3 and 1967/slot 1.
 * No per-sentence naturalness scoring or lexical-catalog changes.
 */
const NUMBER = /^[零〇一二三四五六七八九十百千萬億兩0-9０-９]+$/u;
const UNIT_FEN = catalogEntryId("分", "ㄈㄣ1");

export function reviewedMoeNumericFenReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  _slot: unknown,
  previousEntry: CatalogEntry | null,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("numeric-fen policy must inspect the actual selected lexical identity");
  }
  if (entry.prompt.text !== "分" || profile.upos !== "NOUN"
    || previousEntry === null || !NUMBER.test(previousEntry.prompt.text)) {
    return true;
  }
  return entry.id === UNIT_FEN;
}
