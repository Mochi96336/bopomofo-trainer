import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";
import { reviewedMoeNumericFenReadingEligible } from "../../src/readings/moe-numeric-fen.js";
import { compareMoeNumericFen, FROZEN_NUMERIC_FEN_BAD_SLOTS } from "../../scripts/compare-moe-numeric-fen.js";

function entry(text:string,reading:string):CatalogEntry {
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄈ","tone:1"]}],tags:[],provenanceIds:[]};
}
function profile(e:CatalogEntry,upos:Upos):RuntimeSyntaxProfile {
  return {id:e.id+"/"+upos,entryId:e.id,upos,functions:["unspecified"],
    valencyFrames:["avalent"],dependencyEvidence:{
      dependencyRelationCounts:{},surfacePositionCounts:{}},provenanceIds:[]};
}
const good=entry("分","ㄈㄣ1"),bad=entry("分","ㄈㄣ4");
describe("adjacent numeric unit 分",()=>{
  it("constrains the independent noun only when previous lexical entry is numeric",()=>{
    for(const n of ["二十","八十七","20","三百"]) {
      const prev=entry(n,"x");
      expect(reviewedMoeNumericFenReadingEligible(good,profile(good,"NOUN"),null,prev)).toBe(true);
      expect(reviewedMoeNumericFenReadingEligible(bad,profile(bad,"NOUN"),null,prev)).toBe(false);
    }
    for(const prior of [null,entry("多","x"),entry("好幾","x"),entry("第八","x")])
      expect(reviewedMoeNumericFenReadingEligible(bad,profile(bad,"NOUN"),null,prior)).toBe(true);
    expect(reviewedMoeNumericFenReadingEligible(bad,profile(bad,"VERB"),null,entry("二十","x"))).toBe(true);
    expect(reviewedMoeNumericFenReadingEligible(entry("分量","x"),profile(entry("分量","x"),"NOUN"),null,entry("二十","x"))).toBe(true);
    expect(()=>reviewedMoeNumericFenReadingEligible(bad,profile(good,"NOUN"),null,null)).toThrow(/actual selected/);
  });
});
describe("frozen 2048-seed eleventh comparison",()=>{
  const filler=entry("非","ㄈㄟ1").id;
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"非",root:"sentence.declarative",entryIds:[filler] as string[]}));
    const hits=FROZEN_NUMERIC_FEN_BAD_SLOTS.map(target=>{
      while(sentences[target.seed]!.entryIds.length<=target.slot)
        sentences[target.seed]!.entryIds.push(filler);
      sentences[target.seed]!.entryIds[target.slot]=target.id;
      return {seedIndex:target.seed,entryIndex:target.slot,text:"分",
        selectedEntryId:target.id,selectedUpos:target.upos,
        previousEntryText:target.previousText};
    });
    const before={
      readingEligibilityPolicy:"standard-role-tenth-trial",
      seedNamespace:"pinned",catalogEntryCount:1000,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-numeric-fen-trial",
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map((id,i)=>
        FROZEN_NUMERIC_FEN_BAD_SLOTS.some(t=>s.seedIndex===t.seed&&i===t.slot)?good.id:id)})),
      hits:[] as typeof hits,
    };
    return {before,after};
  }
  it("changes exactly two slots and nothing else",()=>{
    const {before,after}=reports();
    const result=compareMoeNumericFen(before,after);
    expect(result.incompatibleUsesBefore).toBe(2);
    expect(result.incompatibleUsesAfter).toBe(0);
    expect(result.changedSeeds).toEqual([1720,1967]);
    expect(result.changedSlotCount).toBe(2);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("rejects off-target lexical changes and missed fixes",()=>{
    const {before,after}=reports();
    after.sentences[88]!.entryIds=[good.id];
    expect(()=>compareMoeNumericFen(before,after)).toThrow(/outside frozen/);
    const {before:b,after:a}=reports();
    a.sentences[1720]!.entryIds[3]=bad.id;
    expect(()=>compareMoeNumericFen(b,a)).toThrow(/outside frozen/);
  });
  it("rejects source drift, sentence-root changes and old invalid readings",()=>{
    const {before,after}=reports();
    before.hits[0]!.selectedEntryId=filler;
    expect(()=>compareMoeNumericFen(before,after)).toThrow(/frozen #459/);
    const {before:b,after:a}=reports();
    a.sentences[50]!.root="changed";
    expect(()=>compareMoeNumericFen(b,a)).toThrow(/root/);
    const {before:c,after:d}=reports();
    c.sentences[50]!.entryIds=[catalogEntryId("比","ㄅㄧ1")];
    d.sentences[50]!.entryIds=[catalogEntryId("比","ㄅㄧ1")];
    expect(()=>compareMoeNumericFen(c,d)).toThrow(/global reading restriction/);
  });
});
