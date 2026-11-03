import { readFileSync,writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import {
  isMoeSeventhRoleMismatch,
  isMoeFollowupRoleMismatch,
  isMoeThirdRoleMismatch,
  isMoeFourthRoleMismatch,
  isMoeFifthRoleMismatch,
  isMoeSixthRoleMismatch,
  isMoeAttestedRoleMismatch,
  MOE_SEVENTH_ROLE_RESTRICTIONS,
} from "../src/readings/moe-attested-role-compatibility.js";
import type { Upos } from "../src/syntax/types.js";

interface Sentence { readonly seedIndex:number; readonly text:string|null; readonly root:string|null; readonly entryIds:readonly string[] }
interface Hit { readonly seedIndex:number;readonly entryIndex:number;readonly selectedEntryId:string;readonly selectedUpos:string }
interface Report {readonly readingEligibilityPolicy:string;readonly seedNamespace:string;readonly catalogEntryCount:number;readonly sampleCount:number;readonly successfulSentences:number;readonly failedSentences:number;readonly sentences:readonly Sentence[];readonly hits:readonly Hit[]}

/** Frozen from #453 sixth-stage final 2048-seed product sample: 18 slots across 17 seeds. */
export const FROZEN_MOE_SEVENTH_BAD_SLOTS = [
  {seed:81,slot:0,id:catalogEntryId("和","ㄏㄨ2"),upos:"PROPN"},
  {seed:135,slot:1,id:catalogEntryId("和","ㄏㄜ4"),upos:"NOUN"},
  {seed:327,slot:1,id:catalogEntryId("和","ㄏㄨㄛ4"),upos:"PROPN"},
  {seed:442,slot:1,id:catalogEntryId("和","ㄏㄜ4"),upos:"NOUN"},
  {seed:516,slot:1,id:catalogEntryId("和","ㄏㄨㄛ2"),upos:"PROPN"},
  {seed:599,slot:2,id:catalogEntryId("和","ㄏㄨ2"),upos:"PROPN"},
  {seed:742,slot:0,id:catalogEntryId("和","ㄏㄨㄛ4"),upos:"PROPN"},
  {seed:830,slot:0,id:catalogEntryId("和","ㄏㄨㄛ2"),upos:"PROPN"},
  {seed:950,slot:3,id:catalogEntryId("和","ㄏㄨ2"),upos:"NOUN"},
  {seed:968,slot:0,id:catalogEntryId("和","ㄏㄜ4"),upos:"NOUN"},
  {seed:987,slot:1,id:catalogEntryId("和","ㄏㄨ2"),upos:"PROPN"},
  {seed:1287,slot:3,id:catalogEntryId("和","ㄏㄨㄛ4"),upos:"PROPN"},
  {seed:1354,slot:0,id:catalogEntryId("和","ㄏㄨㄛ2"),upos:"PROPN"},
  {seed:1643,slot:1,id:catalogEntryId("和","ㄏㄨㄛ2"),upos:"PROPN"},
  {seed:1643,slot:3,id:catalogEntryId("和","ㄏㄜ4"),upos:"PROPN"},
  {seed:1687,slot:2,id:catalogEntryId("和","ㄏㄨ2"),upos:"PROPN"},
  {seed:1793,slot:2,id:catalogEntryId("和","ㄏㄨㄛ4"),upos:"NOUN"},
  {seed:1993,slot:0,id:catalogEntryId("和","ㄏㄨㄛ4"),upos:"PROPN"},
] as const;
type Frozen={seed:number;slot:number;id:string;upos:string};
const bySeed=new Map<number,Frozen[]>();
for(const r of FROZEN_MOE_SEVENTH_BAD_SLOTS){
  const v=bySeed.get(r.seed)??[];
  v.push(r);bySeed.set(r.seed,v);
}
const bad=(hit:Hit)=>isMoeSeventhRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos);

export function compareMoeRoleSeventh(before:Report,after:Report){
  if(before.readingEligibilityPolicy!=="standard-role-sixth-trial"
    || after.readingEligibilityPolicy!=="standard-role-seventh-trial"
    || before.seedNamespace!==after.seedNamespace
    || before.catalogEntryCount!==after.catalogEntryCount
    || before.sampleCount!==2048||after.sampleCount!==2048
    || before.successfulSentences!==2048||after.successfulSentences!==2048
    || before.failedSentences!==0||after.failedSentences!==0
    || before.sentences.length!==2048||after.sentences.length!==2048
    || !Array.isArray(before.hits)||!Array.isArray(after.hits)) {
    throw new Error("MOE seventh-role trial requires exact 2048 successful paired final product samples");
  }
  const observed=before.hits.filter(bad)
    .map(h=>({seed:h.seedIndex,slot:h.entryIndex,id:h.selectedEntryId,upos:h.selectedUpos}))
    .sort((a,b)=>a.seed-b.seed||a.slot-b.slot);
  if(JSON.stringify(observed)!==JSON.stringify(FROZEN_MOE_SEVENTH_BAD_SLOTS)){
    throw new Error("prior #453 final 18-slot exposure drifted: re-review source evidence");
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
  if(changes.length!==18||changedSeeds.length!==17)throw new Error("seventh-role repair count mismatch");
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
      || isMoeFollowupRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos)
      || isMoeThirdRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos)
      || isMoeFourthRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos)
      || isMoeFifthRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos)
      || isMoeSixthRoleMismatch(hit.selectedEntryId,hit.selectedUpos as Upos)) {
      throw new Error("previous role mismatch reappeared at "+hit.seedIndex);
    }
    if(hit.selectedEntryId===catalogEntryId("那","ㄋㄚ1")
      &&(hit.selectedUpos==="PRON"||hit.selectedUpos==="ADV")){
      throw new Error("old surname tone in wrong role at "+hit.seedIndex);
    }
  }
  const perIdentity=MOE_SEVENTH_ROLE_RESTRICTIONS.map(row=>({
    entryId:row.entryId,before:observed.filter(hit=>hit.id===row.entryId).length,after:0,
  }));
  return {
    schemaVersion:"moe-role-seventh-paired-diff-v1",sampleCount:2048,
    incompatibleUsesBefore:observed.length,incompatibleUsesAfter:0,
    changedSeeds,changedSlotCount:changes.length,changedOutsideOriginallyInvalidSlot:0,
    perIdentity,changedDetails:changes,
    caveat:"Selected role mismatches only: every listed sound remains legal for other dictionary-attested usage.",
  };
}
if(process.argv[1]?.endsWith("compare-moe-role-seventh.ts")){
  const [before,after,out]=process.argv.slice(2);
  if(!before||!after||!out)throw new Error("usage: compare-moe-role-fourth <before.json> <after.json> <summary.json>");
  const result=compareMoeRoleSeventh(
    JSON.parse(readFileSync(before,"utf8")) as Report,
    JSON.parse(readFileSync(after,"utf8")) as Report,
  );
  writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
