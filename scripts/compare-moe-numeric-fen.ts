import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import type { Upos } from "../src/syntax/types.js";
import {
  isMoeAttestedRoleMismatch, isMoeFollowupRoleMismatch,
  isMoeThirdRoleMismatch, isMoeFourthRoleMismatch, isMoeFifthRoleMismatch,
  isMoeSixthRoleMismatch, isMoeSeventhRoleMismatch, isMoeEighthRoleMismatch,
  isMoeTenthRoleMismatch,
} from "../src/readings/moe-attested-role-compatibility.js";

interface Sentence {
  seedIndex: number; text: string | null; root: string | null; entryIds: string[];
}
interface Hit {
  seedIndex: number; entryIndex: number; text: string; selectedEntryId: string;
  selectedUpos: string | null; previousEntryText: string | null;
}
interface Report {
  readingEligibilityPolicy: string; seedNamespace: string; catalogEntryCount: number;
  sampleCount: number; successfulSentences: number; failedSentences: number;
  sentences: Sentence[]; hits: Hit[];
}
const NUMBER = /^[零〇一二三四五六七八九十百千萬億兩0-9０-９]+$/u;
const GOOD = catalogEntryId("分","ㄈㄣ1");
const WRONG = catalogEntryId("分","ㄈㄣ4");
export const FROZEN_NUMERIC_FEN_BAD_SLOTS = [
  {seed:1720,slot:3,id:WRONG,upos:"NOUN",previousText:"二十"},
  {seed:1967,slot:1,id:WRONG,upos:"NOUN",previousText:"八十七"},
] as const;
const wrong=(h:Hit)=>h.text==="分" && h.selectedUpos==="NOUN"
  && h.previousEntryText!==null && NUMBER.test(h.previousEntryText)
  && h.selectedEntryId!==GOOD;

export function compareMoeNumericFen(before:Report,after:Report) {
  if(before.readingEligibilityPolicy!=="standard-role-tenth-trial"
    ||after.readingEligibilityPolicy!=="standard-numeric-fen-trial"
    ||before.seedNamespace!==after.seedNamespace
    ||before.catalogEntryCount!==after.catalogEntryCount
    ||before.sampleCount!==2048||after.sampleCount!==2048
    ||before.successfulSentences!==2048||after.successfulSentences!==2048
    ||before.failedSentences!==0||after.failedSentences!==0
    ||before.sentences.length!==2048||after.sentences.length!==2048
    ||!Array.isArray(before.hits)||!Array.isArray(after.hits)) {
    throw new Error("numeric-fen comparison requires 2048 successful matching seeds");
  }
  const observed=before.hits.filter(wrong).map(h=>({
    seed:h.seedIndex,slot:h.entryIndex,id:h.selectedEntryId,
    upos:h.selectedUpos,previousText:h.previousEntryText,
  })).sort((a,b)=>a.seed-b.seed||a.slot-b.slot);
  if(JSON.stringify(observed)!==JSON.stringify(FROZEN_NUMERIC_FEN_BAD_SLOTS))
    throw new Error("frozen #459 numeric-fen source tuples drifted");
  if(after.hits.some(wrong))throw new Error("numeric-fen mismatch remains");

  const changedSeeds:number[]=[];
  const changedDetails:Array<{seedIndex:number;slot:number;priorId:string;newId:string}>=[];
  for(let i=0;i<2048;i++){
    const left=before.sentences[i],right=after.sentences[i];
    if(!left||!right||left.seedIndex!==i||right.seedIndex!==i
      ||left.root!==right.root||left.entryIds.length!==right.entryIds.length)
      throw new Error("seed/root/lexical-count drift at "+i);
    const changed=left.entryIds.flatMap((id,j)=>id===right.entryIds[j]?[]:[j]);
    if(changed.length===0&&left.text!==right.text)
      throw new Error("text drift without lexical change at "+i);
    const target=FROZEN_NUMERIC_FEN_BAD_SLOTS.find(x=>x.seed===i);
    const expected=target?[target.slot]:[];
    if(JSON.stringify(changed)!==JSON.stringify(expected))
      throw new Error("change outside frozen numeric-fen slots at "+i);
    if(target) {
      if(left.entryIds[target.slot]!==WRONG)throw new Error("source entry identity drift");
      changedSeeds.push(i);
      changedDetails.push({seedIndex:i,slot:target.slot,
        priorId:left.entryIds[target.slot]!,newId:right.entryIds[target.slot]!});
    }
  }
  const previouslyUnsupported=[
    catalogEntryId("比","ㄅㄧ1"),catalogEntryId("了","ㄌㄧㄠ4"),
    catalogEntryId("得","ㄉㄜ4"),catalogEntryId("於","ㄩ1"),
    catalogEntryId("南","ㄋㄚ1"),catalogEntryId("行","ㄏㄥ2"),
    catalogEntryId("過","ㄍㄨㄛ5"),
  ];
  for(const sentence of after.sentences) {
    if(sentence.entryIds.some(id=>previouslyUnsupported.includes(id)))
      throw new Error("previous global reading restriction regressed");
  }
  for(const h of after.hits){
    if(h.selectedUpos===null)throw new Error("missing selected UPOS");
    const upos=h.selectedUpos as Upos;
    if(isMoeAttestedRoleMismatch(h.selectedEntryId,upos)
      ||isMoeFollowupRoleMismatch(h.selectedEntryId,upos)
      ||isMoeThirdRoleMismatch(h.selectedEntryId,upos)
      ||isMoeFourthRoleMismatch(h.selectedEntryId,upos)
      ||isMoeFifthRoleMismatch(h.selectedEntryId,upos)
      ||isMoeSixthRoleMismatch(h.selectedEntryId,upos)
      ||isMoeSeventhRoleMismatch(h.selectedEntryId,upos)
      ||isMoeEighthRoleMismatch(h.selectedEntryId,upos)
      ||isMoeTenthRoleMismatch(h.selectedEntryId,upos))
      throw new Error("prior reading/role gate regressed");
    if(h.text==="間"&&h.selectedUpos==="NOUN"
      &&h.previousEntryText!==null
      &&/^第[一二三四五六七八九十百千萬兩零〇0-9０-９]+$/u.test(h.previousEntryText)
      &&h.selectedEntryId!==catalogEntryId("間","ㄐㄧㄢ1"))
      throw new Error("prior ordinal-room gate regressed");
  }
  if(changedSeeds.length!==2||changedDetails.length!==2)
    throw new Error("expected exactly two affected seeds and slots");
  return {schemaVersion:"moe-numeric-fen-paired-diff-v1",sampleCount:2048,
    incompatibleUsesBefore:observed.length,incompatibleUsesAfter:0,
    changedSeeds,changedSlotCount:changedDetails.length,
    changedOutsideOriginallyInvalidSlot:0,changedDetails,
    caveat:"Only numeric-adjacent noun 分 is gated; other fèn senses are retained."};
}
if(process.argv[1]?.endsWith("compare-moe-numeric-fen.ts")){
  const [before,after,out]=process.argv.slice(2);
  if(!before||!after||!out)throw new Error("usage: compare-moe-numeric-fen before.json after.json out.json");
  const result=compareMoeNumericFen(
    JSON.parse(readFileSync(before,"utf8")) as Report,
    JSON.parse(readFileSync(after,"utf8")) as Report);
  writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
