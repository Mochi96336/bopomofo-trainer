import { readFileSync,writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
interface Sentence {readonly seedIndex:number;readonly text:string|null;readonly root:string|null;readonly entryIds:readonly string[]}
interface Hit {readonly seedIndex:number;readonly text:string;readonly selectedEntryId:string;readonly selectedUpos:string|null}
interface Audit {
  readonly readingEligibilityPolicy:string;
  readonly sampleCount:number;
  readonly seedNamespace:string;
  readonly catalogEntryCount:number;
  readonly successfulSentences:number;
  readonly failedSentences:number;
  readonly sentences:readonly Sentence[];
  readonly hits:readonly Hit[];
}
const risks=[
  {word:"種",upos:"NOUN",id:catalogEntryId("種","ㄓㄨㄥ4")},
  {word:"給",upos:"VERB",id:catalogEntryId("給","ㄐㄧ3")},
] as const;
const riskHit=(h:Hit)=>risks.some(r=>
  h.text===r.word && h.selectedUpos===r.upos && h.selectedEntryId===r.id);
const targetHit=(h:Hit)=>h.text==="種"||h.text==="給";
const counts=(report:Audit)=>({
  "種":report.hits.filter(h=>h.text==="種").length,
  "給":report.hits.filter(h=>h.text==="給").length,
});
function confirmSource(report:Audit,policy:string,baseline:Audit) {
  if(report.readingEligibilityPolicy!==policy
    ||report.sampleCount!==2048
    ||report.seedNamespace!==baseline.seedNamespace
    ||report.catalogEntryCount!==baseline.catalogEntryCount
    ||report.successfulSentences!==2048
    ||report.failedSentences!==0
    ||report.sentences.length!==2048)
    throw new Error("cannot compare differing populations or unsuccessful generation: "+policy);
  for(let i=0;i<2048;i++){
    const row=report.sentences[i]!;
    if(row.seedIndex!==i||row.text===null)
      throw new Error("invalid seed index or failed sentence: "+policy);
  }
  for(const hit of report.hits){
    const row=report.sentences[hit.seedIndex];
    if(!row || !row.entryIds.includes(hit.selectedEntryId))
      throw new Error("hit is not backed by a selected exact catalog entry: "+policy);
  }
}
export function compareCandidatePreservation(
  baseline:Audit,ordinary:Audit,preserved:Audit,
) {
  confirmSource(baseline,"reviewed-roles",baseline);
  confirmSource(ordinary,"candidate-risk-abstention-trial",baseline);
  confirmSource(preserved,"candidate-risk-abstention-preserve-word-trial",baseline);
  const originalFlags=baseline.hits.filter(riskHit);
  if(originalFlags.length===0)throw new Error("missing targeted baseline exposures");
  if(ordinary.hits.some(riskHit)||preserved.hits.some(riskHit))
    throw new Error("candidate-risk rejection did not remove flagged identities");
  const flaggedSeeds=new Set(originalFlags.map(x=>x.seedIndex));
  const changes=(report:Audit)=>{
    const changed:number[]=[];
    for(let i=0;i<2048;i++){
      const a=baseline.sentences[i]!,b=report.sentences[i]!;
      if(a.text!==b.text||a.root!==b.root
        ||a.entryIds.join("|")!==b.entryIds.join("|"))changed.push(i);
    }
    const unrelated=changed.filter(x=>!flaggedSeeds.has(x));
    if(unrelated.length>0)
      throw new Error("reading trial changed unrelated seed: "+unrelated.slice(0,12).join(","));
    return changed;
  };
  const ordinaryChanged=changes(ordinary),preservedChanged=changes(preserved);
  const sameTargetWord=(report:Audit,seed:number,word:string)=>
    report.hits.some(x=>x.seedIndex===seed && x.text===word);
  const perSeed=originalFlags.map(flag=>{
    const seed=flag.seedIndex;
    const before=baseline.sentences[seed]!,old=ordinary.sentences[seed]!,
      rescue=preserved.sentences[seed]!;
    return {
      seedIndex:seed,
      targetWord:flag.text,
      originalReadingIdentity:flag.selectedEntryId,
      originalSentence:before.text,
      ordinarySentence:old.text,
      preservedSentence:rescue.text,
      ordinaryRetainedTargetWord:sameTargetWord(ordinary,seed,flag.text),
      preservedRetainedTargetWord:sameTargetWord(preserved,seed,flag.text),
      preservedOriginalWrittenSentence:before.text===rescue.text,
      preserveCandidateReadingIds:preserved.hits.filter(x=>
        x.seedIndex===seed && x.text===flag.text).map(x=>x.selectedEntryId),
      candidateCorrectnessHumanApproved:false,
      sentenceNaturalnessHumanApproved:false,
    };
  });
  const oldDropped=perSeed.filter(x=>!x.ordinaryRetainedTargetWord).length;
  const newDropped=perSeed.filter(x=>!x.preservedRetainedTargetWord).length;
  if(newDropped>0)
    throw new Error("same-word rescue still lost the target word in "+newDropped+" risk seeds");
  if(perSeed.length!==flaggedSeeds.size)
    throw new Error("multiple original risk hits in one seed need occurrence-aware review");
  return {
    schemaVersion:"candidate-risk-abstention-word-preservation-v1",
    samples:2048,
    originalFlaggedCandidates:originalFlags.length,
    ordinaryFlaggedCandidates:ordinary.hits.filter(riskHit).length,
    preservedFlaggedCandidates:preserved.hits.filter(riskHit).length,
    targetWordOccurrences:{
      baseline:counts(baseline),
      ordinary:counts(ordinary),
      preserveWord:counts(preserved),
    },
    affectedSeedCount:flaggedSeeds.size,
    ordinaryChangedSeedCount:ordinaryChanged.length,
    preserveWordChangedSeedCount:preservedChanged.length,
    unrelatedSeedCount:0,
    originalTargetWordDroppedByOrdinary:oldDropped,
    originalTargetWordDroppedByPreserveWord:newDropped,
    identicalWrittenSentenceWithPreserveWord:perSeed.filter(x=>x.preservedOriginalWrittenSentence).length,
    cases:perSeed,
    independentPronunciationErrorRate:null,
    verifiedExerciseNaturalness:null,
    permissionToDeploy:false,
    warning:"A correct spelling retained with a different reading is not proof of contextual pronunciation correctness; all sampled generated sentences still need semantic review.",
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const [source,ordinary,preserve,output]=process.argv.slice(2);
  if(!source||!ordinary||!preserve||!output)throw new Error("usage: tsx scripts/compare-candidate-preservation.ts <baseline> <ordinary-trial> <preserve-word-trial> <output>");
  const report=compareCandidatePreservation(
    JSON.parse(readFileSync(source,"utf8")) as Audit,
    JSON.parse(readFileSync(ordinary,"utf8")) as Audit,
    JSON.parse(readFileSync(preserve,"utf8")) as Audit,
  );
  writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    samples:report.samples,
    originalFlaggedCandidates:report.originalFlaggedCandidates,
    preservedFlaggedCandidates:report.preservedFlaggedCandidates,
    targetWordOccurrences:report.targetWordOccurrences,
    originalTargetWordDroppedByOrdinary:report.originalTargetWordDroppedByOrdinary,
    originalTargetWordDroppedByPreserveWord:report.originalTargetWordDroppedByPreserveWord,
    identicalWrittenSentenceWithPreserveWord:report.identicalWrittenSentenceWithPreserveWord,
    unrelatedSeedCount:report.unrelatedSeedCount,
    warning:report.warning,
  },null,2));
}
