import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";

/**
 * Reviewed adjective-position reading for the *standalone entry* 好.
 *
 * In the "good / satisfactory" adjectival sense, 好 is ㄏㄠ3.
 * ㄏㄠ4 means "to like / be fond of" (and has nominal uses).
 * This does not authorize character-wide rewriting inside compounds.
 *
 * Product runtime syntax profiles are surface-projected UD evidence:
 * the selected ADJ role is the ONLY evidence scoped by this gate.
 * Unknown VERB/NOUN/ADV or other roles remain eligible, not guessed.
 *
 * Sources (MOE Concised Dictionary):
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=19419
 * https://dict.concised.moe.edu.tw/dictView.jsp?ID=19462
 */
const ADJECTIVAL_HAO_ID = catalogEntryId("好", "ㄏㄠ3");

export const REVIEWED_ADJECTIVE_ROLE_READINGS = {
  好: { ADJ: ["ㄏㄠ3"] },
} as const;

export function reviewedAdjectiveReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (profile.entryId !== entry.id) {
    throw new Error("reading eligibility must inspect the actually selected catalog identity");
  }
  return entry.prompt.text !== "好" || profile.upos !== "ADJ"
    || entry.id === ADJECTIVAL_HAO_ID;
}

/**
 * Limit the lexeme-preserving repair to the reviewed good/satisfactory
 * adjectival sense. A contextual target lacking an authorized reading
 * must not be silently renamed to practise a different tone.
 */
export function preferReviewedHaoAdjectiveSurfaceRepair(
  rejected: CatalogEntry,
  selectedProfile: RuntimeSyntaxProfile,
): boolean {
  return rejected.prompt.text === "好" && selectedProfile.upos === "ADJ";
}
