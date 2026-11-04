import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import {
  MOE_EIGHTH_ROLE_RESTRICTIONS,
  reviewedMoeEighthRoleEligible,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeRoleEighth,FROZEN_MOE_EIGHTH_BAD_SLOTS,
} from "../../scripts/compare-moe-role-eighth.js";

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

describe("eighth MOE role mismatch evidence",()=>{
  it("rejects exactly four MOE-incompatible reading and UPOS combinations",()=>{
    expect(MOE_EIGHTH_ROLE_RESTRICTIONS).toHaveLength(4);
    expect(MOE_EIGHTH_ROLE_RESTRICTIONS.reduce((n,row)=>n+row.rejectedUpos.length,0)).toBe(4);
    for(const row of MOE_EIGHTH_ROLE_RESTRICTIONS){
      const at=row.entryId.lastIndexOf(":");
      const e=entry(row.entryId.slice(5,at),row.entryId.slice(at+1));
      for(const wrong of row.rejectedUpos){
        expect(reviewedMoeEighthRoleEligible(e,profile(e,wrong))).toBe(false);
      }
    }
  });
  it("preserves attested alternate readings and rare legitimate senses",()=>{
    for(const [text,reading,upos] of [
      ["大","ㄉㄚ4","PROPN"], ["大","ㄉㄞ4","NOUN"],
      ["那","ㄋㄨㄛ2","PRON"], ["那","ㄋㄚ3","ADV"], ["那","ㄋㄚ4","ADV"],
      ["重","ㄔㄨㄥ2","ADV"], ["重","ㄓㄨㄥ4","ADV"],
      ["重","ㄔㄨㄥ2","VERB"], ["重","ㄓㄨㄥ4","NOUN"],
      ["葛","ㄍㄜ2","PROPN"], ["葛","ㄍㄜ3","PROPN"],
      ["給","ㄐㄧ3","VERB"], ["供","ㄍㄨㄥ4","VERB"],
    ] as const) {
      const e=entry(text,reading);
      expect(reviewedMoeEighthRoleEligible(e,profile(e,upos))).toBe(true);
    }
  });
  it("fails closed on wrong selected lexical identity",()=>{
    const a=entry("大","ㄉㄞ4"),b=entry("大","ㄉㄚ4");
    expect(()=>reviewedMoeEighthRoleEligible(a,profile(b,"PROPN"))).toThrow(/actual selected/);
  });
});

describe("strict eighth MOE role paired 2048-seed regression",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"不",root:"sentence.declarative",entryIds:[filler] as string[],
    }));
    const hits:Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;selectedUpos:string}>=[];
    for(const target of FROZEN_MOE_EIGHTH_BAD_SLOTS){
      const s=sentences[target.seed]!;
      while(s.entryIds.length<=target.slot)s.entryIds.push(filler);
      s.entryIds[target.slot]=target.id;
      hits.push({seedIndex:target.seed,entryIndex:target.slot,selectedEntryId:target.id,selectedUpos:target.upos});
    }
    const before={
      readingEligibilityPolicy:"standard-role-seventh-trial",
      seedNamespace:"frozen",catalogEntryCount:900,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-eighth-trial",
      hits:[] as typeof hits,
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map(id=>id===filler?filler:substitute)})),
    };
    return {before,after};
  }
  it("changes exactly seven frozen wrong lexical slots across seven seeds and nothing else",()=>{
    const {before,after}=reports();
    const result=compareMoeRoleEighth(before,after);
    expect(result.incompatibleUsesBefore).toBe(7);
    expect(result.incompatibleUsesAfter).toBe(0);
    expect(result.changedSeeds).toHaveLength(7);
    expect(result.changedSlotCount).toBe(7);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("fails on changes in an unrelated originally legal seed",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[substitute]};
    expect(()=>compareMoeRoleEighth(before,after)).toThrow(/off-target lexical/);
  });
  it("fails on a missed bad slot",()=>{
    const {before,after}=reports();
    after.sentences[1108]={...after.sentences[1108]!,entryIds:after.sentences[1108]!.entryIds.map((id,i)=>i===2?before.sentences[1108]!.entryIds[2]!:id)};
    expect(()=>compareMoeRoleEighth(before,after)).toThrow(/incomplete role repair/);
  });
  it("fails if previously rejected wrong reading appears again",()=>{
    const {before,after}=reports();
    const badId=catalogEntryId("比","ㄅㄧ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[badId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[badId]};
    expect(()=>compareMoeRoleEighth(before,after)).toThrow(/old invalid reading/);
  });
});
