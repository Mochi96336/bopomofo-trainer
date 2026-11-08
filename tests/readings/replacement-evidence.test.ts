import {describe,expect,it} from "vitest";
import {reviewReplacementEvidence} from "../../scripts/audit-replacement-evidence.js";

const filler="word:非:ㄈㄟ1";
const num20="word:二十:ㄦ4-ㄕ2",num87="word:八十七:ㄅㄚ1-ㄕ2-ㄑㄧ1";
const wrong="word:分:ㄈㄣ4",row="word:行:ㄒㄧㄥ2",piece="word:塊:ㄎㄨㄞ4";
function fixture(){
 const beforeSentences=Array.from({length:2048},(_,seedIndex)=>({
   seedIndex,text:"非",root:"sentence.declarative",entryIds:[filler] as string[]}));
 beforeSentences[1720]={seedIndex:1720,text:"二十分",root:"sentence.declarative",entryIds:[filler,filler,num20,wrong]};
 beforeSentences[1967]={seedIndex:1967,text:"八十七分",root:"sentence.declarative",entryIds:[num87,wrong]};
 const afterSentences=beforeSentences.map(s=>({...s,entryIds:[...s.entryIds]}));
 afterSentences[1720]!.entryIds[3]=row;
 afterSentences[1967]!.entryIds[1]=piece;
 afterSentences[1720]!.text="二十行";
 afterSentences[1967]!.text="八十七塊";
 const before={readingEligibilityPolicy:"standard-role-tenth-trial",sampleCount:2048,successfulSentences:2048,sentences:beforeSentences,hits:[]};
 const after={readingEligibilityPolicy:"standard-numeric-fen-trial",sampleCount:2048,successfulSentences:2048,sentences:afterSentences,hits:[{
   seedIndex:1720,entryIndex:3,selectedEntryId:row,selectedUpos:"NOUN",
   selectedProfileId:"profile:row",previousEntryText:"二十",nextEntryText:null,
   alternativeEntryIds:["word:行:ㄏㄤ2"]}]};
 const comparison={schemaVersion:"moe-numeric-fen-paired-diff-v1",changedOutsideOriginallyInvalidSlot:0,changedDetails:[
   {seedIndex:1720,slot:3,priorId:wrong,newId:row},
   {seedIndex:1967,slot:1,priorId:wrong,newId:piece}]};
 const coverage={schemaVersion:"selected-moe-headword-coverage-v1",sourcePolicy:"standard-numeric-fen-trial",sampleCount:2048,identities:[
   {entryId:row,status:"not-in-exact-headword-projections",projection:null},
   {entryId:piece,status:"matches-concised-projection",projection:{source:"moe-concised",reading:"ㄎㄨㄞ4",sourceEntryId:"2600"}}]};
 return {before,after,comparison,coverage};
}
describe("eleventh replacement evidence, never a candidate eligibility gate",()=>{
 it("reports dictionary evidence and unknown senses separately",()=>{
   const result=reviewReplacementEvidence(...Object.values(fixture()) as Parameters<typeof reviewReplacementEvidence>);
   expect(result.changedSlotCount).toBe(2);
   expect(result.matchesPartialDictionaryProjection).toBe(1);
   expect(result.needsFullReferenceReview).toBe(1);
   expect(result.contextualSenseVerified).toBe(0);
   expect(result.entries[0]).toMatchObject({seedIndex:1720,slot:3,previousLexeme:"二十",selectedUpos:"NOUN",contextualSense:"not-established",pronunciationEvidence:"needs-full-reference-review"});
   expect(result.entries[1]).toMatchObject({seedIndex:1967,slot:1,previousLexeme:"八十七",selectedUpos:null,contextualSense:"not-established",pronunciationEvidence:"matches-partial-dictionary-projection"});
 });
 it("rejects drift, missing coverage and wrong profile-joined lexical identity",()=>{
   const a=fixture();a.after.sentences[1720]!.entryIds[2]=row;
   expect(()=>reviewReplacementEvidence(a.before,a.after,a.comparison,a.coverage)).toThrow(/nonlocal changes/);
   const b=fixture();b.coverage.identities=b.coverage.identities.slice(1);
   expect(()=>reviewReplacementEvidence(b.before,b.after,b.comparison,b.coverage)).toThrow(/missing from final dictionary coverage/);
   const c=fixture();c.after.hits[0]!.selectedEntryId=piece;
   expect(()=>reviewReplacementEvidence(c.before,c.after,c.comparison,c.coverage)).toThrow(/identity disagrees/);
   const d=fixture();d.coverage.sourcePolicy="standard-role-tenth-trial";
   expect(()=>reviewReplacementEvidence(d.before,d.after,d.comparison,d.coverage)).toThrow(/aligned final/);
 });
});
