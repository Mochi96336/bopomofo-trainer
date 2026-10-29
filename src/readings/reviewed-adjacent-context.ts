import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import {
  reviewedOrdinalLineReadingEligible,
  reviewedRoleAndOrdinalLineReadingEligible,
} from "./ordinal-line-context.js";

/**
 * Precise, source-attested adjacent-lexeme reading: 多少 + standalone 種
 * means "how many kinds" and uses the classifier ㄓㄨㄥ3.
 *
 * No rule is inferred for arbitrary 種/NOUN, 種/VERB, other neighbors,
 * or compound entries; raw UPOS may be mistaken. The two phonetic
 * identities remain available in every unreviewed context.
 *
 * MOE Concised Dictionary, 種 ㄓㄨㄥ3 (classifier):
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=31268
 * MOE Concised Dictionary, 種 ㄓㄨㄥ4 (plant/inoculate):
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=31340
 */
const QUANTITY_ZHONG_READING = catalogEntryId("種", "ㄓㄨㄥ3");

export function reviewedDuoshaoZhongReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  previousEntry: CatalogEntry | null,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("adjacent reading eligibility must inspect selected catalog identity");
  }
  if (previousEntry?.prompt.text !== "多少" || entry.prompt.text !== "種") {
    return true;
  }
  return entry.id === QUANTITY_ZHONG_READING;
}

/** Common, scoped pre-draw reading frontier: license before learner weights. */
export function reviewedAdjacentPreDrawReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  _slot: unknown,
  previousEntry: CatalogEntry | null,
): boolean {
  return reviewedOrdinalLineReadingEligible(entry, profile, previousEntry)
    && reviewedDuoshaoZhongReadingEligible(entry, profile, previousEntry);
}

/** Keep reviewed role and ordinal gates, then add only 多少+種. */
export function reviewedAdjacentReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  slot: unknown,
  previousEntry: CatalogEntry | null,
): boolean {
  return reviewedRoleAndOrdinalLineReadingEligible(entry, profile, slot, previousEntry)
    && reviewedDuoshaoZhongReadingEligible(entry, profile, previousEntry);
}
