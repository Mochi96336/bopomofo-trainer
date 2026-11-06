import { catalogEntryId } from "../core/catalog-entry-id.js";
import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../syntax/types.js";

/**
 * Supplement v1: exact reading/role mismatches independently checked against
 * MOE Revised on 2026-11-07. Sources and preservation cases are documented in
 * docs/readings-moe-role-supplement.md. No whole-word or unreviewed-role bans.
 * Historical policy stages remain frozen for reproducible paired comparisons.
 */
export const MOE_SUPPLEMENTAL_ROLE_RESTRICTIONS = [
  // 爲 is explicitly a variant of 為; the copula is wéi, not wèi.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=160753
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=11447
  { entryId: catalogEntryId("爲", "ㄨㄟ4"), rejectedUpos: ["AUX"] },
  // rén is a surname/classical adjective; the verb is rèn.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=9239
  { entryId: catalogEntryId("任", "ㄖㄣ2"), rejectedUpos: ["VERB"] },
  // qìng is the bound in-law reading, not the independent qīn adjective.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=6618
  { entryId: catalogEntryId("親", "ㄑㄧㄥ4"), rejectedUpos: ["ADJ"] },
  // qiāng is a request verb; the prospective adverb is jiāng.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=6555
  { entryId: catalogEntryId("將", "ㄑㄧㄤ1"), rejectedUpos: ["ADV"] },
  // wū is a noun/interjection; the preposition is yú.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=11248
  { entryId: catalogEntryId("於", "ㄨ1"), rejectedUpos: ["ADP"] },
  // bō and rě are bound Buddhist readings, not the independent roles below.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=712
  { entryId: catalogEntryId("般", "ㄅㄛ1"), rejectedUpos: ["ADJ"] },
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=9201
  { entryId: catalogEntryId("若", "ㄖㄜ3"), rejectedUpos: ["ADP"] },
  // yuàn is the distancing verb; the distance adjective is yuǎn.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=11837
  { entryId: catalogEntryId("遠", "ㄩㄢ4"), rejectedUpos: ["ADJ"] },
  // xiàng is a noun/verb; the reciprocal adverb is xiāng.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=7228
  { entryId: catalogEntryId("相", "ㄒㄧㄤ4"), rejectedUpos: ["ADV"] },
  // zhòng is verbal, unlike the locative zhōng selected as PART in UD.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=8171
  { entryId: catalogEntryId("中", "ㄓㄨㄥ4"), rejectedUpos: ["PART"] },
  // dàn measures capacity/weight; the independent surname is shí.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=2026
  { entryId: catalogEntryId("石", "ㄉㄢ4"), rejectedUpos: ["PROPN"] },
  // gǔ is the merchant/trading reading; the surname is jiǎ.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=4190
  { entryId: catalogEntryId("賈", "ㄍㄨ3"), rejectedUpos: ["PROPN"] },
  // píng is a historical verb/adverb; the surname is féng.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=977
  { entryId: catalogEntryId("馮", "ㄆㄧㄥ2"), rejectedUpos: ["PROPN"] },
  // gě denotes the capacity unit; the independent verb is hé.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=3968
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=75237
  { entryId: catalogEntryId("合", "ㄍㄜ3"), rejectedUpos: ["VERB"] },
  // mó belongs to 南無; independent negation/existence uses wú.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=1047
  { entryId: catalogEntryId("無", "ㄇㄛ2"), rejectedUpos: ["VERB"] },
  // dàn is the projectile noun; the independent action is tán.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=2045
  { entryId: catalogEntryId("彈", "ㄉㄢ4"), rejectedUpos: ["VERB"] },
  // The exact written form 只 uses zhǐ as an adverb and zhī as a classifier.
  // Do not conflate the separately attested zhī adverbs 祇 and 祗 with 只.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=7496
  { entryId: catalogEntryId("只", "ㄓ1"), rejectedUpos: ["ADV"] },
  // jù is an excess adverb (足恭); verbal sufficiency uses zú.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=6056
  { entryId: catalogEntryId("足", "ㄐㄩ4"), rejectedUpos: ["VERB"] },
] as const satisfies readonly { readonly entryId: string; readonly rejectedUpos: readonly Upos[] }[];

const rejected = new Map<string, ReadonlySet<Upos>>(
  MOE_SUPPLEMENTAL_ROLE_RESTRICTIONS.map(row => [row.entryId, new Set<Upos>(row.rejectedUpos)]),
);

export function isMoeSupplementalRoleMismatch(entryId: string, upos: Upos): boolean {
  return rejected.get(entryId)?.has(upos) ?? false;
}

export function reviewedMoeSupplementalRoleEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("supplemental reading policy must inspect actual selected catalog identity");
  }
  return !isMoeSupplementalRoleMismatch(entry.id, profile.upos);
}

/**
 * Follow-up to the frozen v1 population (a2de4f5). Keep this as a later
 * redraw stage so already-reviewed v1 replacements retain their distribution.
 * MOE Revised: surname 為 is wéi; hào is noun/verb, not adverbial hǎo.
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=11447
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=4814
 */
export const MOE_SUPPLEMENT_FOLLOWUP_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("為", "ㄨㄟ4"), rejectedUpos: ["PROPN"] },
  { entryId: catalogEntryId("好", "ㄏㄠ4"), rejectedUpos: ["ADV"] },
] as const satisfies readonly { readonly entryId: string; readonly rejectedUpos: readonly Upos[] }[];

const followupRejected = new Map<string, ReadonlySet<Upos>>(
  MOE_SUPPLEMENT_FOLLOWUP_ROLE_RESTRICTIONS.map(row => [row.entryId, new Set<Upos>(row.rejectedUpos)]),
);

export function isMoeSupplementFollowupRoleMismatch(entryId: string, upos: Upos): boolean {
  return followupRejected.get(entryId)?.has(upos) ?? false;
}

export function reviewedMoeSupplementFollowupRoleEligible(entry: CatalogEntry, profile: RuntimeSyntaxProfile): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("supplemental follow-up must inspect actual selected catalog identity");
  }
  return !isMoeSupplementFollowupRoleMismatch(entry.id, profile.upos);
}

/**
 * Independently reviewed new exposures in the 4,096-seed population at 98f47ff.
 * Keep the first two stages frozen; source details and rare-reading boundaries
 * are recorded in docs/readings-extended-review-queue.md.
 */
export const MOE_EXTENDED_ROLE_RESTRICTIONS = [
  // yù participates/intervenes as a verb; yǔ is the preposition.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=11662
  { entryId: catalogEntryId("與", "ㄩ4"), rejectedUpos: ["ADP"] },
  // chù denotes places/units; handling/residing uses chǔ.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=8586
  { entryId: catalogEntryId("處", "ㄔㄨ4"), rejectedUpos: ["VERB"] },
  // dòu is the noun for a textual pause, not the reading verb dú.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=2001
  { entryId: catalogEntryId("讀", "ㄉㄡ4"), rejectedUpos: ["VERB"] },
  // sì feeds as a verb; food as a noun uses shí.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=9995
  { entryId: catalogEntryId("食", "ㄙ4"), rejectedUpos: ["NOUN"] },
  // xiǎn names a plant or surname; washing uses xǐ.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=7125
  { entryId: catalogEntryId("洗", "ㄒㄧㄢ3"), rejectedUpos: ["VERB"] },
  // The independent surname is hā; hǎ belongs to 哈巴.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=4723
  { entryId: catalogEntryId("哈", "ㄏㄚ3"), rejectedUpos: ["PROPN"] },
  // The surname is zēng; céng retains its ADV/ADJ senses.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=9594
  { entryId: catalogEntryId("曾", "ㄘㄥ2"), rejectedUpos: ["PROPN"] },
  // The surname is rén, distinct from rèn's office/assignment senses.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=9239
  { entryId: catalogEntryId("任", "ㄖㄣ4"), rejectedUpos: ["PROPN"] },
  // qìng is bound in in-law lexemes; the independent contact verb is qīn.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=6618
  { entryId: catalogEntryId("親", "ㄑㄧㄥ4"), rejectedUpos: ["VERB"] },
  // The surname is hé; the unit reading gě remains a valid noun.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=3968
  { entryId: catalogEntryId("合", "ㄍㄜ3"), rejectedUpos: ["PROPN"] },
  // dài is bound in words such as 大夫, not independent adverb/adposition.
  // ADP was also delivered as a replacement for 與/ㄩ4 in seed 3651.
  // https://dict.revised.moe.edu.tw/dictView.jsp?ID=1936
  { entryId: catalogEntryId("大", "ㄉㄞ4"), rejectedUpos: ["ADV", "ADP"] },
] as const satisfies readonly { readonly entryId: string; readonly rejectedUpos: readonly Upos[] }[];

const extendedRejected = new Map<string, ReadonlySet<Upos>>(
  MOE_EXTENDED_ROLE_RESTRICTIONS.map(row => [row.entryId, new Set<Upos>(row.rejectedUpos)]),
);

export function isMoeExtendedRoleMismatch(entryId: string, upos: Upos): boolean {
  return extendedRejected.get(entryId)?.has(upos) ?? false;
}

export function reviewedMoeExtendedRoleEligible(entry: CatalogEntry, profile: RuntimeSyntaxProfile): boolean {
  if (entry.id !== profile.entryId) {
    throw new Error("extended reading policy must inspect actual selected catalog identity");
  }
  return !isMoeExtendedRoleMismatch(entry.id, profile.upos);
}
