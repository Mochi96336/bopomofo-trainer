import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import {
  MOE_SIXTH_ROLE_RESTRICTIONS,
  reviewedMoeSixthRoleEligible,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeRoleSixth,FROZEN_MOE_SIXTH_BAD_SLOTS,
} from "../../scripts/compare-moe-role-sixth.js";

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

describe("sixth MOE role mismatch evidence",()=>{
  it("rejects exactly five MOE-backed selected reading and UPOS combinations",()=>{
    expect(MOE_SIXTH_ROLE_RESTRICTIONS).toHaveLength(5);
    expect(MOE_SIXTH_ROLE_RESTRICTIONS.reduce((n,row)=>n+row.rejectedUpos.length,0)).toBe(5);
    for(const row of MOE_SIXTH_ROLE_RESTRICTIONS){
      const at=row.entryId.lastIndexOf(":");
      const e=entry(row.entryId.slice(5,at),row.entryId.slice(at+1));
      for(const wrong of row.rejectedUpos){
        expect(reviewedMoeSixthRoleEligible(e,profile(e,wrong))).toBe(false);
      }
    }
  });
  it("preserves attested alternate readings and rare legitimate senses",()=>{
    for(const [text,reading,upos] of [
      ["個","ㄍㄜ3","PROPN"],["個","ㄍㄜ4","NOUN"],
      ["得","ㄉㄜ5","PART"],["得","ㄉㄜ2","VERB"],["得","ㄉㄟ3","VERB"],
      ["惡","ㄜ3","NOUN"],["惡","ㄜ4","ADJ"],
      ["著","ㄓㄜ5","PART"],["著","ㄓㄠ1","VERB"],["著","ㄓㄨㄛ2","VERB"],
      ["處","ㄔㄨ3","VERB"],["處","ㄔㄨ4","NOUN"],
      ["解","ㄐㄧㄝ4","NOUN"],["解","ㄒㄧㄝ4","NOUN"],
    ] as const) {
      const e=entry(text,reading);
      expect(reviewedMoeSixthRoleEligible(e,profile(e,upos))).toBe(true);
    }
  });
  it("fails closed on wrong selected lexical identity",()=>{
    const a=entry("著","ㄓㄜ5"),b=entry("著","ㄓㄠ1");
    expect(()=>reviewedMoeSixthRoleEligible(a,profile(b,"VERB"))).toThrow(/actual selected/);
  });
});

describe("strict sixth MOE role paired 2048-seed regression",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"不",root:"sentence.declarative",entryIds:[filler] as string[],
    }));
    const hits:Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;selectedUpos:string}>=[];
    for(const target of FROZEN_MOE_SIXTH_BAD_SLOTS){
      const s=sentences[target.seed]!;
      while(s.entryIds.length<=target.slot)s.entryIds.push(filler);
      s.entryIds[target.slot]=target.id;
      hits.push({seedIndex:target.seed,entryIndex:target.slot,selectedEntryId:target.id,selectedUpos:target.upos});
    }
    const before={
      readingEligibilityPolicy:"standard-role-fifth-trial",
      seedNamespace:"frozen",catalogEntryCount:900,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-sixth-trial",
      hits:[] as typeof hits,
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map(id=>id===filler?filler:substitute)})),
    };
    return {before,after};
  }
  it("changes exactly the 9 observed wrong slots in 8 seeds and nothing else",()=>{
    const {before,after}=reports();
    const result=compareMoeRoleSixth(before,after);
    expect(result.incompatibleUsesBefore).toBe(9);
    expect(result.incompatibleUsesAfter).toBe(0);
    expect(result.changedSeeds).toHaveLength(8);
    expect(result.changedSlotCount).toBe(9);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("fails on changes in an unrelated originally legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[substitute]};
    expect(()=>compareMoeRoleSixth(before,after)).toThrow(/off-target lexical/);
  });
  it("fails on a missed bad slot",()=>{
    const {before,after}=reports();
    after.sentences[150]={...after.sentences[150]!,entryIds:after.sentences[150]!.entryIds.map((id,i)=>i===3?before.sentences[150]!.entryIds[3]!:id)};
    expect(()=>compareMoeRoleSixth(before,after)).toThrow(/incomplete role repair/);
  });
  it("fails if previously rejected wrong reading appears again",()=>{
    const {before,after}=reports();
    const badId=catalogEntryId("比","ㄅㄧ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[badId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[badId]};
    expect(()=>compareMoeRoleSixth(before,after)).toThrow(/old invalid reading/);
  });
});
