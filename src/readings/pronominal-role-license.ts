import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import { CONSTRUCTION_READINGS } from "../syntax/lexical-feature-match.js";
import type { RuntimeSyntaxProfile, Upos } from "../syntax/types.js";
import { reviewedClosedClassReadingEligible } from "./closed-class-license.js";
import { reviewedAdjectiveReadingEligible } from "./adjective-role-license.js";

/**
 * Pronoun / determiner evidence, scoped to a written form AND a selected
 * grammatical role. No inference is made about a written form as a whole.
 *
 * - 哪 / PRON: interrogative pronoun nǎ / něi, reusing the existing reviewed
 *   construction pins. Light-tone particle or other rare identities must not
 *   inherit PRON from the surface-keyed UD artifact.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=2931
 * - 那 / DET: demonstrative determiner nà. Different senses, including
 *   interrogative pronoun nǎ and archaic nuó, are deliberately NOT addressed
 *   outside this precise role.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=2930
 *
 * These reviewed roles now gate production selection, only when the selected
 * lexical profile has the specific reviewed role. Unreviewed contexts remain
 * eligible rather than being converted to a default pronunciation.
 */
const REVIEWED_ROLE_READINGS: Readonly<
  Record<string, Readonly<Partial<Record<Upos, readonly string[]>>>>
> = {
  哪: { PRON: CONSTRUCTION_READINGS["哪"]! },
  那: { DET: ["ㄋㄚ4"] },
};

const APPROVED_BY_ROLE = new Map<string, ReadonlySet<string>>();
for (const [text, byRole] of Object.entries(REVIEWED_ROLE_READINGS)) {
  for (const [upos, readings] of Object.entries(byRole)) {
    if (readings === undefined || readings.length === 0) {
      throw new Error("missing reviewed reading for " + text + "/" + upos);
    }
    APPROVED_BY_ROLE.set(
      text + "/" + upos,
      new Set(readings.map((reading) => catalogEntryId(text, reading))),
    );
  }
}

export function reviewedPronominalReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (profile.entryId !== entry.id) {
    throw new Error("reading eligibility must inspect the actually selected catalog identity");
  }
  const approved = APPROVED_BY_ROLE.get(entry.prompt.text + "/" + profile.upos);
  return approved === undefined || approved.has(entry.id);
}

/** Combined reviewed policy used by the product selector and audit. */
export function reviewedRoleReadingEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  return reviewedClosedClassReadingEligible(entry, profile)
    && reviewedPronominalReadingEligible(entry, profile)
    && reviewedAdjectiveReadingEligible(entry, profile);
}

/** Reviewed role keys are exported to make the boundary inspectable by tests. */
export const REVIEWED_PRONOMINAL_ROLE_READINGS = REVIEWED_ROLE_READINGS;
