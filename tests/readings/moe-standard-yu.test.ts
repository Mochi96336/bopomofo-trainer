import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import { reviewedMoeStandardYuReadingEligible } from "../../src/readings/moe-standard-yu.js";
import { compareMoeStandardYu } from "../../scripts/compare-moe-standard-yu.js";

function entry(text: string, reading: string): CatalogEntry {
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄩ","tone:1"]}],tags:[],provenanceIds:[]};
}
function profile(e: CatalogEntry): RuntimeSyntaxProfile {
  return {id:e.id+"/VERB",entryId:e.id,upos:"VERB",functions:["predicate"],
    valencyFrames:["avalent"],dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},
    provenanceIds:[]};
}
const wrong=entry("於","ㄩ1");
const yu2=entry("於","ㄩ2");
const wu1=entry("於","ㄨ1");
const other=entry("好","ㄏㄠ3");

describe("MOE scoped 於 identity review",()=>{
  it("rejects unsupported standalone ㄩ1, preserves both legal sounds and whole words",()=>{
    expect(reviewedMoeStandardYuReadingEligible(wrong,profile(wrong))).toBe(false);
    for (const legal of [yu2,wu1,other,entry("於是","ㄩ2-ㄕ4"),entry("于","ㄩ2")]) {
      expect(reviewedMoeStandardYuReadingEligible(legal,profile(legal))).toBe(true);
    }
    expect(()=>reviewedMoeStandardYuReadingEligible(wrong,profile(yu2)))
      .toThrow(/selected catalog identity/);
  });
});

describe("於 paired audit is a hard guard against unrelated drift",()=>{
  function fixture() {
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"好好",root:"sentence.declarative",entryIds:[other.id,other.id],
    }));
    sentences[17]={...sentences[17]!,text:"好於",entryIds:[other.id,wrong.id]};
    const before={
      readingEligibilityPolicy:"standard-de-trial",seedNamespace:"fixed",
      catalogEntryCount:4,sampleCount:2048,failedSentences:0,successfulSentences:2048,
      sentences,hits:[{seedIndex:17,text:"於",selectedEntryId:wrong.id}],
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-yu-trial",hits:[],
      sentences:sentences.map((sentence,i)=>i===17
        ? {...sentence,text:"好好",entryIds:[other.id,yu2.id]} : {...sentence}),
    };
    return {before,after};
  }
  it("accepts a correction limited to the originally invalid slot",()=>{
    const {before,after}=fixture();
    expect(compareMoeStandardYu(before,after).changedSeeds).toEqual([17]);
  });
  it("rejects unrelated previously legal seed changes",()=>{
    const {before,after}=fixture();
    after.sentences[60]={...after.sentences[60]!,entryIds:[yu2.id,other.id]};
    expect(()=>compareMoeStandardYu(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("rejects two-slot drift",()=>{
    const {before,after}=fixture();
    after.sentences[17]={...after.sentences[17]!,entryIds:[yu2.id,wu1.id]};
    expect(()=>compareMoeStandardYu(before,after)).toThrow(/multi-slot/);
  });
  it("rejects an unchanged invalid identity",()=>{
    const {before,after}=fixture();
    after.sentences[17]={...before.sentences[17]!};
    expect(()=>compareMoeStandardYu(before,after)).toThrow(/unrepaired or newly introduced/);
  });
});
