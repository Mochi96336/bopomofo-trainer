import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";
import { reviewedMoeOrdinalRoomReadingEligible } from "../../src/readings/moe-ordinal-room.js";
import { compareMoeOrdinalRoom, FROZEN_ORDINAL_ROOM_BAD_SLOTS } from "../../scripts/compare-moe-ordinal-room.js";

function entry(text:string,reading:string):CatalogEntry {
  return {
    id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄇ","tone:1"]}],tags:[],provenanceIds:[],
  };
}
function profile(e:CatalogEntry,upos:Upos):RuntimeSyntaxProfile {
  return {
    id:e.id+"/"+upos,entryId:e.id,upos,functions:["unspecified"],
    valencyFrames:["avalent"],
    dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},
    provenanceIds:[],
  };
}
const good=entry("間","ㄐㄧㄢ1"),wrong=entry("間","ㄐㄧㄢ4");
const ordinal=entry("第八","ㄉㄧ4-ㄅㄚ1");
const nonOrdinal=entry("三","ㄙㄢ1");
describe("specific numbered-room lexical reading",()=>{
  it("requires ㄐㄧㄢ1 only after an adjacent ordinal when selected role is NOUN",()=>{
    for(const prior of [ordinal,entry("第四","x"),entry("第20","x")]){
      expect(reviewedMoeOrdinalRoomReadingEligible(good,profile(good,"NOUN"),null,prior)).toBe(true);
      expect(reviewedMoeOrdinalRoomReadingEligible(wrong,profile(wrong,"NOUN"),null,prior)).toBe(false);
    }
    for(const prior of [null,nonOrdinal,entry("房間","x")]){
      expect(reviewedMoeOrdinalRoomReadingEligible(wrong,profile(wrong,"NOUN"),null,prior)).toBe(true);
    }
    expect(reviewedMoeOrdinalRoomReadingEligible(wrong,profile(wrong,"VERB"),null,ordinal)).toBe(true);
    expect(reviewedMoeOrdinalRoomReadingEligible(wrong,profile(wrong,"ADP"),null,ordinal)).toBe(true);
    const compound=entry("房間","ㄈㄤ2-ㄐㄧㄢ1");
    expect(reviewedMoeOrdinalRoomReadingEligible(compound,profile(compound,"NOUN"),null,ordinal)).toBe(true);
    expect(()=>reviewedMoeOrdinalRoomReadingEligible(wrong,profile(good,"NOUN"),null,ordinal))
      .toThrow(/actual selected/);
  });
  it("does not constrain ambiguous non-ordinal three rows or numbered handles",()=>{
    const x=entry("行","ㄒㄧㄥ2"),y=entry("把","ㄅㄚ4");
    expect(reviewedMoeOrdinalRoomReadingEligible(x,profile(x,"NOUN"),null,nonOrdinal)).toBe(true);
    expect(reviewedMoeOrdinalRoomReadingEligible(y,profile(y,"NOUN"),null,nonOrdinal)).toBe(true);
  });
});

describe("strict final ordinal-room 2048-seed paired comparison",()=>{
  const filler=entry("非","ㄈㄟ1").id;
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"非",root:"sentence.declarative",entryIds:[filler] as string[],
    }));
    const target=FROZEN_ORDINAL_ROOM_BAD_SLOTS[0];
    const sentence=sentences[target.seed]!;
    while(sentence.entryIds.length<=target.slot) sentence.entryIds.push(filler);
    sentence.entryIds[target.slot]=target.id;
    const hits=[{
      seedIndex:target.seed,entryIndex:target.slot,text:"間",
      selectedEntryId:target.id,selectedUpos:target.upos,
      previousEntryText:target.previousText,
    }];
    const before={
      readingEligibilityPolicy:"standard-role-eighth-trial",
      seedNamespace:"pinned",catalogEntryCount:1000,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-ordinal-room-trial",
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map((id,i)=>
        s.seedIndex===target.seed&&i===target.slot?good.id:id)})),
      hits:[] as typeof hits,
    };
    return {before,after};
  }
  it("removes exactly the one verified bad pronunciation, without any other change",()=>{
    const {before,after}=reports();
    const r=compareMoeOrdinalRoom(before,after);
    expect(r.incompatibleUsesBefore).toBe(1);
    expect(r.incompatibleUsesAfter).toBe(0);
    expect(r.changedSeeds).toEqual([832]);
    expect(r.changedSlotCount).toBe(1);
    expect(r.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("rejects an off-target change and a missed correction",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[good.id]};
    expect(()=>compareMoeOrdinalRoom(before,after)).toThrow(/outside frozen/);
    const {before:b,after:a}=reports();
    a.sentences[832]={...a.sentences[832]!,entryIds:b.sentences[832]!.entryIds};
    expect(()=>compareMoeOrdinalRoom(b,a)).toThrow(/outside frozen/);
  });
  it("rejects sample drift and a reintroduced prior wrong reading",()=>{
    const {before,after}=reports();
    before.hits[0]!.selectedEntryId=filler;
    expect(()=>compareMoeOrdinalRoom(before,after)).toThrow(/frozen #457/);
    const {before:b,after:a}=reports();
    b.sentences[60]={...b.sentences[60]!,entryIds:[catalogEntryId("比","ㄅㄧ1")]};
    a.sentences[60]={...a.sentences[60]!,entryIds:[catalogEntryId("比","ㄅㄧ1")]};
    expect(()=>compareMoeOrdinalRoom(b,a)).toThrow(/previously fixed unsupported/);
  });
});
