import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import { reviewedAdjectiveReadingEligible } from "./adjective-role-license.js";
import { reviewedRoleReadingEligible } from "./pronominal-role-license.js";

/**
 * Reviewed local written-word context: 第三 + 行 (the third *line/row*)
 * requires standalone 行:ㄏㄤ2. It is *not* a global 行/NOUN reading rule.
 *
 * The composer visits lexical slots in surface order, resetting the preceding
 * lexical entry for punctuation and literal boundaries. Consequently this
 * policy can constrain the *current slot's* licensed candidate frontier.
 *
 * MOE Revised Dictionary, 行 ㄏㄤ2: a row/line.
 */
const ROW_READING_ID = catalogEntryId("行", "ㄏㄤ2");
const ORDINAL_WORD = /^第[一二三四五六七八九十百千萬兩零〇0-9０-９]+$/u;

export function reviewedOrdinalLineReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  previousEntry: CatalogEntry | null,
): boolean {
  if (profile.entryId !== entry.id) {
    throw new Error("contextual reading must inspect the selected catalog identity");
  }
  if (entry.prompt.text !== "行" || previousEntry === null
    || !ORDINAL_WORD.test(previousEntry.prompt.text)) return true;
  return entry.id === ROW_READING_ID;
}

/** Compose the existing reviewed role gate with one exact adjacent-word rule. */
export function reviewedRoleAndOrdinalLineReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  _slot: unknown,
  previousEntry: CatalogEntry | null,
): boolean {
  return reviewedRoleReadingEligible(entry, profile)
    && reviewedOrdinalLineReadingEligible(entry, profile, previousEntry);
}


/**
 * Shared *pre-draw* scope for two independently reviewed contexts.
 *
 * This is intentionally NOT the entire role license: broad prefiltering
 * changes the probabilities of unrelated word classes. At each lexical slot,
 * remove only unlicensed standalone 好/ADJ and immediate 第N行 identities
 * before learner/frequency weights are evaluated.
 */
export function reviewedContextualPreDrawReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
  _slot: unknown,
  previousEntry: CatalogEntry | null,
): boolean {
  return reviewedAdjectiveReadingEligible(entry, profile)
    && reviewedOrdinalLineReadingEligible(entry, profile, previousEntry);
}
