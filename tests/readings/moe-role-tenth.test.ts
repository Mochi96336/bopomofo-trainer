import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import {
  MOE_TENTH_ROLE_RESTRICTIONS,
  reviewedMoeTenthRoleEligible,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeRoleTenth,FROZEN_MOE_TENTH_BAD_SLOTS,
} from "../../scripts/compare-moe-role-tenth.js";

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

describe("tenth MOE role mismatch evidence",()=>{
  it("rejects only the two reviewed independent proper-name reading/role combinations",()=>{
    expect(MOE_TENTH_ROLE_RESTRICTIONS).toHaveLength(2);
    expect(MOE_TENTH_ROLE_RESTRICTIONS.reduce((n,row)=>n+row.rejectedUpos.length,0)).toBe(2);
    for(const row of MOE_TENTH_ROLE_RESTRICTIONS){
      const at=row.entryId.lastIndexOf(":");
      const e=entry(row.entryId.slice(5,at),row.entryId.slice(at+1));
      for(const wrong of row.rejectedUpos){
        expect(reviewedMoeTenthRoleEligible(e,profile(e,wrong))).toBe(false);
      }
    }
  });
  it("preserves dictionary-attested alternatives and does not expand role bans to other unreviewed uses",()=>{
    for(const [text,reading,upos] of [
      ["阿","ㄜ1","PROPN"], ["阿","ㄚ1","PART"],
      ["阿","ㄚ1","INTJ"], ["阿","ㄚ1","NOUN"],
      ["尉","ㄩ4","PROPN"], ["尉","ㄨㄟ4","NOUN"], ["尉","ㄨㄟ4","VERB"],
      ["葛","ㄍㄜ2","PROPN"], ["葛","ㄍㄜ3","PROPN"],
      ["朝","ㄓㄠ1","PROPN"], ["朝","ㄔㄠ2","PROPN"],
    ] as const) {
      const e=entry(text,reading);
      expect(reviewedMoeTenthRoleEligible(e,profile(e,upos))).toBe(true);
    }
  });
  it("fails closed on wrong selected lexical identity",()=>{
    const a=entry("尉","ㄨㄟ4"),b=entry("尉","ㄩ4");
    expect(()=>reviewedMoeTenthRoleEligible(a,profile(b,"PROPN"))).toThrow(/actual selected/);
  });
});

describe("strict tenth MOE role paired 2048-seed regression",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"不",root:"sentence.declarative",entryIds:[filler] as string[],
    }));
    const hits:Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;selectedUpos:string}>=[];
    for(const target of FROZEN_MOE_TENTH_BAD_SLOTS){
      const s=sentences[target.seed]!;
      while(s.entryIds.length<=target.slot)s.entryIds.push(filler);
      s.entryIds[target.slot]=target.id;
      hits.push({seedIndex:target.seed,entryIndex:target.slot,selectedEntryId:target.id,selectedUpos:target.upos});
    }
    const before={
      readingEligibilityPolicy:"standard-ordinal-room-trial",
      seedNamespace:"frozen",catalogEntryCount:900,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-tenth-trial",
      hits:[] as typeof hits,
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map(id=>id===filler?filler:substitute)})),
    };
    return {before,after};
  }
  it("changes exactly two frozen wrong lexical slots in two seeds and nothing else",()=>{
    const {before,after}=reports();
    const result=compareMoeRoleTenth(before,after);
    expect(result.incompatibleUsesBefore).toBe(2);
    expect(result.incompatibleUsesAfter).toBe(0);
    expect(result.changedSeeds).toHaveLength(2);
    expect(result.changedSlotCount).toBe(2);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("fails on changes in an unrelated originally legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[substitute]};
    expect(()=>compareMoeRoleTenth(before,after)).toThrow(/off-target lexical/);
  });
  it("fails on a missed bad slot",()=>{
    const {before,after}=reports();
    after.sentences[624]={...after.sentences[624]!,entryIds:after.sentences[624]!.entryIds.map((id,i)=>i===4?before.sentences[624]!.entryIds[4]!:id)};
    expect(()=>compareMoeRoleTenth(before,after)).toThrow(/incomplete role repair/);
  });
  it("fails if previously rejected wrong reading appears again",()=>{
    const {before,after}=reports();
    const badId=catalogEntryId("比","ㄅㄧ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[badId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[badId]};
    expect(()=>compareMoeRoleTenth(before,after)).toThrow(/old invalid reading/);
  });
});
