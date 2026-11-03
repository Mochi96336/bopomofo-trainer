import { readFileSync,writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import {
  isMoeThirdRoleMismatch,
  isMoeFollowupRoleMismatch,
  isMoeAttestedRoleMismatch,
  MOE_THIRD_ROLE_RESTRICTIONS,
} from "../src/readings/moe-attested-role-compatibility.js";
import type { Upos } from "../src/syntax/types.js";

interface Sentence { readonly seedIndex:number; readonly text:string|null; readonly root:string|null; readonly entryIds:readonly string[] }
interface Hit { readonly seedIndex:number;readonly entryIndex:number;readonly selectedEntryId:string;readonly selectedUpos:string }
interface Report {readonly readingEligibilityPolicy:string;readonly seedNamespace:string;readonly catalogEntryCount:number;readonly sampleCount:number;readonly successfulSentences:number;readonly failedSentences:number;readonly sentences:readonly Sentence[];readonly hits:readonly Hit[]}

/** Frozen #448 final: 24 wrongly selected slots across exactly 24 seeds. */
export const FROZEN_MOE_THIRD_BAD_SLOTS = [
  {seed:85,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:94,slot:0,id:catalogEntryId("上","ㄕㄤ3"),upos:"DET"},
  {seed:268,slot:1,id:catalogEntryId("種","ㄓㄨㄥ4"),upos:"NOUN"},
  {seed:328,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:408,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:443,slot:3,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:539,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:588,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:635,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:680,slot:1,id:catalogEntryId("上","ㄕㄤ3"),upos:"DET"},
  {seed:855,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:1011,slot:2,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:1016,slot:1,id:catalogEntryId("上","ㄕㄤ3"),upos:"DET"},
  {seed:1125,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:1196,slot:3,id:catalogEntryId("種","ㄓㄨㄥ4"),upos:"NOUN"},
  {seed:1211,slot:3,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:1473,slot:3,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:1474,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:1524,slot:0,id:catalogEntryId("上","ㄕㄤ3"),upos:"DET"},
  {seed:1635,slot:1,id:catalogEntryId("為","ㄨㄟ4"),upos:"AUX"},
  {seed:1774,slot:4,id:catalogEntryId("種","ㄓㄨㄥ4"),upos:"NOUN"},
  {seed:1804,slot:5,id:catalogEntryId("種","ㄓㄨㄥ4"),upos:"NOUN"},
  {seed:1930,slot:2,id:catalogEntryId("種","ㄓㄨㄥ4"),upos:"NOUN"},
  {seed:2033,slot:3,id:catalogEntryId("上","ㄕㄤ3"),upos:"DET"},
] as const;
type Frozen={seed:number;slot:number;id:string;upos:string};
const bySeed=new Map<number,Frozen[]>();
for(const r of FROZEN_MOE_THIRD_BAD_SLOTS){
  const v=bySeed.get(r.seed)??[];
  v.push(r);bySeed.set(r.seed,v);
}
const bad=(hit:Hit)=>isMoeThirdRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos);

export function compareMoeRoleThird(before:Report,after:Report){
  if(before.readingEligibilityPolicy!=="standard-role-followup-trial"
    || after.readingEligibilityPolicy!=="standard-role-third-trial"
    || before.seedNamespace!==after.seedNamespace
    || before.catalogEntryCount!==after.catalogEntryCount
    || before.sampleCount!==2048||after.sampleCount!==2048
    || before.successfulSentences!==2048||after.successfulSentences!==2048
    || before.failedSentences!==0||after.failedSentences!==0
    || before.sentences.length!==2048||after.sentences.length!==2048
    || !Array.isArray(before.hits)||!Array.isArray(after.hits)) {
    throw new Error("MOE role follow-up requires exact 2048 successful paired final product samples");
  }
  const observed=before.hits.filter(bad)
    .map(h=>({seed:h.seedIndex,slot:h.entryIndex,id:h.selectedEntryId,upos:h.selectedUpos}))
    .sort((a,b)=>a.seed-b.seed||a.slot-b.slot);
  if(JSON.stringify(observed)!==JSON.stringify(FROZEN_MOE_THIRD_BAD_SLOTS)){
    throw new Error("prior shipping four-role exposure drifted: re-review source evidence");
  }
  if(after.hits.some(bad))throw new Error("unsupported role pronunciation persists in final output");
  const changes:Array<{seedIndex:number;slot:number;priorId:string;newId:string}>=[];
  const changedSeeds:number[]=[];
  for(let i=0;i<2048;i++){
    const left=before.sentences[i],right=after.sentences[i];
    if(!left||!right||left.seedIndex!==i||right.seedIndex!==i
      || left.root!==right.root||left.entryIds.length!==right.entryIds.length){
      throw new Error("seed, syntax root, or lexical length drift at "+i);
    }
    const changed=left.entryIds.flatMap((id,slot)=>id===right.entryIds[slot]?[]:[slot]);
    if(changed.length===0&&left.text!==right.text)throw new Error("unexpected text drift at "+i);
    const expected=bySeed.get(i)??[];
    const frozenSlots=expected.map(x=>x.slot);
    if(JSON.stringify(changed)!==JSON.stringify(frozenSlots)){
      throw new Error("off-target lexical slot change or incomplete role repair at "+i);
    }
    for(const target of expected){
      if(left.entryIds[target.slot]!==target.id){
        throw new Error("original target identity drift at "+i+":"+target.slot);
      }
      changes.push({seedIndex:i,slot:target.slot,priorId:target.id,newId:right.entryIds[target.slot]!});
    }
    if(changed.length)changedSeeds.push(i);
  }
  if(changes.length!==24||changedSeeds.length!==24)throw new Error("role follow-up repair count mismatch");
  const globallyUnsupported=[
    catalogEntryId("比","ㄅㄧ1"),catalogEntryId("了","ㄌㄧㄠ4"),catalogEntryId("得","ㄉㄜ4"),
    catalogEntryId("於","ㄩ1"),catalogEntryId("南","ㄋㄚ1"),catalogEntryId("行","ㄏㄥ2"),
    catalogEntryId("過","ㄍㄨㄛ5"),
  ];
  for(const s of after.sentences){
    if(s.entryIds.some(id=>globallyUnsupported.includes(id)))throw new Error("old invalid reading survives at "+s.seedIndex);
  }
  for(const hit of after.hits){
    if(isMoeAttestedRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos)
      || isMoeFollowupRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos)) {
      throw new Error("prior #447 role mismatch reappeared at "+hit.seedIndex);
    }
    if(hit.selectedEntryId===catalogEntryId("那","ㄋㄚ1")
      &&(hit.selectedUpos==="PRON"||hit.selectedUpos==="ADV")){
      throw new Error("old surname tone in wrong role at "+hit.seedIndex);
    }
  }
  const perIdentity=MOE_THIRD_ROLE_RESTRICTIONS.map(row=>({
    entryId:row.entryId,before:observed.filter(hit=>hit.id===row.entryId).length,after:0,
  }));
  return {
    schemaVersion:"moe-role-third-paired-diff-v1",sampleCount:2048,
    incompatibleUsesBefore:observed.length,incompatibleUsesAfter:0,
    changedSeeds,changedSlotCount:changes.length,changedOutsideOriginallyInvalidSlot:0,
    perIdentity,changedDetails:changes,
    caveat:"Selected role mismatches only: every listed sound remains legal for other dictionary-attested usage.",
  };
}
if(process.argv[1]?.endsWith("compare-moe-role-third.ts")){
  const [before,after,out]=process.argv.slice(2);
  if(!before||!after||!out)throw new Error("usage: compare-moe-role-third <before.json> <after.json> <summary.json>");
  const result=compareMoeRoleThird(
    JSON.parse(readFileSync(before,"utf8")) as Report,
    JSON.parse(readFileSync(after,"utf8")) as Report,
  );
  writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
