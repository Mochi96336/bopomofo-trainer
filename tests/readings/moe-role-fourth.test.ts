import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import {
  MOE_FOURTH_ROLE_RESTRICTIONS,
  reviewedMoeFourthRoleEligible,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeRoleFourth,FROZEN_MOE_FOURTH_BAD_SLOTS,
} from "../../scripts/compare-moe-role-fourth.js";

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

describe("fourth MOE role mismatch evidence",()=>{
  it("rejects exactly nine evidence-backed reading and UPOS combinations",()=>{
    expect(MOE_FOURTH_ROLE_RESTRICTIONS).toHaveLength(7);
    expect(MOE_FOURTH_ROLE_RESTRICTIONS.reduce((n,row)=>n+row.rejectedUpos.length,0)).toBe(9);
    for(const row of MOE_FOURTH_ROLE_RESTRICTIONS){
      const at=row.entryId.lastIndexOf(":");
      const e=entry(row.entryId.slice(5,at),row.entryId.slice(at+1));
      for(const wrong of row.rejectedUpos){
        expect(reviewedMoeFourthRoleEligible(e,profile(e,wrong))).toBe(false);
      }
    }
  });
  it("preserves attested alternate readings and rare legitimate senses",()=>{
    for(const [text,reading,upos] of [
      ["上","ㄕㄤ3","NOUN"],["上","ㄕㄤ4","ADV"],["上","ㄕㄤ4","VERB"],
      ["中","ㄓㄨㄥ4","VERB"],["中","ㄓㄨㄥ1","NOUN"],["中","ㄓㄨㄥ1","PROPN"],
      ["少","ㄕㄠ3","ADV"],["少","ㄕㄠ4","ADJ"],
      ["數","ㄕㄨ4","NUM"],["數","ㄕㄨ3","VERB"],
      ["大","ㄉㄞ4","PROPN"],["大夫","ㄉㄞ4-ㄈㄨ5","NOUN"],
      ["王","ㄨㄤ4","VERB"],["王","ㄨㄤ2","PROPN"],
      ["正","ㄓㄥ1","NOUN"],["正","ㄓㄥ4","PART"],
      ["那","ㄋㄨㄛ2","PRON"],
    ] as const) {
      const e=entry(text,reading);
      expect(reviewedMoeFourthRoleEligible(e,profile(e,upos))).toBe(true);
    }
  });
  it("fails closed on wrong selected lexical identity",()=>{
    const a=entry("上","ㄕㄤ3"),b=entry("上","ㄕㄤ4");
    expect(()=>reviewedMoeFourthRoleEligible(a,profile(b,"ADV"))).toThrow(/actual selected/);
  });
});

describe("strict fourth MOE role paired 2048-seed regression",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"不",root:"sentence.declarative",entryIds:[filler] as string[],
    }));
    const hits:Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;selectedUpos:string}>=[];
    for(const target of FROZEN_MOE_FOURTH_BAD_SLOTS){
      const s=sentences[target.seed]!;
      while(s.entryIds.length<=target.slot)s.entryIds.push(filler);
      s.entryIds[target.slot]=target.id;
      hits.push({seedIndex:target.seed,entryIndex:target.slot,selectedEntryId:target.id,selectedUpos:target.upos});
    }
    const before={
      readingEligibilityPolicy:"standard-role-third-trial",
      seedNamespace:"frozen",catalogEntryCount:900,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-fourth-trial",
      hits:[] as typeof hits,
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map(id=>id===filler?filler:substitute)})),
    };
    return {before,after};
  }
  it("changes exactly the 11 observed wrong slots and nothing else",()=>{
    const {before,after}=reports();
    const result=compareMoeRoleFourth(before,after);
    expect(result.incompatibleUsesBefore).toBe(11);
    expect(result.incompatibleUsesAfter).toBe(0);
    expect(result.changedSeeds).toHaveLength(11);
    expect(result.changedSlotCount).toBe(11);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("fails on changes in an unrelated originally legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[substitute]};
    expect(()=>compareMoeRoleFourth(before,after)).toThrow(/off-target lexical/);
  });
  it("fails on a missed bad slot",()=>{
    const {before,after}=reports();
    after.sentences[372]={...after.sentences[372]!,entryIds:[filler,filler,before.sentences[372]!.entryIds[2]!]};
    expect(()=>compareMoeRoleFourth(before,after)).toThrow(/incomplete role repair/);
  });
  it("fails if previously rejected wrong reading appears again",()=>{
    const {before,after}=reports();
    const badId=catalogEntryId("比","ㄅㄧ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[badId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[badId]};
    expect(()=>compareMoeRoleFourth(before,after)).toThrow(/old invalid reading/);
  });
});
