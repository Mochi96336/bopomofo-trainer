import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import {
  MOE_FIFTH_ROLE_RESTRICTIONS,
  reviewedMoeFifthRoleEligible,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeRoleFifth,FROZEN_MOE_FIFTH_BAD_SLOTS,
} from "../../scripts/compare-moe-role-fifth.js";

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
const filler=entry("不","ㄅㄨ4").id;
const substitute=entry("不是","ㄅㄨ2-ㄕ4").id;

describe("fifth MOE role mismatch evidence",()=>{
  it("rejects exactly seven MOE-backed selected reading and UPOS combinations",()=>{
    expect(MOE_FIFTH_ROLE_RESTRICTIONS).toHaveLength(7);
    expect(MOE_FIFTH_ROLE_RESTRICTIONS.reduce((n,row)=>n+row.rejectedUpos.length,0)).toBe(7);
    for(const row of MOE_FIFTH_ROLE_RESTRICTIONS){
      const at=row.entryId.lastIndexOf(":");
      const e=entry(row.entryId.slice(5,at),row.entryId.slice(at+1));
      for(const wrong of row.rejectedUpos){
        expect(reviewedMoeFifthRoleEligible(e,profile(e,wrong))).toBe(false);
      }
    }
  });
  it("preserves attested alternate readings and rare legitimate senses",()=>{
    for(const [text,reading,upos] of [
      ["與","ㄩ2","PART"],["與","ㄩ3","ADP"],
      ["藏","ㄗㄤ4","NOUN"],["藏","ㄘㄤ2","VERB"],
      ["任","ㄖㄣ2","PROPN"],["任","ㄖㄣ4","NOUN"],
      ["佛","ㄈㄨ2","PART"],["佛","ㄈㄛ2","NOUN"],
      ["陸","ㄌㄧㄡ4","NUM"],["陸","ㄌㄨ4","PROPN"],
      ["番","ㄆㄢ1","PROPN"],["番","ㄈㄢ1","NOUN"],
      ["把","ㄅㄚ4","NOUN"],["把","ㄅㄚ3","VERB"],
      ["作","ㄗㄨㄛ1","VERB"],["著","ㄓㄠ1","VERB"],
      ["朝","ㄓㄠ1","PROPN"],["號","ㄏㄠ4","VERB"],
    ] as const) {
      const e=entry(text,reading);
      expect(reviewedMoeFifthRoleEligible(e,profile(e,upos))).toBe(true);
    }
  });
  it("fails closed on wrong selected lexical identity",()=>{
    const a=entry("藏","ㄗㄤ4"),b=entry("藏","ㄘㄤ2");
    expect(()=>reviewedMoeFifthRoleEligible(a,profile(b,"VERB"))).toThrow(/actual selected/);
  });
});

describe("strict fifth MOE role paired 2048-seed regression",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"不",root:"sentence.declarative",entryIds:[filler] as string[],
    }));
    const hits:Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;selectedUpos:string}>=[];
    for(const target of FROZEN_MOE_FIFTH_BAD_SLOTS){
      const s=sentences[target.seed]!;
      while(s.entryIds.length<=target.slot)s.entryIds.push(filler);
      s.entryIds[target.slot]=target.id;
      hits.push({seedIndex:target.seed,entryIndex:target.slot,selectedEntryId:target.id,selectedUpos:target.upos});
    }
    const before={
      readingEligibilityPolicy:"standard-role-fourth-trial",
      seedNamespace:"frozen",catalogEntryCount:900,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-fifth-trial",
      hits:[] as typeof hits,
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map(id=>id===filler?filler:substitute)})),
    };
    return {before,after};
  }
  it("changes exactly the 7 observed wrong slots and nothing else",()=>{
    const {before,after}=reports();
    const result=compareMoeRoleFifth(before,after);
    expect(result.incompatibleUsesBefore).toBe(7);
    expect(result.incompatibleUsesAfter).toBe(0);
    expect(result.changedSeeds).toHaveLength(7);
    expect(result.changedSlotCount).toBe(7);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("fails on changes in an unrelated originally legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[substitute]};
    expect(()=>compareMoeRoleFifth(before,after)).toThrow(/off-target lexical/);
  });
  it("fails on a missed bad slot",()=>{
    const {before,after}=reports();
    after.sentences[498]={...after.sentences[498]!,entryIds:[before.sentences[498]!.entryIds[0]!]};
    expect(()=>compareMoeRoleFifth(before,after)).toThrow(/incomplete role repair/);
  });
  it("fails if previously rejected wrong reading appears again",()=>{
    const {before,after}=reports();
    const badId=catalogEntryId("比","ㄅㄧ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[badId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[badId]};
    expect(()=>compareMoeRoleFifth(before,after)).toThrow(/old invalid reading/);
  });
});
