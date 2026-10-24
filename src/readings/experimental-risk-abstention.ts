import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import { reviewedRoleReadingEligible } from "./pronominal-role-license.js";

/**
 * STRICTLY OPT-IN research gate for two observed candidate-identity risks.
 *
 * A generated syntax profile, often projected from the WRITTEN SURFACE, is
 * NOT a verified sentence sense. Thus excluding either candidate is only
 * an experimental "abstain from this candidate" test, not proof that its
 * alternative reading is correct. Never wire into product/session.ts.
 *
 * Crucial counterexample: GSD train-s3887#2 marks the NOMINAL species 種
 * as VERB. We must not force 種/VERB to the planting fourth tone. This gate
 * deliberately leaves both source-VERB readings eligible.
 *
 * Source: pinned GSD original train + the existing 2048-seed generated output.
 * Independent human approval/holdout verification is NOT available.
 */
const RISK_IDENTITY_BY_ROLE = new Map<string, string>([
  ["種/NOUN", catalogEntryId("種", "ㄓㄨㄥ4")],
  ["給/VERB", catalogEntryId("給", "ㄐㄧ3")],
]);

export function experimentalRiskAbstentionEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (profile.entryId !== entry.id) {
    throw new Error("reading eligibility must preserve exact catalog entry identity");
  }
  if (!reviewedRoleReadingEligible(entry, profile)) return false;
  const flaggedIdentity = RISK_IDENTITY_BY_ROLE.get(
    entry.prompt.text + "/" + profile.upos,
  );
  return flaggedIdentity === undefined || entry.id !== flaggedIdentity;
}

/** REVIEW-ONLY: do not turn these raw surface+UPOS pairs into approved gold. */
export const EXPERIMENTAL_RISK_ABSTENTION_BY_ROLE = RISK_IDENTITY_BY_ROLE;
export const EXPERIMENTAL_RISK_ABSTENTION_APPROVED_FOR_PRODUCT = false;

/** Opt-in rescue is applied only to the NEW research exclusions,
 * never to unrelated already-reviewed production reading rejections. */
export function experimentalRiskSameWordPreference(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): "same-surface-first" | undefined {
  if (profile.entryId !== entry.id) {
    throw new Error("reading rescue requires the actually rejected catalog identity");
  }
  const key=entry.prompt.text + "/" + profile.upos;
  return reviewedRoleReadingEligible(entry,profile)
    && RISK_IDENTITY_BY_ROLE.get(key)===entry.id
      ? "same-surface-first" : undefined;
}

/** Same risk scope as the earlier opt-in trial, but allows the composer to
 * accept its sole licensed same-word profile without advancing the RNG.
 * If there is more than one profile it still draws (cannot invent a choice). */
export function experimentalRiskSingleAlternativePreference(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): "same-surface-singleton-no-draw" | undefined {
  return experimentalRiskSameWordPreference(entry, profile) === "same-surface-first"
    ? "same-surface-singleton-no-draw" : undefined;
}
