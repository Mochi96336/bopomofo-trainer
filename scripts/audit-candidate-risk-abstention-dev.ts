import { mkdirSync,readFileSync,writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE_CATALOG,SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { experimentalRiskAbstentionEligible } from "../src/readings/experimental-risk-abstention.js";
import {
  inferExistingReadingFrontier,type DiagnosticLexicon,type BlindInference,
} from "./audit-attested-gold-blind-reading.js";
import {
  reviewedTargetTokens,validateAttestedBank,type ContextBank,
} from "./prototype-attested-reading-selector.js";

type Outcome =
  | "unique-correct"
  | "unique-wrong"
  | "ambiguous-contains-gold"
  | "ambiguous-excludes-gold"
  | "no-candidate";
function classify(frontier:BlindInference,gold:readonly string[]):Outcome {
  const contains=frontier.distinctTargetPronunciations.some(x=>
    x.targetTokens.length===gold.length
    && x.targetTokens.every((t,i)=>t===gold[i]));
  if(frontier.frontierStatus==="one-pronunciation")
    return contains ? "unique-correct":"unique-wrong";
  if(frontier.frontierStatus==="multiple-pronunciations")
    return contains ? "ambiguous-contains-gold":"ambiguous-excludes-gold";
  return "no-candidate";
}

export function auditCandidateRiskAbstentionOnDev(
  bank:ContextBank,
  catalog:DiagnosticLexicon={entries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES},
) {
  validateAttestedBank(bank);
  const rows=bank.cases.map(row=>{
    const input={
      word:row.sourceTokenText,sourceUpos:row.sourceTokenUpos,
      targetOffset:row.characterOffsetInToken,
    };
    // Both candidate sets are selected without consulting MOE gold.
    const baseline=inferExistingReadingFrontier(input,catalog);
    const trial=inferExistingReadingFrontier(input,catalog,experimentalRiskAbstentionEligible);
    const before=baseline.distinctTargetPronunciations.map(r=>r.targetTokens.join("|"));
    const after=trial.distinctTargetPronunciations.map(r=>r.targetTokens.join("|"));
    const changed=JSON.stringify(before)!==JSON.stringify(after);
    if(changed && !(row.sourceTokenText==="種" && row.sourceTokenUpos==="NOUN")
      && !(row.sourceTokenText==="給" && row.sourceTokenUpos==="VERB"))
      throw new Error("candidate-risk trial changed an unrelated original source: "+row.id);
    // AFTER the prediction: classify against previously reviewed MOE target.
    const gold=reviewedTargetTokens(row.reviewedCharacterZhuyin);
    return {
      id:row.id,word:row.sourceTokenText,originalSourceUpos:row.sourceTokenUpos,
      changed,baselineReadings:before,trialReadings:after,
      baselineOutcome:classify(baseline,gold),trialOutcome:classify(trial,gold),
      usedReviewedGoldOnlyForScoring:true,
    };
  });
  const score=(key:"baselineOutcome"|"trialOutcome")=>Object.fromEntries(
    [...new Set(rows.map(x=>x[key]))].sort().map(s=>[
      s,rows.filter(x=>x[key]===s).length,
    ]));
  return {
    schemaVersion:"candidate-risk-abstention-attested-dev-exploratory-v1",
    sourceBlob:bank.source.blobSha,
    sampleCount:rows.length,
    sourceWasAlreadyInspected:true,
    independentHeldout:false,
    rawUDUposIsOracleAndSometimesIncorrect:true,
    labelsEnteredCandidateSelection:false,
    productionEnabled:false,
    resultsCannotBeClaimedAsAccuracy:true,
    baselineStatusCounts:score("baselineOutcome"),
    trialStatusCounts:score("trialOutcome"),
    changedCases:rows.filter(x=>x.changed),
    sourcePOSFailureBoundary:"Retain BOTH readings for 種/VERB: pinned train-s3887#2 is nominal species tagged VERB.",
    rows,
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const input=process.argv[2]??"research/attested-reading-pilot/cases.json";
  const output=process.argv[3]??"data/generated/candidate-risk-abstention-dev-exploratory.json";
  const data=auditCandidateRiskAbstentionOnDev(
    JSON.parse(readFileSync(input,"utf8")) as ContextBank);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(data,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    sampleCount:data.sampleCount,baseline:data.baselineStatusCounts,
    trial:data.trialStatusCounts,changed:data.changedCases.map(x=>x.id),
    independentHeldout:data.independentHeldout,
    productionEnabled:data.productionEnabled,
  },null,2));
}
