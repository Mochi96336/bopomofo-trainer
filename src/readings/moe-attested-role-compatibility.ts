import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../syntax/types.js";

/**
 * Only exact *selected* lexical identities with an independently verified
 * MOE reading/sense-to-UPOS incompatibility belong here. This is not
 * a complete dictionary: unsupported sources / unreviewed roles are left
 * unchanged, not silently banned. Never infer a prohibition merely because
 * a pronunciation is rare.
 *
 * The five entries below were actually delivered in the frozen #446
 * 2,048-seed product population: 16 uses across 16 distinct seeds.
 *
 * Source (MOE Revised):
 * - 數/ㄕㄨㄛ4 means "repeatedly", ADV, not a numeral.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=9152
 * - 單/ㄕㄢ4 is a surname / place name (單縣), not a numeral.
 * - 單/ㄔㄢ2 appears in the bound lexeme 單于, not a numeral.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=8375
 * - 六/ㄌㄨ4 is an ancient country name / surname, not six.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=3758
 * - 地/ㄉㄜ5 is a structural particle, not the earth/place noun.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=1925
 *
 * Leave allowed historical readings in the catalog and in unrelated
 * lexical functions untouched. Product corrections use the existing
 * final-successful-candidate redraw machinery as one ordered stage.
 */
export const MOE_ATTESTED_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("數", "ㄕㄨㄛ4"), rejectedUpos: ["NUM"] },
  { entryId: catalogEntryId("單", "ㄕㄢ4"), rejectedUpos: ["NUM"] },
  { entryId: catalogEntryId("單", "ㄔㄢ2"), rejectedUpos: ["NUM"] },
  { entryId: catalogEntryId("六", "ㄌㄨ4"), rejectedUpos: ["NUM"] },
  { entryId: catalogEntryId("地", "ㄉㄜ5"), rejectedUpos: ["NOUN"] },
] as const satisfies readonly { readonly entryId: string; readonly rejectedUpos: readonly Upos[] }[];

const incompatibleRoles = new Map<string, ReadonlySet<Upos>>(
  MOE_ATTESTED_ROLE_RESTRICTIONS.map(rule => [
    rule.entryId,
    new Set<Upos>(rule.rejectedUpos),
  ]),
);

export function isMoeAttestedRoleMismatch(entryId: string, upos: Upos): boolean {
  return incompatibleRoles.get(entryId)?.has(upos) ?? false;
}

export function reviewedMoeAttestedRoleEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeAttestedRoleMismatch(entry.id, profile.upos);
}
