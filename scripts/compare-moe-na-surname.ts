import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import { NA_SURNAME_FIRST_TONE_ID } from "../src/readings/moe-na-surname-role.js";

interface Sentence { readonly seedIndex:number; readonly text:string|null; readonly root:string|null; readonly entryIds:readonly string[] }
interface Hit { readonly seedIndex:number; readonly text:string; readonly selectedEntryId:string; readonly selectedUpos:string }
interface Report {
  readonly readingEligibilityPolicy:string;
  readonly seedNamespace:string;
  readonly catalogEntryCount:number;
  readonly sampleCount:number;
  readonly successfulSentences:number;
  readonly failedSentences:number;
  readonly sentences:readonly Sentence[];
  readonly hits:readonly Hit[];
}
/** Frozen #445 final-product selected "surname 那" in PRON/ADV slots. */
export const FROZEN_BAD_NA_SURNAME_SEEDS = [
  72,78,99,203,211,248,284,342,393,463,506,641,691,799,834,844,856,
  938,958,960,1019,1027,1044,1089,1118,1181,1292,1331,1367,1715,1789,1887,2035,
] as const;

function wrongRole(hit:Hit):boolean {
  return hit.selectedEntryId===NA_SURNAME_FIRST_TONE_ID
    && (hit.selectedUpos==="PRON" || hit.selectedUpos==="ADV");
}

export function compareMoeNaSurname(before:Report,after:Report){
  if(before.readingEligibilityPolicy!=="standard-guo-trial"
    || after.readingEligibilityPolicy!=="standard-na-surname-trial"
    || before.seedNamespace!==after.seedNamespace
    || before.catalogEntryCount!==after.catalogEntryCount
    || before.sampleCount!==2048 || after.sampleCount!==2048
    || before.sentences.length!==2048 || after.sentences.length!==2048
    || before.failedSentences!==0 || after.failedSentences!==0
    || before.successfulSentences!==2048 || after.successfulSentences!==2048
    || !Array.isArray(before.hits) || !Array.isArray(after.hits)) {
    throw new Error("surname role comparison requires frozen 2048 #445 final product seeds");
  }
  const badHits=before.hits.filter(wrongRole);
  const badSeeds=[...new Set(badHits.map(hit=>hit.seedIndex))].sort((a,b)=>a-b);
  if(badHits.length!==33
    || JSON.stringify(badSeeds)!==JSON.stringify(FROZEN_BAD_NA_SURNAME_SEEDS)){
    throw new Error("original Na surname-in-PRON/ADV exposure changed: re-review frozen evidence");
  }
  if(after.hits.some(wrongRole)){
    throw new Error("surname-only 那/ㄋㄚ1 still selected as PRON/ADV");
  }
  const changedSeeds:number[]=[];
  const changedDetails:Array<{seedIndex:number;slot:number;priorId:string;newId:string}>=[];
  for(let i=0;i<2048;i++){
    const left=before.sentences[i],right=after.sentences[i];
    if(!left||!right||left.seedIndex!==i||right.seedIndex!==i
      ||left.root!==right.root ||left.entryIds.length!==right.entryIds.length){
      throw new Error("seed alignment, syntax root or lexical shape drift at "+i);
    }
    const originallyBad=FROZEN_BAD_NA_SURNAME_SEEDS.includes(i as typeof FROZEN_BAD_NA_SURNAME_SEEDS[number]);
    const changed=left.entryIds.flatMap((id,slot)=>id===right.entryIds[slot]?[]:[slot]);
    if(!originallyBad && changed.length>0)throw new Error("unrelated seed changed at "+i);
    if(changed.length===0 && left.text!==right.text)throw new Error("unexplained text drift at "+i);
    if(originallyBad && (changed.length!==1
      || left.entryIds[changed[0]!]!==NA_SURNAME_FIRST_TONE_ID)){
      throw new Error("changed wrong lexical slot or failed to repair surname role at "+i);
    }
    if(changed.length>0){
      const slot=changed[0]!;
      changedSeeds.push(i);
      changedDetails.push({seedIndex:i,slot,priorId:left.entryIds[slot]!,newId:right.entryIds[slot]!});
    }
  }
  if(JSON.stringify(changedSeeds)!==JSON.stringify(FROZEN_BAD_NA_SURNAME_SEEDS)){
    throw new Error("changed seeds differ from actual invalid surname role selections");
  }
  // Check final learner identities, not just whether the original target vanished.
  const knownUnsupported=[
    catalogEntryId("比","ㄅㄧ1"),
    catalogEntryId("了","ㄌㄧㄠ4"),
    catalogEntryId("得","ㄉㄜ4"),
    catalogEntryId("於","ㄩ1"),
    catalogEntryId("南","ㄋㄚ1"),
    catalogEntryId("行","ㄏㄥ2"),
    catalogEntryId("過","ㄍㄨㄛ5"),
  ];
  for(const sentence of after.sentences){
    if(sentence.entryIds.some(id=>knownUnsupported.includes(id))){
      throw new Error("final learner output retains a previously confirmed invalid reading at "+sentence.seedIndex);
    }
  }
  return {
    schemaVersion:"moe-na-surname-role-paired-diff-v1",sampleCount:2048,
    wronglyUsedSurnameBefore:badHits.length,wronglyUsedSurnameAfter:0,
    badSeeds,changedSeeds,changedOutsideOriginallyInvalidSlot:0,changedDetails,
    caveat:"This rejects only surname-tone 那 in PRON/ADV syntactic roles, not the legal surname or other MOE-attested Na readings.",
  };
}
if(process.argv[1]?.endsWith("compare-moe-na-surname.ts")){
  const [beforePath,afterPath,outputPath]=process.argv.slice(2);
  if(!beforePath||!afterPath||!outputPath)throw new Error("usage: compare-moe-na-surname <before> <after> <output>");
  const result=compareMoeNaSurname(
    JSON.parse(readFileSync(beforePath,"utf8")) as Report,
    JSON.parse(readFileSync(afterPath,"utf8")) as Report,
  );
  writeFileSync(outputPath,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
