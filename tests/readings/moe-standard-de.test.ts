import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import { compareMoeStandardDe } from "../../scripts/compare-moe-standard-de.js";
import { reviewedMoeStandardBiAndDeReadingEligible, reviewedMoeStandardDeReadingEligible } from "../../src/readings/moe-standard-de.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄉ","tone:4"]}],tags:[],provenanceIds:[],
  };
}
function profile(e: CatalogEntry): RuntimeSyntaxProfile {
  return {
    id:e.id+"/VERB",entryId:e.id,upos:"VERB",functions:["predicate"],
    valencyFrames:["avalent"],dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},
    provenanceIds:[],
  };
}
const deWrong=entry("得","ㄉㄜ4");
const de2=entry("得","ㄉㄜ2");
const dei3=entry("得","ㄉㄟ3");
const de5=entry("得","ㄉㄜ5");
const dai3=entry("得","ㄉㄞ3");
const other=entry("也","ㄧㄝ3");
const biWrong=entry("比","ㄅㄧ1");
const biGood=entry("比","ㄅㄧ3");

describe("narrow standalone 得 identity exclusion",()=>{
  it("rejects only exact unlicensed 得/ㄉㄜ4 and preserves recognized variants",()=>{
    expect(reviewedMoeStandardDeReadingEligible(deWrong,profile(deWrong))).toBe(false);
    for (const legal of [de2,dei3,de5,dai3,other,entry("得到","ㄉㄜ2-ㄉㄠ4")]) {
      expect(reviewedMoeStandardDeReadingEligible(legal,profile(legal))).toBe(true);
    }
    expect(()=>reviewedMoeStandardDeReadingEligible(deWrong,profile(de2)))
      .toThrow(/identity and profile mismatch/);
  });
  it("retains the already-shipped 比 gate",()=>{
    expect(reviewedMoeStandardBiAndDeReadingEligible(biWrong,profile(biWrong))).toBe(false);
    expect(reviewedMoeStandardBiAndDeReadingEligible(biGood,profile(biGood))).toBe(true);
    expect(reviewedMoeStandardBiAndDeReadingEligible(deWrong,profile(deWrong))).toBe(false);
  });
});

describe("paired 2048-seed 得 audit rejects non-target changes",()=>{
  function fixture(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"也也",root:"sentence.declarative",entryIds:[other.id,other.id],
    }));
    sentences[967]={...sentences[967]!,text:"得也",entryIds:[deWrong.id,other.id]};
    sentences[1013]={...sentences[1013]!,text:"也得",entryIds:[other.id,deWrong.id]};
    const before={
      readingEligibilityPolicy:"standard-bi-trial",seedNamespace:"fixed",
      catalogEntryCount:10,sampleCount:2048,failedSentences:0,successfulSentences:2048,
      sentences,hits:[967,1013].map(seedIndex=>({seedIndex,text:"得",selectedEntryId:deWrong.id})),
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-de-trial",
      hits:[],
      sentences:sentences.map((sentence,index)=>index===967
        ? {...sentence,text:"也也",entryIds:[dei3.id,other.id]}
        : index===1013
        ? {...sentence,text:"也也",entryIds:[other.id,de2.id]}
        : {...sentence}),
    };
    return {before,after};
  }
  it("permits only the original two incorrect reading slots",()=>{
    const {before,after}=fixture();
    expect(compareMoeStandardDe(before,after).changedSeeds).toEqual([967,1013]);
  });
  it("fails when a previously legal seed is changed",()=>{
    const {before,after}=fixture();
    after.sentences[60]={...after.sentences[60]!,entryIds:[de2.id,other.id]};
    expect(()=>compareMoeStandardDe(before,after)).toThrow(/unrelated or wrong-slot/);
  });
  it("fails when two slots change in one sentence",()=>{
    const {before,after}=fixture();
    after.sentences[967]={...after.sentences[967]!,entryIds:[dei3.id,de2.id]};
    expect(()=>compareMoeStandardDe(before,after)).toThrow(/multi-slot/);
  });
  it("fails when the invalid 得 survives in the output",()=>{
    const {before,after}=fixture();
    after.sentences[1013]={...before.sentences[1013]!};
    expect(()=>compareMoeStandardDe(before,after)).toThrow(/unrepaired or newly introduced/);
  });
});
