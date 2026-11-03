import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import {
  MOE_SEVENTH_ROLE_RESTRICTIONS,
  reviewedMoeSeventhRoleEligible,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeRoleSeventh,FROZEN_MOE_SEVENTH_BAD_SLOTS,
} from "../../scripts/compare-moe-role-seventh.js";

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

describe("seventh MOE role mismatch evidence",()=>{
  it("rejects only seven reviewed 和 reading-and-UPOS combinations",()=>{
    expect(MOE_SEVENTH_ROLE_RESTRICTIONS).toHaveLength(4);
    expect(MOE_SEVENTH_ROLE_RESTRICTIONS.reduce((n,row)=>n+row.rejectedUpos.length,0)).toBe(7);
    for(const row of MOE_SEVENTH_ROLE_RESTRICTIONS){
      const at=row.entryId.lastIndexOf(":");
      const e=entry(row.entryId.slice(5,at),row.entryId.slice(at+1));
      for(const wrong of row.rejectedUpos){
        expect(reviewedMoeSeventhRoleEligible(e,profile(e,wrong))).toBe(false);
      }
    }
  });
  it("preserves attested alternate readings and rare legitimate senses",()=>{
    for(const [text,reading,upos] of [
      ["和","ㄏㄜ2","NOUN"], ["和","ㄏㄜ2","PROPN"],
      ["和","ㄏㄜ4","VERB"], ["和","ㄏㄨ2","VERB"],
      ["和","ㄏㄨㄛ4","VERB"], ["和","ㄏㄨㄛ2","VERB"],
      ["和","ㄏㄨㄛ2","NOUN"], ["和","ㄏㄜ4","ADJ"],
      ["葛","ㄍㄜ2","PROPN"], ["號","ㄏㄠ2","VERB"],
    ] as const) {
      const e=entry(text,reading);
      expect(reviewedMoeSeventhRoleEligible(e,profile(e,upos))).toBe(true);
    }
  });
  it("fails closed on wrong selected lexical identity",()=>{
    const a=entry("和","ㄏㄨ2"),b=entry("和","ㄏㄜ2");
    expect(()=>reviewedMoeSeventhRoleEligible(a,profile(b,"PROPN"))).toThrow(/actual selected/);
  });
});

describe("strict seventh MOE role paired 2048-seed regression",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"不",root:"sentence.declarative",entryIds:[filler] as string[],
    }));
    const hits:Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;selectedUpos:string}>=[];
    for(const target of FROZEN_MOE_SEVENTH_BAD_SLOTS){
      const s=sentences[target.seed]!;
      while(s.entryIds.length<=target.slot)s.entryIds.push(filler);
      s.entryIds[target.slot]=target.id;
      hits.push({seedIndex:target.seed,entryIndex:target.slot,selectedEntryId:target.id,selectedUpos:target.upos});
    }
    const before={
      readingEligibilityPolicy:"standard-role-sixth-trial",
      seedNamespace:"frozen",catalogEntryCount:900,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-seventh-trial",
      hits:[] as typeof hits,
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map(id=>id===filler?filler:substitute)})),
    };
    return {before,after};
  }
  it("changes exactly 18 wrong slots across 17 seeds including a two-slot seed and nothing else",()=>{
    const {before,after}=reports();
    const result=compareMoeRoleSeventh(before,after);
    expect(result.incompatibleUsesBefore).toBe(18);
    expect(result.incompatibleUsesAfter).toBe(0);
    expect(result.changedSeeds).toHaveLength(17);
    expect(result.changedSlotCount).toBe(18);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("fails on changes in an unrelated originally legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[substitute]};
    expect(()=>compareMoeRoleSeventh(before,after)).toThrow(/off-target lexical/);
  });
  it("fails on a missed bad slot",()=>{
    const {before,after}=reports();
    after.sentences[1643]={...after.sentences[1643]!,entryIds:after.sentences[1643]!.entryIds.map((id,i)=>i===3?before.sentences[1643]!.entryIds[3]!:id)};
    expect(()=>compareMoeRoleSeventh(before,after)).toThrow(/incomplete role repair/);
  });
  it("fails if previously rejected wrong reading appears again",()=>{
    const {before,after}=reports();
    const badId=catalogEntryId("比","ㄅㄧ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[badId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[badId]};
    expect(()=>compareMoeRoleSeventh(before,after)).toThrow(/old invalid reading/);
  });
});
