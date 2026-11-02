import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import { reviewedMoeStandardXingReadingEligible } from "../../src/readings/moe-standard-xing.js";
import { compareMoeStandardXing } from "../../scripts/compare-moe-standard-xing.js";

function entry(text:string,reading:string): CatalogEntry {
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄏ","tone:2"]}],tags:[],provenanceIds:[]};
}
function profile(e:CatalogEntry): RuntimeSyntaxProfile {
  return {id:e.id+"/VERB",entryId:e.id,upos:"VERB",functions:["predicate"],
    valencyFrames:["avalent"],dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},
    provenanceIds:[]};
}
const wrong=entry("行","ㄏㄥ2");
const xing2=entry("行","ㄒㄧㄥ2");
const xing4=entry("行","ㄒㄧㄥ4");
const hang2=entry("行","ㄏㄤ2");
const hang4=entry("行","ㄏㄤ4");
const other=entry("此","ㄘ3");

describe("MOE exact standalone 行 identity",()=>{
  it("rejects only ㄏㄥ2 and preserves all four dictionary-supported sounds and compounds",()=>{
    expect(reviewedMoeStandardXingReadingEligible(wrong,profile(wrong))).toBe(false);
    for(const e of [xing2,xing4,hang2,hang4,other,entry("銀行","ㄧㄣ2-ㄏㄤ2")]) {
      expect(reviewedMoeStandardXingReadingEligible(e,profile(e))).toBe(true);
    }
    expect(()=>reviewedMoeStandardXingReadingEligible(wrong,profile(xing2))).toThrow(/actual selected/);
  });
});

describe("行 paired comparison checks target and the entire delivered output",()=>{
  function reports() {
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"此此",root:"sentence.declarative",entryIds:[other.id,other.id],
    }));
    sentences[967]={...sentences[967]!,text:"此行",entryIds:[other.id,wrong.id]};
    sentences[1665]={...sentences[1665]!,text:"行此",entryIds:[wrong.id,other.id]};
    const before={
      readingEligibilityPolicy:"standard-nan-trial",seedNamespace:"fixed",catalogEntryCount:6,
      sampleCount:2048,failedSentences:0,successfulSentences:2048,
      sentences,hits:[967,1665].map(seedIndex=>({seedIndex,text:"行",selectedEntryId:wrong.id})),
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-xing-trial",hits:[],
      sentences:sentences.map((sentence,i)=>i===967
        ? {...sentence,entryIds:[other.id,xing2.id]}
        : i===1665
        ? {...sentence,entryIds:[hang2.id,other.id]}
        : {...sentence}),
    };
    return {before,after};
  }
  it("requires exactly seed 967 and 1665 bad-slot repairs",()=>{
    const {before,after}=reports();
    expect(compareMoeStandardXing(before,after).changedSeeds).toEqual([967,1665]);
  });
  it("rejects changing an unrelated legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[other.id,xing2.id]};
    expect(()=>compareMoeStandardXing(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("rejects wrong-slot changes",()=>{
    const {before,after}=reports();
    after.sentences[967]={...after.sentences[967]!,entryIds:[xing2.id,wrong.id]};
    expect(()=>compareMoeStandardXing(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("rejects two changed lexical slots",()=>{
    const {before,after}=reports();
    after.sentences[967]={...after.sentences[967]!,entryIds:[xing2.id,hang2.id]};
    expect(()=>compareMoeStandardXing(before,after)).toThrow(/multi-slot/);
  });
  it("rejects unrepaired 行/ㄏㄥ2",()=>{
    const {before,after}=reports();
    after.sentences[1665]={...before.sentences[1665]!};
    expect(()=>compareMoeStandardXing(before,after)).toThrow(/unrepaired or newly introduced/);
  });
  it("rejects an earlier confirmed invalid pronunciation even in an untouched final seed",()=>{
    const {before,after}=reports();
    const badPreviously=entry("得","ㄉㄜ4");
    before.sentences[60]={...before.sentences[60]!,entryIds:[other.id,badPreviously.id]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[other.id,badPreviously.id]};
    expect(()=>compareMoeStandardXing(before,after)).toThrow(/previously confirmed unsupported/);
  });
});
