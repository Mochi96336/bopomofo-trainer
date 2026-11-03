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

/**
 * Follow-up to #447: frozen #447 final product exposure (2,048 seeds).
 * These are 27 unsupported selected role uses over 26 seeds; #1024 has
 * two unrelated bad slots. Dictionary authority is Taiwan MOE Revised.
 *
 * 任/ㄖㄣ2 is an adjective meaning 佞 and a surname, not a determiner:
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=9239
 * 少/ㄕㄠ4 means young, not an amount ('few' = ㄕㄠ3):
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=8899
 * 幾/ㄐㄧ1 is small/dangerous/near and not the count 'how many' (= ㄐㄧ3):
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=5333
 * 大/ㄉㄞ4 belongs to 大夫 and is not standalone 'big' (= ㄉㄚ4):
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=1936
 *
 * Keep the old #447 rules unchanged for paired A/B reproducibility.
 * Both batches reuse the same generic role lookup, not bespoke per-word
 * eligibility functions. Unreviewed usage remains allowed.
 */
export const MOE_FOLLOWUP_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("任","ㄖㄣ2"), rejectedUpos:["DET"] },
  { entryId: catalogEntryId("少","ㄕㄠ4"), rejectedUpos:["NUM"] },
  { entryId: catalogEntryId("幾","ㄐㄧ1"), rejectedUpos:["NUM"] },
  { entryId: catalogEntryId("大","ㄉㄞ4"), rejectedUpos:["ADJ"] },
] as const satisfies readonly { readonly entryId:string; readonly rejectedUpos:readonly Upos[] }[];

function makeMismatchLookup(
  rows:readonly { readonly entryId:string; readonly rejectedUpos:readonly Upos[] }[],
): (entryId:string,upos:Upos)=>boolean {
  const map = new Map<string,ReadonlySet<Upos>>();
  for(const row of rows) {
    if(map.has(row.entryId))throw new Error("duplicate MOE role entry "+row.entryId);
    map.set(row.entryId,new Set<Upos>(row.rejectedUpos));
  }
  return (entryId,upos)=>map.get(entryId)?.has(upos)??false;
}

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

const followupMismatch = makeMismatchLookup(MOE_FOLLOWUP_ROLE_RESTRICTIONS);

export function isMoeFollowupRoleMismatch(entryId:string,upos:Upos):boolean {
  return followupMismatch(entryId,upos);
}

export function reviewedMoeFollowupRoleEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
):boolean {
  if(entry.id!==profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeFollowupRoleMismatch(entry.id,profile.upos);
}
