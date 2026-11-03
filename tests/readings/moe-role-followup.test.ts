import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import {
  MOE_FOLLOWUP_ROLE_RESTRICTIONS,
  reviewedMoeFollowupRoleEligible,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeRoleFollowup,FROZEN_MOE_FOLLOWUP_BAD_SLOTS,
} from "../../scripts/compare-moe-role-followup.js";

function entry(text:string,reading:string):CatalogEntry {
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄇ","tone:1"]}],tags:[],provenanceIds:[]};
}
function profile(e:CatalogEntry,upos:Upos):RuntimeSyntaxProfile{
  return {id:e.id+"/"+upos,entryId:e.id,upos,
    functions:["unspecified"],valencyFrames:["avalent"],
    dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},provenanceIds:[]};
}
const filler=entry("不","ㄅㄨ4").id;
const substitute=entry("不是","ㄅㄨ2-ㄕ4").id;

describe("MOE follow-up role compatibility preserves rare dictionary readings",()=>{
  it("rejects four exact role mismatches, but not the sounds in another legal role",()=>{
    expect(MOE_FOLLOWUP_ROLE_RESTRICTIONS).toHaveLength(4);
    for(const r of MOE_FOLLOWUP_ROLE_RESTRICTIONS){
      const at=r.entryId.lastIndexOf(":");
      const e=entry(r.entryId.slice(5,at),r.entryId.slice(at+1));
      for(const upos of r.rejectedUpos){
        expect(reviewedMoeFollowupRoleEligible(e,profile(e,upos))).toBe(false);
      }
      for(const upos of ["PROPN","NOUN","VERB"] as const){
        expect(reviewedMoeFollowupRoleEligible(e,profile(e,upos))).toBe(true);
      }
    }
  });
  it("preserves ordinary numeral/adjective readings and full-compound pronunciations",()=>{
    for(const [text,reading,upos] of [
      ["任","ㄖㄣ4","DET"],["任","ㄖㄣ2","PROPN"],
      ["少","ㄕㄠ3","NUM"],["少","ㄕㄠ4","ADJ"],
      ["幾","ㄐㄧ3","NUM"],["幾","ㄐㄧ1","ADV"],
      ["大","ㄉㄚ4","ADJ"],["大夫","ㄉㄞ4-ㄈㄨ5","NOUN"],
    ] as const){
      const e=entry(text,reading);
      expect(reviewedMoeFollowupRoleEligible(e,profile(e,upos))).toBe(true);
    }
  });
  it("fails closed if the selected profile belongs to a different identity",()=>{
    const wrong=entry("少","ㄕㄠ4"),legal=entry("少","ㄕㄠ3");
    expect(()=>reviewedMoeFollowupRoleEligible(wrong,profile(legal,"NUM"))).toThrow(/actual selected/);
  });
});
describe("paired 27 slots across 26 exact seed samples",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"不",root:"sentence.declarative",
      entryIds:[filler] as string[],
    }));
    const hits:Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;selectedUpos:string}>=[];
    for(const target of FROZEN_MOE_FOLLOWUP_BAD_SLOTS){
      const s=sentences[target.seed]!;
      while(s.entryIds.length<=target.slot)s.entryIds.push(filler);
      s.entryIds[target.slot]=target.id;
      hits.push({
        seedIndex:target.seed,entryIndex:target.slot,selectedEntryId:target.id,selectedUpos:target.upos,
      });
    }
    const before={
      readingEligibilityPolicy:"standard-role-evidence-trial",
      seedNamespace:"frozen",catalogEntryCount:900,sampleCount:2048,
      successfulSentences:2048,failedSentences:0,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-followup-trial",
      hits:[] as typeof hits,
      sentences:sentences.map(s=>({...s,entryIds:s.entryIds.map(id=>id===filler?filler:substitute)})),
    };
    return {before,after};
  }
  it("allows two different bad lexical slots in seed 1024, and no other changed slot",()=>{
    const {before,after}=reports();
    const summary=compareMoeRoleFollowup(before,after);
    expect(summary.incompatibleUsesBefore).toBe(27);
    expect(summary.incompatibleUsesAfter).toBe(0);
    expect(summary.changedSeeds).toHaveLength(26);
    expect(summary.changedDetails.filter(x=>x.seedIndex===1024).map(x=>x.slot)).toEqual([0,2]);
    expect(summary.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("fails on any unrelated legal seed change",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[substitute]};
    expect(()=>compareMoeRoleFollowup(before,after)).toThrow(/off-target lexical/);
  });
  it("fails when seed 1024 fixes only one of the two original wrong slots",()=>{
    const {before,after}=reports();
    const s=after.sentences[1024]!;
    after.sentences[1024]={...s,entryIds:s.entryIds.map((id,slot)=>
      slot===2?before.sentences[1024]!.entryIds[2]!:id)};
    expect(()=>compareMoeRoleFollowup(before,after)).toThrow(/incomplete role repair/);
  });
  it("fails if a formerly forbidden pronunciation returns in a legal seed",()=>{
    const {before,after}=reports();
    const badId=catalogEntryId("比","ㄅㄧ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[badId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[badId]};
    expect(()=>compareMoeRoleFollowup(before,after)).toThrow(/old invalid reading/);
  });
});
