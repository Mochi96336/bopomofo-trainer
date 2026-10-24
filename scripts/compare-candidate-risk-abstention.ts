import { readFileSync,writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
interface Sentence {
  readonly seedIndex:number; readonly text:string|null;
  readonly entryIds:readonly string[]; readonly root:string|null;
}
interface Hit {
  readonly seedIndex:number; readonly text:string;
  readonly selectedUpos:string|null; readonly selectedEntryId:string;
}
interface Audit {
  readonly readingEligibilityPolicy:string;
  readonly seedNamespace:string; readonly sampleCount:number;
  readonly catalogEntryCount:number; readonly failedSentences:number;
  readonly successfulSentences:number;
  readonly sentences:readonly Sentence[]; readonly hits:readonly Hit[];
}
const SUSPECTS=[
  {text:"種",upos:"NOUN",entryId:catalogEntryId("種","ㄓㄨㄥ4")},
  {text:"給",upos:"VERB",entryId:catalogEntryId("給","ㄐㄧ3")},
] as const;
export function compareRiskAbstentionGenerations(base:Audit,trial:Audit){
  if(base.readingEligibilityPolicy!=="reviewed-roles"
    ||trial.readingEligibilityPolicy!=="candidate-risk-abstention-trial"
    ||base.seedNamespace!==trial.seedNamespace
    ||base.sampleCount!==2048||trial.sampleCount!==2048
    ||base.catalogEntryCount!==trial.catalogEntryCount
    ||base.sentences.length!==2048||trial.sentences.length!==2048)
    throw new Error("non-comparable 2048-seed populations or policies");
  if(base.failedSentences!==0||trial.failedSentences!==0
    ||base.successfulSentences!==2048||trial.successfulSentences!==2048)
    throw new Error("experimental candidate risk abstention cannot introduce generation failure");
  const matches=(hit:Hit)=>SUSPECTS.some(s=>
    hit.text===s.text&&hit.selectedUpos===s.upos&&hit.selectedEntryId===s.entryId);
  const prior=base.hits.filter(matches),after=trial.hits.filter(matches);
  if(prior.length===0)throw new Error("trial did not exercise observed risk signatures");
  if(after.length!==0)throw new Error("trial retained disallowed candidate identity");
  const affected=new Set(prior.map(x=>x.seedIndex));
  const changed:number[]=[];
  for(let i=0;i<2048;i++){
    const x=base.sentences[i]!,y=trial.sentences[i]!;
    if(x.seedIndex!==i||y.seedIndex!==i)throw new Error("noncanonical seed ordering");
    if(x.text!==y.text||x.root!==y.root
      ||x.entryIds.join("|")!==y.entryIds.join("|"))changed.push(i);
  }
  const unrelated=changed.filter(seed=>!affected.has(seed));
  if(unrelated.length>0)
    throw new Error("trial drifted unrelated seed outputs: "+unrelated.slice(0,20).join(","));
  return {
    schemaVersion:"candidate-risk-abstention-generated-comparison-v1",
    sampleCount:2048,
    affectedSeedCount:affected.size,
    flaggedOriginalOccurrences:prior.length,
    flaggedTrialOccurrences:after.length,
    changedSeedCount:changed.length,
    unrelatedSeedCount:unrelated.length,
    originalRiskCounts:SUSPECTS.map(s=>({
      text:s.text,upos:s.upos,
      originalOccurrences:prior.filter(x=>x.text===s.text).length,
      trialOccurrences:0,
    })),
    knownFalsePositiveBoundary:"種/VERB is never restricted; source GSD train-s3887#2 is biological species mislabelled VERB.",
    independentHeldoutReadingAccuracy:null,
    generatedSentenceNaturalness:null,
    productionApproved:false,
    note:"The 2048-seed comparison quantifies risky selected IDs only. An unreviewed UPOS restriction can remove legitimate readings; candidate absence is NOT lower verified error rate.",
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const [a,b,out]=process.argv.slice(2);
  if(!a||!b||!out)throw new Error("usage: tsx scripts/compare-candidate-risk-abstention.ts <shipping.json> <trial.json> <out.json>");
  const result=compareRiskAbstentionGenerations(
    JSON.parse(readFileSync(a,"utf8")) as Audit,
    JSON.parse(readFileSync(b,"utf8")) as Audit,
  );
  writeFileSync(out,JSON.stringify(result,null,2)+"\n","utf8");
  console.log(JSON.stringify(result,null,2));
}
