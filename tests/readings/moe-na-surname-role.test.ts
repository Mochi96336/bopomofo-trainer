import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import { reviewedMoeNaSurnameRoleEligible } from "../../src/readings/moe-na-surname-role.js";
import {
  compareMoeNaSurname,FROZEN_BAD_NA_SURNAME_SEEDS,
} from "../../scripts/compare-moe-na-surname.js";

function entry(text:string,reading:string):CatalogEntry{
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄋ","tone:1"]}],tags:[],provenanceIds:[]};
}
function profile(e:CatalogEntry,upos:RuntimeSyntaxProfile["upos"]):RuntimeSyntaxProfile{
  return {id:e.id+"/"+upos,entryId:e.id,upos,
    functions:upos==="PRON"?["determiner","subject"]:upos==="ADV"?["adverbial"]:["modifier"],
    valencyFrames:["avalent"],
    dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},provenanceIds:[]};
}
const surname=entry("那","ㄋㄚ1"),na4=entry("那","ㄋㄚ4"),na3=entry("那","ㄋㄚ3"),nuo2=entry("那","ㄋㄨㄛ2"),good=entry("此","ㄘ3");

describe("MOE surname-only Na is not a general pronoun pronunciation",()=>{
  it("rejects ㄋㄚ1 in PRON and ADV while preserving the actual surname and unrelated legal readings",()=>{
    expect(reviewedMoeNaSurnameRoleEligible(surname,profile(surname,"PRON"))).toBe(false);
    expect(reviewedMoeNaSurnameRoleEligible(surname,profile(surname,"ADV"))).toBe(false);
    for(const p of ["PROPN","NOUN"] as const){
      expect(reviewedMoeNaSurnameRoleEligible(surname,profile(surname,p))).toBe(true);
    }
    for(const e of [na4,na3,nuo2,good]){
      expect(reviewedMoeNaSurnameRoleEligible(e,profile(e,"PRON"))).toBe(true);
    }
    expect(()=>reviewedMoeNaSurnameRoleEligible(surname,profile(na4,"PRON"))).toThrow(/actual selected/);
  });
});
describe("full 2048 final product seed role-aware regression",()=>{
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"此此",root:"sentence.declarative",entryIds:[good.id,good.id],
    }));
    for(const i of FROZEN_BAD_NA_SURNAME_SEEDS){
      sentences[i]={...sentences[i]!,text:"此那",entryIds:[good.id,surname.id]};
    }
    const before={
      readingEligibilityPolicy:"standard-guo-trial",seedNamespace:"frozen",
      catalogEntryCount:25,sampleCount:2048,successfulSentences:2048,failedSentences:0,
      sentences,hits:FROZEN_BAD_NA_SURNAME_SEEDS.map(seedIndex=>({
        seedIndex,text:"那",selectedEntryId:surname.id,selectedUpos:seedIndex===248||seedIndex===1292?"ADV":"PRON",
      })),
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-na-surname-trial",hits:[],
      sentences:sentences.map((s,i)=>({...s,entryIds:FROZEN_BAD_NA_SURNAME_SEEDS.includes(i as typeof FROZEN_BAD_NA_SURNAME_SEEDS[number])
        ?[good.id,na4.id]:[...s.entryIds],text:FROZEN_BAD_NA_SURNAME_SEEDS.includes(i as typeof FROZEN_BAD_NA_SURNAME_SEEDS[number])?"此那":s.text})),
    };
    return {before,after};
  }
  it("allows precisely the previously invalid slots of 33 seeds",()=>{
    const {before,after}=reports();
    const summary=compareMoeNaSurname(before,after);
    expect(summary.changedSeeds).toEqual([...FROZEN_BAD_NA_SURNAME_SEEDS]);
    expect(summary.changedDetails).toHaveLength(33);
    expect(summary.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("rejects unrelated seed drift",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[na3.id,good.id]};
    expect(()=>compareMoeNaSurname(before,after)).toThrow(/unrelated seed changed/);
  });
  it("rejects wrong-slot changes even in a target seed",()=>{
    const {before,after}=reports();
    after.sentences[72]={...after.sentences[72]!,entryIds:[na3.id,surname.id]};
    expect(()=>compareMoeNaSurname(before,after)).toThrow(/wrong lexical slot/);
  });
  it("rejects unchanged invalid surname reading",()=>{
    const {before,after}=reports();
    after.sentences[72]={...before.sentences[72]!};
    expect(()=>compareMoeNaSurname(before,after)).toThrow(/failed to repair/);
  });
  it("checks older known invalid IDs in any final delivered seed",()=>{
    const {before,after}=reports();
    const old=entry("得","ㄉㄜ4");
    before.sentences[60]={...before.sentences[60]!,entryIds:[old.id,good.id]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[old.id,good.id]};
    expect(()=>compareMoeNaSurname(before,after)).toThrow(/previously confirmed invalid/);
  });
});
