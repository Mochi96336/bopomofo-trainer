import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import { NONSTANDARD_GUO_NEUTRAL_ID } from "../src/readings/moe-standard-guo.js";

interface Sentence {
  readonly seedIndex: number;
  readonly text: string | null;
  readonly root: string | null;
  readonly entryIds: readonly string[];
}
interface Hit { readonly seedIndex: number; readonly text: string; readonly selectedEntryId: string }
interface Report {
  readonly readingEligibilityPolicy: string;
  readonly seedNamespace: string;
  readonly catalogEntryCount: number;
  readonly sampleCount: number;
  readonly failedSentences: number;
  readonly successfulSentences: number;
  readonly sentences: readonly Sentence[];
  readonly hits: readonly Hit[];
}

/**
 * Unlike earlier 1-slot regressions, #1295 contains TWO separately selected
 * unsupported 過/ㄍㄨㄛ5 slots in the same a-not-a question. Allow replacing
 * each original invalid slot, but never an unrelated slot or a legal seed.
 */
export function compareMoeStandardGuo(before:Report, after:Report) {
  if(before.readingEligibilityPolicy!=="standard-xing-trial"
    || after.readingEligibilityPolicy!=="standard-guo-trial"
    || before.seedNamespace!==after.seedNamespace
    || before.catalogEntryCount!==after.catalogEntryCount
    || before.sampleCount!==2048 || after.sampleCount!==2048
    || before.sentences.length!==2048 || after.sentences.length!==2048
    || before.failedSentences!==0 || after.failedSentences!==0
    || before.successfulSentences!==2048 || after.successfulSentences!==2048
    || !Array.isArray(before.hits) || !Array.isArray(after.hits)){
    throw new Error("MOE 過 comparison requires exact 2048 paired #443 final product seeds");
  }
  const knownBad=[223,1295,1874,1959];
  const badHits=before.hits.filter(h=>h.selectedEntryId===NONSTANDARD_GUO_NEUTRAL_ID && h.text==="過");
  const afterBadHits=after.hits.filter(h=>h.selectedEntryId===NONSTANDARD_GUO_NEUTRAL_ID && h.text==="過");
  const badSeeds=[...new Set(badHits.map(h=>h.seedIndex))].sort((a,b)=>a-b);
  if(badHits.length!==5 || JSON.stringify(badSeeds)!==JSON.stringify(knownBad)){
    throw new Error("frozen prior-product 過 neutral-tone exposure changed; re-review seed evidence");
  }
  if(afterBadHits.length!==0) throw new Error("unsupported standalone 過 neutral still selected");
  const changedSeeds:number[]=[];
  const changedDetails:Array<{seedIndex:number;slot:number;priorId:string;newId:string}>=[];
  let originalBadSlots=0;
  for(let i=0;i<2048;i++){
    const left=before.sentences[i], right=after.sentences[i];
    if(!left||!right||left.seedIndex!==i||right.seedIndex!==i
      ||left.root!==right.root ||left.entryIds.length!==right.entryIds.length){
      throw new Error("syntax structure or seed alignment changed at "+i);
    }
    const badSlotIndices=left.entryIds.flatMap((id,slot)=>id===NONSTANDARD_GUO_NEUTRAL_ID?[slot]:[]);
    originalBadSlots+=badSlotIndices.length;
    const changes=left.entryIds.flatMap((id,slot)=>id===right.entryIds[slot]?[]:[slot]);
    if(changes.length===0 && left.text!==right.text){
      throw new Error("unexplained text drift at seed "+i);
    }
    if(changes.length!==badSlotIndices.length
       || changes.some(slot=>left.entryIds[slot]!==NONSTANDARD_GUO_NEUTRAL_ID)){
      throw new Error("unrelated or wrong-slot change at seed "+i);
    }
    if(right.entryIds.includes(NONSTANDARD_GUO_NEUTRAL_ID)){
      throw new Error("unrepaired or newly introduced 過 neutral at seed "+i);
    }
    if(changes.length>0){
      changedSeeds.push(i);
      for(const slot of changes){
        changedDetails.push({
          seedIndex:i,slot,priorId:left.entryIds[slot]!,newId:right.entryIds[slot]!,
        });
      }
    }
  }
  if(originalBadSlots!==5 || JSON.stringify(changedSeeds)!==JSON.stringify(knownBad)){
    throw new Error("wrong count or changed seeds in 過 neutral-tone correction");
  }
  const alreadyKnownInvalid=[
    catalogEntryId("比","ㄅㄧ1"),
    catalogEntryId("了","ㄌㄧㄠ4"),
    catalogEntryId("得","ㄉㄜ4"),
    catalogEntryId("於","ㄩ1"),
    catalogEntryId("南","ㄋㄚ1"),
    catalogEntryId("行","ㄏㄥ2"),
    NONSTANDARD_GUO_NEUTRAL_ID,
  ];
  for(const sentence of after.sentences){
    if(sentence.entryIds.some(id=>alreadyKnownInvalid.includes(id))){
      throw new Error("delivered candidate still contains a previously confirmed unsupported reading at seed "+sentence.seedIndex);
    }
  }
  return {
    schemaVersion:"moe-guo-paired-reading-diff-v1",
    sampleCount:2048,
    unsupportedGuoNeutralBefore:badHits.length,
    unsupportedGuoNeutralAfter:afterBadHits.length,
    originallyInvalidSlots:originalBadSlots,
    badSeeds,changedSeeds,changedOutsideOriginallyInvalidSlot:0,changedDetails,
    caveat:"Applies to standalone Taiwan MOE headword reading in fixed sampling only; not a universal claim about colloquial neutral-tone Mandarin.",
  };
}
if(process.argv[1]?.endsWith("compare-moe-standard-guo.ts")){
  const [beforePath,afterPath,outputPath]=process.argv.slice(2);
  if(!beforePath||!afterPath||!outputPath)throw new Error("usage: compare-moe-standard-guo <before> <after> <output>");
  const result=compareMoeStandardGuo(
    JSON.parse(readFileSync(beforePath,"utf8")) as Report,
    JSON.parse(readFileSync(afterPath,"utf8")) as Report,
  );
  writeFileSync(outputPath,JSON.stringify(result,null,2)+"\n","utf8");
  console.log(JSON.stringify(result,null,2));
}
