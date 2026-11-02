import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import { reviewedMoeStandardNanReadingEligible } from "../../src/readings/moe-standard-nan.js";
import { compareMoeStandardNan } from "../../scripts/compare-moe-standard-nan.js";

function entry(text:string,reading:string):CatalogEntry {
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄋ","tone:1"]}],tags:[],provenanceIds:[]};
}
function profile(e:CatalogEntry):RuntimeSyntaxProfile {
  return {id:e.id+"/NOUN",entryId:e.id,upos:"NOUN",functions:["subject"],
    valencyFrames:["avalent"],dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},
    provenanceIds:[]};
}
const wrong=entry("南","ㄋㄚ1");
const nan2=entry("南","ㄋㄢ2");
const na2=entry("南","ㄋㄚ2");
const other=entry("國","ㄍㄨㄛ2");

describe("MOE standard exact 南 reading identity",()=>{
  it("rejects ㄋㄚ1 but preserves ㄋㄢ2, rare ㄋㄚ2 and whole compounds",()=>{
    expect(reviewedMoeStandardNanReadingEligible(wrong,profile(wrong))).toBe(false);
    for (const legal of [nan2,na2,other,entry("南無","ㄋㄚ2-ㄇㄛ2"),entry("南海","ㄋㄢ2-ㄏㄞ3")]) {
      expect(reviewedMoeStandardNanReadingEligible(legal,profile(legal))).toBe(true);
    }
    expect(()=>reviewedMoeStandardNanReadingEligible(wrong,profile(nan2))).toThrow(/actual selected/);
  });
});

describe("南 2048-seed regression comparison fails closed",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"國國",root:"sentence.declarative",entryIds:[other.id,other.id],
    }));
    sentences[248]={...sentences[248]!,text:"國南",entryIds:[other.id,wrong.id]};
    sentences[1014]={...sentences[1014]!,text:"南國",entryIds:[wrong.id,other.id]};
    const before={
      readingEligibilityPolicy:"standard-yu-trial",seedNamespace:"fixed",catalogEntryCount:5,
      sampleCount:2048,failedSentences:0,successfulSentences:2048,
      sentences,hits:[248,1014].map(seedIndex=>({seedIndex,text:"南",selectedEntryId:wrong.id})),
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-nan-trial",hits:[],
      sentences:sentences.map((sentence,index)=>index===248
        ? {...sentence,entryIds:[other.id,na2.id]}
        : index===1014
        ? {...sentence,entryIds:[nan2.id,other.id]}
        : {...sentence}),
    };
    return {before,after};
  }
  it("accepts precisely two invalid-slot replacements",()=>{
    const {before,after}=reports();
    expect(compareMoeStandardNan(before,after).changedSeeds).toEqual([248,1014]);
  });
  it("rejects a changed legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[nan2.id,other.id]};
    expect(()=>compareMoeStandardNan(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("rejects a change to a different slot in a formerly invalid sentence",()=>{
    const {before,after}=reports();
    after.sentences[248]={...after.sentences[248]!,entryIds:[nan2.id,wrong.id]};
    expect(()=>compareMoeStandardNan(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("rejects multiple-slot drift",()=>{
    const {before,after}=reports();
    after.sentences[248]={...after.sentences[248]!,entryIds:[nan2.id,na2.id]};
    expect(()=>compareMoeStandardNan(before,after)).toThrow(/multi-slot/);
  });
  it("rejects leaving disallowed 南 identity in place",()=>{
    const {before,after}=reports();
    after.sentences[1014]={...before.sentences[1014]!};
    expect(()=>compareMoeStandardNan(before,after)).toThrow(/unrepaired or newly introduced/);
  });
});
