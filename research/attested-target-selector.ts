import type { RandomSource } from "../src/core/model.js";
import { FREQUENCY_FIRST_UTTERANCE_POLICY } from "../src/curriculum/frequency-first-utterance.js";

/**
 * TARGET-CHARACTER-ONLY verified reading. A sentence from a corpus is not
 * evidence that every other character in that sentence has a reviewed tone.
 */
export interface AttestedTarget {
  readonly id: string;
  readonly origin: {
    readonly corpus: string;
    readonly split: "train" | "dev" | "test";
    readonly sourceSentenceId: string;
    readonly sourceSentence: string;
    readonly udTokenIndex: number;
    readonly udTokenText: string;
    readonly udUpos: string;
    readonly udTransliteration: string;
    readonly sourceBlobSha: string;
    readonly sourceUrl: string;
  };
  readonly target: {
    readonly writtenWord: string;
    readonly characterOffset: number;
    readonly character: string;
    readonly goldZhuyin: string;
    readonly lexicalDictionaryUrl: string;
    readonly scope: "verified-target-character-only";
    readonly udPinyinTargetCheck: "match" | "conflict";
  };
  readonly review: {
    readonly status: "dictionary-cross-checked";
    readonly annotation: string;
    readonly sentenceFluency: "attested-corpus-not-independently-rated";
  };
}

const phonetic=/^[ㄅ-ㄩ]+[ˊˇˋ˙]?$/u;
const tone: Readonly<Record<string,string>>={
  "ˊ":"tone:2", "ˇ":"tone:3", "ˋ":"tone:4", "˙":"tone:5",
};
export function verifiedTargetTokens(goldZhuyin: string): readonly string[] {
  if (!phonetic.test(goldZhuyin)) throw new Error("invalid target-only Zhuyin: "+goldZhuyin);
  const chars=[...goldZhuyin];
  const mark=chars.at(-1)!;
  return [
    ...chars.filter(c=>/^[ㄅ-ㄩ]$/u.test(c)).map(c=>"zhuyin:"+c),
    tone[mark] ?? "tone:1",
  ];
}
export function validateAttestedTargetRows(cases: readonly AttestedTarget[]): void {
  if (cases.length < 12) throw new Error("pilot should contain at least twelve attested target contexts");
  const ids=new Set<string>();
  const readings=new Map<string,Set<string>>();
  for(const item of cases){
    if(ids.has(item.id))throw new Error("duplicate source target identity: "+item.id);
    ids.add(item.id);
    if (item.origin.corpus!=="UniversalDependencies/UD_Chinese-GSD"
      || item.origin.sourceSentenceId!==`${item.origin.split}-s${item.origin.sourceSentenceId.split("-s")[1]}`
      || !item.origin.sourceSentence.includes(item.target.writtenWord)
      || item.origin.udTokenText!==item.target.writtenWord
      || !Number.isInteger(item.origin.udTokenIndex) || item.origin.udTokenIndex<1
      || !/^[a-f0-9]{40}$/u.test(item.origin.sourceBlobSha)
      || !item.origin.sourceUrl.includes("UD_Chinese-GSD")
      || item.target.character!==[...item.target.writtenWord][item.target.characterOffset]
      || item.target.scope!=="verified-target-character-only"
      || item.review.status!=="dictionary-cross-checked"
      || item.review.sentenceFluency!=="attested-corpus-not-independently-rated"
      || !item.target.lexicalDictionaryUrl.startsWith("https://dict.")
      || !item.target.lexicalDictionaryUrl.includes(".moe.edu.tw/")) {
      throw new Error("untraceable corpus item or non-gold target: "+item.id);
    }
    verifiedTargetTokens(item.target.goldZhuyin);
    const set=readings.get(item.target.character)??new Set<string>();
    set.add(item.target.goldZhuyin);
    readings.set(item.target.character,set);
  }
  for(const char of ["好","行","種","給"])if((readings.get(char)?.size??0)<2) {
    throw new Error("no contrasting reviewed pronunciations for "+char);
  }
}

/** Use the production *error-only* policy cap, not a new G2P algorithm.
 * Equal frequency bases deliberately isolate weakness effects.
 */
export function verifiedTargetWeight(
  item: AttestedTarget,
  evidence: Readonly<Record<string,{attempts:number;errors:number}>>,
): number {
  const p=FREQUENCY_FIRST_UTTERANCE_POLICY;
  let boost=1;
  for(const token of verifiedTargetTokens(item.target.goldZhuyin)){
    const e=evidence[token];
    if(e!==undefined && e.attempts>=p.minimumBindingAttempts){
      if(e.errors<0||e.errors>e.attempts)throw new Error("invalid error aggregate");
      boost=Math.max(boost,Math.min(p.maximumExpectedTokenBoost,1+e.errors/e.attempts*p.errorBoostScale));
    }
  }
  return Math.min(boost,p.maximumCombinedLearnerBoost);
}

export function selectVerifiedTarget(
  rows: readonly AttestedTarget[],
  evidence: Readonly<Record<string,{attempts:number;errors:number}>>,
  random: RandomSource,
): AttestedTarget {
  if(rows.length===0)throw new Error("no independently reviewed targets; refuse to guess readings");
  const weights=rows.map(row=>verifiedTargetWeight(row,evidence));
  const total=weights.reduce((sum,w)=>sum+w,0);
  const threshold=random.next()*total;
  let accumulator=0;
  for(let i=0;i<rows.length;i++){
    accumulator+=weights[i]!;
    if(threshold<accumulator)return rows[i]!;
  }
  return rows[rows.length-1]!;
}
