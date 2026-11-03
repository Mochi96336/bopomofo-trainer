import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";
import {
  reviewedMoeAttestedRoleEligible,
  isMoeAttestedRoleMismatch,
  MOE_ATTESTED_ROLE_RESTRICTIONS,
} from "../../src/readings/moe-attested-role-compatibility.js";
import {
  compareMoeAttestedRoles,
  FROZEN_MOE_ROLE_BAD_SLOTS,
} from "../../scripts/compare-moe-attested-roles.js";

function entry(text:string,reading:string):CatalogEntry {
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄕ","tone:4"]}],tags:[],provenanceIds:[]};
}
function profile(e:CatalogEntry,upos:Upos):RuntimeSyntaxProfile {
  return {id:e.id+"/"+upos,entryId:e.id,upos,
    functions:upos==="NUM"?["numeral"]:upos==="NOUN"?["subject"]:["adverbial"],
    valencyFrames:["avalent"],dependencyEvidence:{
      dependencyRelationCounts:{},surfacePositionCounts:{},
    },provenanceIds:[]};
}

describe("reviewed MOE role evidence table, not a blanket reading blacklist",()=>{
  it("rejects exactly five evidence-backed lexical identities only in unsupported POS",()=>{
    expect(MOE_ATTESTED_ROLE_RESTRICTIONS).toHaveLength(5);
    for(const rule of MOE_ATTESTED_ROLE_RESTRICTIONS){
      const last=rule.entryId.lastIndexOf(":");
      const e=entry(rule.entryId.slice(5,last),rule.entryId.slice(last+1));
      for(const role of rule.rejectedUpos){
        expect(reviewedMoeAttestedRoleEligible(e,profile(e,role))).toBe(false);
        expect(isMoeAttestedRoleMismatch(e.id,role)).toBe(true);
      }
      for(const role of ["PROPN","VERB","ADV"] as const){
        expect(reviewedMoeAttestedRoleEligible(e,profile(e,role))).toBe(true);
      }
    }
  });
  it("preserves numeral six and number readings, nouns 地/ㄉㄧ4, legitimate surnames",()=>{
    for(const [word,reading,role] of [
      ["數","ㄕㄨ4","NUM"],
      ["單","ㄉㄢ1","NUM"],
      ["六","ㄌㄧㄡ4","NUM"],
      ["六","ㄌㄨ4","PROPN"],
      ["單","ㄕㄢ4","PROPN"],
      ["地","ㄉㄧ4","NOUN"],
      ["地","ㄉㄜ5","PART"],
      ["數見不鮮","ㄕㄨㄛ4-ㄐㄧㄢ4-ㄅㄨ4-ㄒㄧㄢ1","ADV"],
      ["單于","ㄔㄢ2-ㄩ2","NOUN"],
    ] as const){
      const e=entry(word,reading);
      expect(reviewedMoeAttestedRoleEligible(e,profile(e,role))).toBe(true);
    }
  });
  it("checks the selected lexical identity rather than using only same written form",()=>{
    const bad=entry("數","ㄕㄨㄛ4"),good=entry("數","ㄕㄨ4");
    expect(()=>reviewedMoeAttestedRoleEligible(bad,profile(good,"NUM")))
      .toThrow(/actual selected/);
  });
});
describe("evidence-based batch is auditable at exact frozen selected slots",()=>{
  const other=entry("他","ㄊㄚ1");
  const legal=entry("六","ㄌㄧㄡ4");
  function reports(){
    const sentences=Array.from({length:2048},(_,seedIndex)=>({
      seedIndex,text:"他",root:"sentence.declarative",entryIds:[other.id],
    }));
    const hits=FROZEN_MOE_ROLE_BAD_SLOTS.map(item=>{
      sentences[item.seed]={
        ...sentences[item.seed]!,
        entryIds:Array.from({length:item.slot+1},(_,i)=>i===item.slot?item.id:other.id),
      };
      return {
        seedIndex:item.seed,entryIndex:item.slot,selectedEntryId:item.id,
        text:item.id.slice(5,item.id.lastIndexOf(":")),
        selectedUpos:item.id===catalogEntryId("地","ㄉㄜ5")?"NOUN":"NUM",
      };
    });
    const before={
      readingEligibilityPolicy:"standard-na-surname-trial",
      seedNamespace:"formal-syntax-v2-phase1-product-baseline-v1",
      catalogEntryCount:900,sampleCount:2048,failedSentences:0,
      successfulSentences:2048,sentences,hits,
    };
    const after={
      ...before,readingEligibilityPolicy:"standard-role-evidence-trial",
      hits:[] as Array<{seedIndex:number;entryIndex:number;selectedEntryId:string;
        text:string;selectedUpos:string}>,
      sentences:sentences.map((s,i)=>({
        ...s,
        entryIds:FROZEN_MOE_ROLE_BAD_SLOTS.some(x=>x.seed===i)
          ? s.entryIds.map(id=>id===other.id?other.id:legal.id)
          : [...s.entryIds],
      })),
    };
    return {before,after};
  }
  it("changes precisely 16 invalid lexical slots and no other seed or syntax root",()=>{
    const {before,after}=reports();
    const result=compareMoeAttestedRoles(before,after);
    expect(result.wrongRoleOccurrencesBefore).toBe(16);
    expect(result.wrongRoleOccurrencesAfter).toBe(0);
    expect(result.changedSeeds).toEqual(FROZEN_MOE_ROLE_BAD_SLOTS.map(x=>x.seed));
    expect(result.changedDetails).toHaveLength(16);
    expect(result.changedOutsideOriginallyInvalidSlot).toBe(0);
  });
  it("rejects changes to otherwise legitimate seeds",()=>{
    const {before,after}=reports();
    after.sentences[60]={...after.sentences[60]!,entryIds:[legal.id]};
    expect(()=>compareMoeAttestedRoles(before,after)).toThrow(/unrelated seed/);
  });
  it("rejects wrong-slot changes in a bad seed",()=>{
    const {before,after}=reports();
    after.sentences[399]={...after.sentences[399]!,entryIds:[legal.id,
      before.sentences[399]!.entryIds[1]!]};
    expect(()=>compareMoeAttestedRoles(before,after)).toThrow(/originally invalid slot/);
  });
  it("rejects an incomplete repair",()=>{
    const {before,after}=reports();
    after.sentences[399]={...before.sentences[399]!};
    expect(()=>compareMoeAttestedRoles(before,after)).toThrow(/unrepaired originally invalid slot/);
  });
  it("fails if any previous invalid pronunciation reappears in an untouched sample",()=>{
    const {before,after}=reports();
    const old=entry("行","ㄏㄥ2");
    before.sentences[60]={...before.sentences[60]!,entryIds:[old.id]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[old.id]};
    expect(()=>compareMoeAttestedRoles(before,after)).toThrow(/previously established unsupported/);
  });
  it("detects a previously fixed surname-tone 那 in PRON or ADV",()=>{
    const {before,after}=reports();
    const oldId=catalogEntryId("那","ㄋㄚ1");
    before.sentences[60]={...before.sentences[60]!,entryIds:[oldId]};
    after.sentences[60]={...after.sentences[60]!,entryIds:[oldId]};
    after.hits.push({seedIndex:60,entryIndex:0,selectedEntryId:oldId,
      text:"那",selectedUpos:"PRON"});
    expect(()=>compareMoeAttestedRoles(before,after)).toThrow(/surname-only/);
  });
});
