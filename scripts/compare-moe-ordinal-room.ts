import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import {
  isMoeAttestedRoleMismatch,
  isMoeFollowupRoleMismatch,
  isMoeThirdRoleMismatch,
  isMoeFourthRoleMismatch,
  isMoeFifthRoleMismatch,
  isMoeSixthRoleMismatch,
  isMoeSeventhRoleMismatch,
  isMoeEighthRoleMismatch,
} from "../src/readings/moe-attested-role-compatibility.js";
import type { Upos } from "../src/syntax/types.js";

interface Sentence {
  readonly seedIndex: number;
  readonly text: string | null;
  readonly root: string | null;
  readonly entryIds: readonly string[];
}
interface Hit {
  readonly seedIndex: number;
  readonly entryIndex: number;
  readonly text: string;
  readonly selectedEntryId: string;
  readonly selectedUpos: string | null;
  readonly previousEntryText: string | null;
}
interface Report {
  readonly readingEligibilityPolicy: string;
  readonly seedNamespace: string;
  readonly catalogEntryCount: number;
  readonly sampleCount: number;
  readonly successfulSentences: number;
  readonly failedSentences: number;
  readonly sentences: readonly Sentence[];
  readonly hits: readonly Hit[];
}

const ORDINAL = /^第[一二三四五六七八九十百千萬兩零〇0-9０-９]+$/u;
const ROOM_READ = catalogEntryId("間", "ㄐㄧㄢ1");

/** Frozen from merged #457 final eighth-stage 2048-seed output. */
export const FROZEN_ORDINAL_ROOM_BAD_SLOTS = [
  { seed: 832, slot: 2, id: catalogEntryId("間", "ㄐㄧㄢ4"),
    upos: "NOUN", previousText: "第八" },
] as const;

const wrong = (h:Hit) => h.text === "間" && h.selectedUpos === "NOUN"
  && h.previousEntryText !== null && ORDINAL.test(h.previousEntryText)
  && h.selectedEntryId !== ROOM_READ;

export function compareMoeOrdinalRoom(before:Report,after:Report) {
  if (before.readingEligibilityPolicy !== "standard-role-eighth-trial"
    || after.readingEligibilityPolicy !== "standard-ordinal-room-trial"
    || before.seedNamespace !== after.seedNamespace
    || before.catalogEntryCount !== after.catalogEntryCount
    || before.sampleCount !== 2048 || after.sampleCount !== 2048
    || before.successfulSentences !== 2048 || after.successfulSentences !== 2048
    || before.failedSentences !== 0 || after.failedSentences !== 0
    || before.sentences.length !== 2048 || after.sentences.length !== 2048
    || !Array.isArray(before.hits) || !Array.isArray(after.hits)) {
    throw new Error("ordinal-room trial requires the same 2048 successful final product samples");
  }
  const observed = before.hits.filter(wrong)
    .map(h => ({
      seed: h.seedIndex, slot: h.entryIndex, id: h.selectedEntryId,
      upos: h.selectedUpos, previousText: h.previousEntryText,
    })).sort((a,b) => a.seed-b.seed || a.slot-b.slot);
  if (JSON.stringify(observed) !== JSON.stringify(FROZEN_ORDINAL_ROOM_BAD_SLOTS)) {
    throw new Error("frozen #457 final ordinal-room selected reading drifted");
  }
  if (after.hits.some(wrong)) {
    throw new Error("ordinal room still contains non-classifier reading");
  }

  const changedSeeds:number[]=[];
  const changes:Array<{seedIndex:number;slot:number;priorId:string;newId:string}>=[];
  for(let i=0;i<2048;i++) {
    const left=before.sentences[i],right=after.sentences[i];
    if(!left||!right||left.seedIndex!==i||right.seedIndex!==i
      ||left.root!==right.root||left.entryIds.length!==right.entryIds.length) {
      throw new Error("seed, syntax root or lexical count drifted at "+i);
    }
    const different=left.entryIds.flatMap((id,at)=>id===right.entryIds[at]?[]:[at]);
    if(different.length===0 && left.text!==right.text) {
      throw new Error("text drift without lexical changes at "+i);
    }
    const expected=i===832?[2]:[];
    if(JSON.stringify(different)!==JSON.stringify(expected)) {
      throw new Error("unexpected change outside frozen ordinal-room lexical slot at "+i);
    }
    if(different.length){
      if(left.entryIds[2]!==FROZEN_ORDINAL_ROOM_BAD_SLOTS[0].id){
        throw new Error("frozen source identity drifted");
      }
      changedSeeds.push(i);
      changes.push({seedIndex:i,slot:2,priorId:left.entryIds[2]!,newId:right.entryIds[2]!});
    }
  }
  if(changedSeeds.length!==1 || changes.length!==1) {
    throw new Error("ordinal room trial must change exactly one target slot");
  }
  const globallyUnsupported=[
    catalogEntryId("比","ㄅㄧ1"),catalogEntryId("了","ㄌㄧㄠ4"),
    catalogEntryId("得","ㄉㄜ4"),catalogEntryId("於","ㄩ1"),
    catalogEntryId("南","ㄋㄚ1"),catalogEntryId("行","ㄏㄥ2"),
    catalogEntryId("過","ㄍㄨㄛ5"),
  ];
  for(const s of after.sentences) {
    if(s.entryIds.some(id=>globallyUnsupported.includes(id))) {
      throw new Error("previously fixed unsupported sound reappeared at "+s.seedIndex);
    }
  }
  for(const h of after.hits) {
    if (h.selectedUpos===null) throw new Error("missing selected lexical role");
    const upos=h.selectedUpos as Upos;
    if(isMoeAttestedRoleMismatch(h.selectedEntryId,upos)
      || isMoeFollowupRoleMismatch(h.selectedEntryId,upos)
      || isMoeThirdRoleMismatch(h.selectedEntryId,upos)
      || isMoeFourthRoleMismatch(h.selectedEntryId,upos)
      || isMoeFifthRoleMismatch(h.selectedEntryId,upos)
      || isMoeSixthRoleMismatch(h.selectedEntryId,upos)
      || isMoeSeventhRoleMismatch(h.selectedEntryId,upos)
      || isMoeEighthRoleMismatch(h.selectedEntryId,upos)) {
      throw new Error("previous reading-role mismatch reappeared at "+h.seedIndex);
    }
    if(h.selectedEntryId===catalogEntryId("那","ㄋㄚ1")
       &&(upos==="PRON"||upos==="ADV")) {
      throw new Error("old surname tone reappeared at "+h.seedIndex);
    }
  }
  return {
    schemaVersion:"moe-ordinal-room-paired-diff-v1",
    sampleCount:2048,
    incompatibleUsesBefore:observed.length,
    incompatibleUsesAfter:0,
    changedSeeds,
    changedSlotCount:changes.length,
    changedOutsideOriginallyInvalidSlot:0,
    changedDetails:changes,
    caveat:"Only the selected 第N + 間 noun-classifier slot is reviewed. Other nouns, nonordinal 間, and 三行 remain unreviewed.",
  };
}
if(process.argv[1]?.endsWith("compare-moe-ordinal-room.ts")){
  const [before,after,out]=process.argv.slice(2);
  if(!before||!after||!out)throw new Error("usage: compare-moe-ordinal-room <before.json> <after.json> <out.json>");
  const result=compareMoeOrdinalRoom(
    JSON.parse(readFileSync(before,"utf8")) as Report,
    JSON.parse(readFileSync(after,"utf8")) as Report,
  );
  writeFileSync(out,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
