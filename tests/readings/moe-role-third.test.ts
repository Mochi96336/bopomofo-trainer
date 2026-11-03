import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import {
  MOE_THIRD_ROLE_RESTRICTIONS,
  reviewedMoeThirdRoleEligible,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeRoleThird,FROZEN_MOE_THIRD_BAD_SLOTS,
} from "../../scripts/compare-moe-role-third.js";

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

describe("third MOE role mismatch evidence",()=>{
  it("rejects only the three attested reading and UPOS combinations",()=>{
    expect(MOE_THIRD_ROLE_RESTRICTIONS).toHaveLength(3);
    for(const row of MOE_THIRD_ROLE_RESTRICTIONS){
      const at=row.entryId.lastIndexOf(":");
      const e=entry(row.entryId.slice(5,at),row.entryId.slice(at+1));
      for(const wrong of row.rejectedUpos){
        expect(reviewedMoeThirdRoleEligible(e,profile(e,wrong))).toBe(false);
      }
    }
  });
  it("preserves attested alternate readings and rare legitimate senses",()=>{
    for(const [text,reading,upos] of [
      ["為","ㄨㄟ2","AUX"],["為","ㄨㄟ4","ADP"],
      ["種","ㄓㄨㄥ3","NOUN"],["種","ㄓㄨㄥ4","VERB"],
      ["上","ㄕㄤ4","DET"],["上","ㄕㄤ3","NOUN"],
      ["上聲","ㄕㄤ3-ㄕㄥ1","NOUN"],
      ["那","ㄋㄨㄛ2","PRON"],
    ] as const) {
      const e=entry(text,reading);
      expect(reviewedMoeThirdRoleEligible(e,profile(e,upos))).toBe(true);
    }
  });
  it("fails closed on wrong selected lexical identity",()=>{
    const a=entry("種","ㄓㄨㄥ4"),b=entry("種","ㄓㄨㄥ3");
    expect(()=>reviewedMoeThirdRoleEligible(a,profile(b,"NOUN"))).toThrow(/actual selected/);
  });
});

describe("strict third MOE role paired 2048-seed regression",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"不",root:"sentence.declarative",entryIds:[filler] as string[],
    }));
    const hits:Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;selectedUpos:string}>=[];
    for(const target of FROZEN_MOE_THIRD_BAD_SLOTS){
      const s=sentences[target.seed]!;
      while(s.entryIds.length<=target.slot)s.entryIds.push(filler);
      s.entryIds[target.slot]=target.id;
      hits.push({seedIndex:target.seed,entryIndex:target.slot,selectedEntryId:target.id,selectedUpos:target.upos});
    }
    const before={
      readingEligibilityPolicy:"standard-role-followup-trial",
      seedNamespace:"frozen",catalogEntryCount:900,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-third-trial",
      hits:[] as typeof hits,
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map(id=>id===filler?filler:substitute)})),
    };
    return {before,after};
  }
  it("changes exactly the 24 observed wrong slots and nothing else",()=>{
    const {before,after}=reports();
    const result=compareMoeRoleThird(before,after);
    expect(result.incompatibleUsesBefore).toBe(24);
    expect(result.incompatibleUsesAfter).toBe(0);
    expect(result.changedSeeds).toHaveLength(24);
    expect(result.changedSlotCount).toBe(24);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("fails on changes in an unrelated originally legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[substitute]};
    expect(()=>compareMoeRoleThird(before,after)).toThrow(/off-target lexical/);
  });
  it("fails on a missed bad slot",()=>{
    const {before,after}=reports();
    after.sentences[85]={...after.sentences[85]!,entryIds:[filler,before.sentences[85]!.entryIds[1]!]};
    expect(()=>compareMoeRoleThird(before,after)).toThrow(/incomplete role repair/);
  });
  it("fails if previously rejected wrong reading appears again",()=>{
    const {before,after}=reports();
    const badId=catalogEntryId("比","ㄅㄧ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[badId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[badId]};
    expect(()=>compareMoeRoleThird(before,after)).toThrow(/old invalid reading/);
  });
});
