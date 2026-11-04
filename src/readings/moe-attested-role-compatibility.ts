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

const attestedMismatch = makeMismatchLookup(MOE_ATTESTED_ROLE_RESTRICTIONS);

export function isMoeAttestedRoleMismatch(entryId: string, upos: Upos): boolean {
  return attestedMismatch(entryId, upos);
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


/**
 * Evidence from the exact #448 final 2,048-seed product population.
 * 24 selected lexical slots, in 24 distinct seeds. Restrict only the
 * attested incompatible reading+UPOS; all other lexical roles survive.
 *
 * MOE Revised:
 * - 為/ㄨㄟ4 is a preposition (for/because), not the copular AUX "is":
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=11447
 * - 種/ㄓㄨㄥ4 is the verb plant/inoculate, not the noun/classifier kind:
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=8169
 * - 上/ㄕㄤ3 is the tone name in 上聲, not "previous/upper" determiner:
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=9040
 *
 * The general noun 上/ㄕㄤ3 is NOT blanket-banned because the tone-name
 * sense is dictionary-attested. No natural-language fluency judgment.
 */
export const MOE_THIRD_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("為","ㄨㄟ4"), rejectedUpos:["AUX"] },
  { entryId: catalogEntryId("種","ㄓㄨㄥ4"), rejectedUpos:["NOUN"] },
  { entryId: catalogEntryId("上","ㄕㄤ3"), rejectedUpos:["DET"] },
] as const satisfies readonly { readonly entryId:string; readonly rejectedUpos:readonly Upos[] }[];

const thirdMismatch = makeMismatchLookup(MOE_THIRD_ROLE_RESTRICTIONS);

export function isMoeThirdRoleMismatch(entryId:string,upos:Upos):boolean {
  return thirdMismatch(entryId,upos);
}

export function reviewedMoeThirdRoleEligible(
  entry: CatalogEntry,
  profile: RuntimeSyntaxProfile,
):boolean {
  if(entry.id!==profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeThirdRoleMismatch(entry.id,profile.upos);
}


/**
 * Frozen from the #450 exact final delivered 2,048-seed product exposure,
 * after all previous confirmed role gates. 11 wrong reading/UPOS uses in
 * 11 distinct seeds; the whole word and its other legal senses survive.
 *
 * Official MOE Revised / Concised references:
 * 上/ㄕㄤ3 names a tone, not ADV/VERB (Revised ID 9040; Concised ID 34855).
 * 中/ㄓㄨㄥ4 denotes hitting/attaining as a VERB, not NOUN/PROPN
 *   (Revised ID 8171).
 * 少/ㄕㄠ4 means young as ADJ/NOUN/PROPN, not 'less' as ADV
 *   (Revised ID 8899).
 * 數/ㄕㄨ3 denotes counting as VERB, not a numeral
 *   (Revised ID 9108; Concised ID 35410).
 * 大/ㄉㄞ4 occurs in the full lexical word 大夫, not a standalone NOUN
 *   (Revised ID 1936, compound ID 42277).
 * 王/ㄨㄤ4 denotes reigning as VERB, not the name/title/surname
 *   (Revised ID 11561).
 * 正/ㄓㄥ1 appears in 正月 etc., not the grammatical PART
 *   (Revised ID 7949).
 *
 * Proper-name ambiguity remains out of scope for 大/ㄉㄞ4 PROPN.
 */
export const MOE_FOURTH_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("上","ㄕㄤ3"), rejectedUpos:["ADV","VERB"] },
  { entryId: catalogEntryId("中","ㄓㄨㄥ4"), rejectedUpos:["NOUN","PROPN"] },
  { entryId: catalogEntryId("少","ㄕㄠ4"), rejectedUpos:["ADV"] },
  { entryId: catalogEntryId("數","ㄕㄨ3"), rejectedUpos:["NUM"] },
  { entryId: catalogEntryId("大","ㄉㄞ4"), rejectedUpos:["NOUN"] },
  { entryId: catalogEntryId("王","ㄨㄤ4"), rejectedUpos:["PROPN"] },
  { entryId: catalogEntryId("正","ㄓㄥ1"), rejectedUpos:["PART"] },
] as const satisfies readonly {readonly entryId:string;readonly rejectedUpos:readonly Upos[]}[];

const fourthMismatch = makeMismatchLookup(MOE_FOURTH_ROLE_RESTRICTIONS);

export function isMoeFourthRoleMismatch(entryId:string,upos:Upos):boolean {
  return fourthMismatch(entryId,upos);
}

export function reviewedMoeFourthRoleEligible(
  entry:CatalogEntry,
  profile:RuntimeSyntaxProfile,
):boolean {
  if(entry.id!==profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeFourthRoleMismatch(entry.id,profile.upos);
}


/**
 * #451 final product 2,048-seed exposure: seven exact reading+UPOS mismatches
 * in seven separate, frozen lexical slots. Other usages remain eligible.
 *
 * MOE Revised:
 * - 與/ㄩ2 is a sentence-final particle (yú), not ADP (yǔ).
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=11662
 * - 藏/ㄗㄤ4 denotes a noun (store, organ, Tibet, canon), not hide/store VERB.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=9592
 * - 任/ㄖㄣ2 is a surname or classical adjective, not the ordinal post NOUN
 *   as in 第一任 (rèn, a term of office).
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=9258
 * - 佛/ㄈㄨ2 is bound in 仿佛/彷彿, not standalone Buddha NOUN (fó).
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=1783
 * - 陸/ㄌㄧㄡ4 is uppercase six, not the surname 陸 (lù) PROPN.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=3784
 * - 番/ㄆㄢ1 belongs to 番禺, not noun/classifier 番 (fān).
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=606
 * - 把/ㄅㄚ4 means a handle (noun), not the verb bǎ.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=137
 *
 * Never ban rare valid readings wholesale: only these selected roles.
 */
export const MOE_FIFTH_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("與","ㄩ2"), rejectedUpos:["ADP"] },
  { entryId: catalogEntryId("藏","ㄗㄤ4"), rejectedUpos:["VERB"] },
  { entryId: catalogEntryId("任","ㄖㄣ2"), rejectedUpos:["NOUN"] },
  { entryId: catalogEntryId("佛","ㄈㄨ2"), rejectedUpos:["NOUN"] },
  { entryId: catalogEntryId("陸","ㄌㄧㄡ4"), rejectedUpos:["PROPN"] },
  { entryId: catalogEntryId("番","ㄆㄢ1"), rejectedUpos:["NOUN"] },
  { entryId: catalogEntryId("把","ㄅㄚ4"), rejectedUpos:["VERB"] },
] as const satisfies readonly {readonly entryId:string;readonly rejectedUpos:readonly Upos[]}[];

const fifthMismatch = makeMismatchLookup(MOE_FIFTH_ROLE_RESTRICTIONS);
export function isMoeFifthRoleMismatch(entryId:string,upos:Upos):boolean {
  return fifthMismatch(entryId,upos);
}
export function reviewedMoeFifthRoleEligible(entry:CatalogEntry,profile:RuntimeSyntaxProfile):boolean {
  if(entry.id!==profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeFifthRoleMismatch(entry.id,profile.upos);
}


/**
 * Sixth evidence-bounded role gate, frozen from #452's actual final fifth
 * 2,048-seed product report: exactly 9 selected wrong lexical slots across
 * 8 seeds. Restrict only these five exact reading/UPOS pairs; leave other
 * attested pronunciations and lexical roles available.
 *
 * Official MOE Revised / Concised:
 * - 個/ㄍㄜ3 is attested in the complete lexeme 自個兒, not the standalone
 *   noun/classifier 個 (ㄍㄜ4). https://dict.revised.moe.edu.tw/dictView.jsp?ID=3969
 * - 得/ㄉㄜ5 is a structural particle, not a lexical VERB (ㄉㄜ2/ㄉㄟ3).
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=1923
 * - 惡/ㄜ3 describes feeling nauseated, not the adjective evil (ㄜ4).
 *   https://dict.concised.moe.edu.tw/dictView.jsp?ID=39408
 * - 著/ㄓㄜ5 is an aspectual particle, not lexical VERB.
 *   https://dict.concised.moe.edu.tw/dictView.jsp?ID=29560
 * - 處/ㄔㄨ3 is to stay/handle (VERB), not place/department NOUN (ㄔㄨ4).
 *   https://dict.concised.moe.edu.tw/dictView.jsp?ID=32641
 *
 * Rare legitimate sounds are not global invalid readings.
 */
export const MOE_SIXTH_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("個","ㄍㄜ3"), rejectedUpos:["NOUN"] },
  { entryId: catalogEntryId("得","ㄉㄜ5"), rejectedUpos:["VERB"] },
  { entryId: catalogEntryId("惡","ㄜ3"), rejectedUpos:["ADJ"] },
  { entryId: catalogEntryId("著","ㄓㄜ5"), rejectedUpos:["VERB"] },
  { entryId: catalogEntryId("處","ㄔㄨ3"), rejectedUpos:["NOUN"] },
] as const satisfies readonly {readonly entryId:string;readonly rejectedUpos:readonly Upos[]}[];

const sixthMismatch = makeMismatchLookup(MOE_SIXTH_ROLE_RESTRICTIONS);
export function isMoeSixthRoleMismatch(entryId:string,upos:Upos):boolean {
  return sixthMismatch(entryId,upos);
}
export function reviewedMoeSixthRoleEligible(entry:CatalogEntry,profile:RuntimeSyntaxProfile):boolean {
  if(entry.id!==profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeSixthRoleMismatch(entry.id,profile.upos);
}


/**
 * Seventh role-identity evidence: actual #453 sixth-stage final output.
 * 18 selected incompatible 和 reading/UPOS slots in 17 frozen seeds.
 *
 * MOE Revised (https://dict.revised.moe.edu.tw/dictView.jsp?ID=4733):
 * - 和/ㄏㄜ2 is attested as a noun (sum, peace, Japan) and surname.
 * - 和/ㄏㄜ4 describes answering song or poetry (VERB), not a noun/name.
 * - 和/ㄏㄨ2 denotes winning a mahjong hand (VERB), not a noun/name.
 * - 和/ㄏㄨㄛ4 describes mixing (VERB), not a noun/name.
 * Older MOE 一字多音審訂表 also attests 和/ㄏㄨㄛ2 as in 和麵:
 * do not ban this pronunciation globally or infer it is impossible.
 * It does not describe a PROPN in the cited examples.
 *
 * Only the seven exact reading/UPOS combinations are excluded. Legitimate
 * surname 和/ㄏㄜ2 and action readings in verb roles remain available.
 */
export const MOE_SEVENTH_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("和","ㄏㄜ4"), rejectedUpos:["PROPN","NOUN"] },
  { entryId: catalogEntryId("和","ㄏㄨ2"), rejectedUpos:["PROPN","NOUN"] },
  { entryId: catalogEntryId("和","ㄏㄨㄛ4"), rejectedUpos:["PROPN","NOUN"] },
  { entryId: catalogEntryId("和","ㄏㄨㄛ2"), rejectedUpos:["PROPN"] },
] as const satisfies readonly {readonly entryId:string;readonly rejectedUpos:readonly Upos[]}[];

const seventhMismatch = makeMismatchLookup(MOE_SEVENTH_ROLE_RESTRICTIONS);
export function isMoeSeventhRoleMismatch(entryId:string,upos:Upos):boolean {
  return seventhMismatch(entryId,upos);
}
export function reviewedMoeSeventhRoleEligible(entry:CatalogEntry,profile:RuntimeSyntaxProfile):boolean {
  if(entry.id!==profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeSeventhRoleMismatch(entry.id,profile.upos);
}


/**
 * Exact eighth-batch reading × UPOS mismatches from the latest final seventh
 * 2048-seed output (after merged #456). Seven actual lexical slots in seven
 * distinct seeds. No blanket prohibition of any valid reading.
 *
 * MOE Revised:
 * - 大/ㄉㄞ4 has the bound lexical reading in 大夫, not standalone PROPN.
 *   大/ㄉㄚ4 has an attested surname reading.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=1936
 * - 那/ㄋㄨㄛ2 is classical PRON ("如何、奈何"), verb, adjective, or
 *   title/noun, not ADV; 那/ㄋㄚ3 has a separately attested adverb meaning.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=3142
 * - 重/ㄔㄨㄥ2 and 重/ㄓㄨㄥ4 have noun, adjective, verb and/or adverb
 *   uses, but neither is a grammatical PART. The exact PART profiles are
 *   unsupported: reject both readings only for this incorrect role.
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=8701
 *
 * Do not infer that rare valid single-character proper names are invalid:
 * 葛/ㄍㄜ2 also names an ancient state and 葛/ㄍㄜ3 is a surname;
 * this review leaves both untouched.
 * https://dict.revised.moe.edu.tw/dictView.jsp?ID=3973
 */
export const MOE_EIGHTH_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("大","ㄉㄞ4"), rejectedUpos:["PROPN"] },
  { entryId: catalogEntryId("那","ㄋㄨㄛ2"), rejectedUpos:["ADV"] },
  { entryId: catalogEntryId("重","ㄔㄨㄥ2"), rejectedUpos:["PART"] },
  { entryId: catalogEntryId("重","ㄓㄨㄥ4"), rejectedUpos:["PART"] },
] as const satisfies readonly {readonly entryId:string;readonly rejectedUpos:readonly Upos[]}[];

const eighthMismatch = makeMismatchLookup(MOE_EIGHTH_ROLE_RESTRICTIONS);
export function isMoeEighthRoleMismatch(entryId:string,upos:Upos):boolean {
  return eighthMismatch(entryId,upos);
}
export function reviewedMoeEighthRoleEligible(entry:CatalogEntry,profile:RuntimeSyntaxProfile):boolean {
  if(entry.id!==profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeEighthRoleMismatch(entry.id,profile.upos);
}


/**
 * Tenth reviewed exact final-sample reading-role cases after #458:
 * - 阿/ㄚ1 is an exclamation, utterance-final particle, or name/kinship
 *   PREFIX, not a standalone personal proper name. The independent surname
 *   阿 is ㄜ1 (e.g. 阿光進). MOE Revised 阿:
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=10250
 * - 尉/ㄨㄟ4 is the rank/title and verb "comfort"; the independent surname
 *   尉 is ㄩ4 (e.g. 尉止). MOE Revised 尉:
 *   https://dict.revised.moe.edu.tw/dictView.jsp?ID=11717
 *
 * Do not forbid ㄚ1 in vocatives/prefix contexts, ㄨㄟ4 for ranks, or either
 * legitimate ㄜ1/ㄩ4 surname reading. Only reject these two exact independent
 * entryId × runtime PROPN profiles; no colloquial naturalness judgments.
 */
export const MOE_TENTH_ROLE_RESTRICTIONS = [
  { entryId: catalogEntryId("阿","ㄚ1"), rejectedUpos:["PROPN"] },
  { entryId: catalogEntryId("尉","ㄨㄟ4"), rejectedUpos:["PROPN"] },
] as const satisfies readonly {readonly entryId:string;readonly rejectedUpos:readonly Upos[]}[];

const tenthMismatch = makeMismatchLookup(MOE_TENTH_ROLE_RESTRICTIONS);
export function isMoeTenthRoleMismatch(entryId:string,upos:Upos):boolean {
  return tenthMismatch(entryId,upos);
}
export function reviewedMoeTenthRoleEligible(entry:CatalogEntry,profile:RuntimeSyntaxProfile):boolean {
  if(entry.id!==profile.entryId) {
    throw new Error("MOE role-specific reading policy must inspect actual selected catalog identity");
  }
  return !isMoeTenthRoleMismatch(entry.id,profile.upos);
}
