import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../syntax/types.js";
import { reviewedRoleReadingEligible } from "./pronominal-role-license.js";

/**
 * Opt-in lexical-sense ROLE experiment for 種 only.
 *
 * MOE senses: ㄓㄨㄥ3 = noun/category/measure; ㄓㄨㄥ4 = act of planting.
 * Only VERB and NOUN UPOS are reviewed here; any other UPOS (including
 * classifiers represented as NUM/DET) remains UNKNOWN / eligible.
 *
 * UPOS data are keyed by surface forms in the current UD projection, not
 * per-reading tokens. Never extrapolate from this to an arbitrary lexical
 * sense or apply this rule in production before an exposure/collateral audit.
 *
 * Evidence: https://dict.concised.moe.edu.tw/dictView.jsp?ID=31268
 *           https://dict.concised.moe.edu.tw/dictView.jsp?ID=31340
 */
const ZHONG_PILOT_BY_UPOS: Readonly<Partial<Record<Upos, string>>> = {
  NOUN: catalogEntryId("種", "ㄓㄨㄥ3"),
  VERB: catalogEntryId("種", "ㄓㄨㄥ4"),
};

export function reviewedZhongRolePilotEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (profile.entryId !== entry.id) {
    throw new Error("reading eligibility must inspect selected catalog entry identity");
  }
  if (!reviewedRoleReadingEligible(entry, profile)) return false;
  if (entry.prompt.text !== "種") return true;
  const required = ZHONG_PILOT_BY_UPOS[profile.upos];
  return required === undefined || entry.id === required;
}

export const ZHONG_PILOT_READING_IDS_BY_UPOS = ZHONG_PILOT_BY_UPOS;
