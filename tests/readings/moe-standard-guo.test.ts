import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import { reviewedMoeStandardGuoReadingEligible } from "../../src/readings/moe-standard-guo.js";
import { compareMoeStandardGuo } from "../../scripts/compare-moe-standard-guo.js";

function entry(text:string,reading:string):CatalogEntry {
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄍ","tone:1"]}],tags:[],provenanceIds:[]};
}
function profile(e:CatalogEntry):RuntimeSyntaxProfile {
  return {id:e.id+"/PART",entryId:e.id,upos:"PART",functions:["particle"],
    valencyFrames:["avalent"],dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},
    provenanceIds:[]};
}
const wrong=entry("過","ㄍㄨㄛ5"), guo4=entry("過","ㄍㄨㄛ4"),
  guo1=entry("過","ㄍㄨㄛ1"), good=entry("他","ㄊㄚ1");

describe("Taiwan MOE standalone 過 reading policy",()=>{
  it("rejects neutral-tone ID only, preserves MOE ㄍㄨㄛ4 and surname ㄍㄨㄛ1",()=>{
    expect(reviewedMoeStandardGuoReadingEligible(wrong,profile(wrong))).toBe(false);
    for(const legal of [guo4,guo1,good,entry("經過","ㄐㄧㄥ1-ㄍㄨㄛ4")]){
      expect(reviewedMoeStandardGuoReadingEligible(legal,profile(legal))).toBe(true);
    }
    expect(()=>reviewedMoeStandardGuoReadingEligible(wrong,profile(guo4))).toThrow(/actual selected/);
  });
});
describe("paired final 過 sample handles repeated A-not-A slots",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"他他",root:"sentence.declarative",entryIds:[good.id,good.id],
    }));
    const ids=[223,1295,1874,1959] as const;
    sentences[223]={...sentences[223]!,text:"他過",entryIds:[good.id,wrong.id]};
    sentences[1295]={...sentences[1295]!,text:"過他過",root:"sentence.a-not-a-transitive-question",
      entryIds:[wrong.id,good.id,wrong.id]};
    sentences[1874]={...sentences[1874]!,text:"過他",entryIds:[wrong.id,good.id]};
    sentences[1959]={...sentences[1959]!,text:"過他",entryIds:[wrong.id,good.id]};
    const before={
      readingEligibilityPolicy:"standard-xing-trial",seedNamespace:"frozen",
      catalogEntryCount:50,sampleCount:2048,failedSentences:0,successfulSentences:2048,
      sentences,
      hits:ids.flatMap(seedIndex=>Array.from({
        length:seedIndex===1295?2:1,
      },()=>({seedIndex,text:"過",selectedEntryId:wrong.id}))),
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-guo-trial",hits:[],
      sentences:sentences.map((sentence,i)=>({
        ...sentence,
        entryIds:ids.includes(i as typeof ids[number])
          ? sentence.entryIds.map(id=>id===wrong.id?guo4.id:id)
          : [...sentence.entryIds],
        text:ids.includes(i as typeof ids[number])
          ? sentence.text.replaceAll("過","過")
          : sentence.text,
      })),
    };
    return {before,after};
  }
  it("allows both originally invalid lexical slots in seed 1295 and no other changes",()=>{
    const {before,after}=reports();
    const result=compareMoeStandardGuo(before,after);
    expect(result.changedSeeds).toEqual([223,1295,1874,1959]);
    expect(result.changedDetails).toHaveLength(5);
    expect(result.changedDetails.filter(x=>x.seedIndex===1295).map(x=>x.slot)).toEqual([0,2]);
  });
  it("rejects unrelated legal seed changes",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[guo4.id,good.id]};
    expect(()=>compareMoeStandardGuo(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("rejects changing a legal slot inside an otherwise offending sentence",()=>{
    const {before,after}=reports();
    after.sentences[1295]={...after.sentences[1295]!,entryIds:[guo4.id,guo4.id,guo4.id]};
    expect(()=>compareMoeStandardGuo(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("rejects replacing only one of two invalid slots",()=>{
    const {before,after}=reports();
    after.sentences[1295]={...after.sentences[1295]!,entryIds:[guo4.id,good.id,wrong.id]};
    expect(()=>compareMoeStandardGuo(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("rejects any earlier known bad pronunciation in a final selected answer",()=>{
    const {before,after}=reports();
    const old=entry("得","ㄉㄜ4");
    before.sentences[70]={...before.sentences[70]!,entryIds:[old.id,good.id]};
    after.sentences[70]={...after.sentences[70]!,entryIds:[old.id,good.id]};
    expect(()=>compareMoeStandardGuo(before,after)).toThrow(/previously confirmed unsupported/);
  });
});
