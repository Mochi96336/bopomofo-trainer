import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";

export interface GeneratedHit {
  readonly seedIndex: number;
  readonly text:string;
  readonly sentence:string;
  readonly selectedEntryId:string;
  readonly selectedUpos:string|null;
  readonly entryIndex:number;
  readonly previousEntryText:string|null;
  readonly nextEntryText:string|null;
}
export interface GeneratedSeed {
  readonly seedIndex:number;
  readonly text:string|null;
  readonly entryIds:readonly string[];
}
export interface GeneratedReport {
  readonly readingEligibilityPolicy:string;
  readonly sampleCount:number;
  readonly successfulSentences:number;
  readonly failedSentences:number;
  readonly seedNamespace:string;
  readonly hits:readonly GeneratedHit[];
  readonly sentences:readonly GeneratedSeed[];
}
export interface GeneratedRiskDefinition {
  readonly writtenForm:string;
  readonly originalSourceUpos:string;
  readonly selectedReadingIdentity:string;
  readonly riskDescription:string;
}
export const PREDECLARED_RISK_FLAGS:readonly GeneratedRiskDefinition[]=[
  {
    writtenForm:"種",originalSourceUpos:"NOUN",
    selectedReadingIdentity:catalogEntryId("種","ㄓㄨㄥ4"),
    riskDescription:"noun profile inherited from surface-form UD projection despite fourth-tone planting-verb identity",
  },
  {
    writtenForm:"給",originalSourceUpos:"VERB",
    selectedReadingIdentity:catalogEntryId("給","ㄐㄧ3"),
    riskDescription:"standalone verb uses third-tone ji reading commonly associated with other lexical/register functions",
  },
];

/** This is an exposure audit, NOT a phonetic accuracy/error classifier.
 * Source UD UPOS and programmatically generated sentences are NOT independent sense gold.
 * Given a review without a separate reviewed lexical sense, candidate selection must
 * remain risk/unknown rather than being silently credited as correct or wrong.
 */
export function auditGeneratedReadingRisk(
  shipping:GeneratedReport,
  trial:GeneratedReport,
  riskFlags:readonly GeneratedRiskDefinition[]=PREDECLARED_RISK_FLAGS,
){
  if(shipping.readingEligibilityPolicy!=="reviewed-roles"
    ||trial.readingEligibilityPolicy!=="zhong-role-trial")
    throw new Error("must compare shipping reviewed roles to opt-in 種 role trial");
  if(shipping.sampleCount!==2048||trial.sampleCount!==shipping.sampleCount
    ||shipping.seedNamespace!==trial.seedNamespace
    ||shipping.sentences.length!==shipping.sampleCount
    ||trial.sentences.length!==trial.sampleCount)
    throw new Error("pinned 2048-seed populations must match");
  if(shipping.failedSentences!==0||trial.failedSentences!==0
    ||shipping.successfulSentences!==2048||trial.successfulSentences!==2048)
    throw new Error("generation failures make the exposure comparison incomplete");
  const seen=new Set<string>();
  for(const definition of riskFlags){
    const id=definition.writtenForm+"/"+definition.originalSourceUpos+"/"+definition.selectedReadingIdentity;
    if(seen.has(id))throw new Error("duplicate risk flag");
    seen.add(id);
  }
  const validHits=(report:GeneratedReport)=>{
    for(let i=0;i<report.sampleCount;i++){
      if(report.sentences[i]?.seedIndex!==i)
        throw new Error("noncanonical seed order");
    }
    for(const h of report.hits){
      const seed=report.sentences[h.seedIndex];
      if(!seed||seed.text!==h.sentence||seed.entryIds[h.entryIndex]!==h.selectedEntryId)
        throw new Error("generated risk hit not joined to its exact selected entry and seed");
    }
  };
  validHits(shipping);validHits(trial);
  const match=(h:GeneratedHit,d:GeneratedRiskDefinition)=>
    h.text===d.writtenForm && h.selectedUpos===d.originalSourceUpos
      && h.selectedEntryId===d.selectedReadingIdentity;
  const riskRows=riskFlags.map(definition=>{
    const original=shipping.hits.filter(h=>match(h,definition));
    const experimental=trial.hits.filter(h=>match(h,definition));
    return {
      ...definition,
      shippingHits:original.length,
      trialHits:experimental.length,
      shippingExamples:original.map(h=>({
        seedIndex:h.seedIndex,
        sentence:h.sentence,
        word:h.text,
        wordEntryId:h.selectedEntryId,
        sourceUpos:h.selectedUpos,
        previousWord:h.previousEntryText,
        nextWord:h.nextEntryText,
      })),
      trialExamples:experimental.map(h=>({
        seedIndex:h.seedIndex,sentence:h.sentence,
        wordEntryId:h.selectedEntryId,
      })),
      reviewedWrongReadingCount:null,
      contextReadingVerified:false,
    };
  });
  return {
    schemaVersion:"generated-attested-polyphonic-risk-v1",
    source:"2048 predeclared deterministic formal syntax composer seeds, not real-user utterances",
    shippingReadingEligibilityPolicy:shipping.readingEligibilityPolicy,
    optInTrialPolicy:trial.readingEligibilityPolicy,
    goldOrHumanAccuracyAvailable:false,
    countsAreExposureNotError:true,
    sampleCount:shipping.sampleCount,
    riskRows,
    totalShippingFlaggedHits:riskRows.reduce((sum,row)=>sum+row.shippingHits,0),
    totalTrialFlaggedHits:riskRows.reduce((sum,row)=>sum+row.trialHits,0),
    noOutputSentenceReviewedForNaturalness:true,
    warning:"Changing a generated reading after a POS gate is not proof of correctness; garbage context makes full-sentence reading judgements unreliable. This report must never be interpreted as human-validated wrong-pronunciation rate.",
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const [baselinePath,trialPath,output]=process.argv.slice(2);
  if(!baselinePath||!trialPath||!output)
    throw new Error("usage: tsx scripts/audit-generated-polyphonic-risk.ts <reviewed-roles.json> <zhong-trial.json> <report.json>");
  const data=auditGeneratedReadingRisk(
    JSON.parse(readFileSync(baselinePath,"utf8")) as GeneratedReport,
    JSON.parse(readFileSync(trialPath,"utf8")) as GeneratedReport,
  );
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(data,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    sampleCount:data.sampleCount,
    riskRows:data.riskRows.map(x=>({
      writtenForm:x.writtenForm,sourceUpos:x.originalSourceUpos,
      readingIdentity:x.selectedReadingIdentity,
      shippingHits:x.shippingHits,trialHits:x.trialHits,
      reviewedWrongReadingCount:x.reviewedWrongReadingCount,
    })),
    totalShippingFlaggedHits:data.totalShippingFlaggedHits,
    warning:data.warning,
  },null,2));
}
