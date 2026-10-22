import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { reviewedZhongRolePilotEligible } from "../src/readings/zhong-role-pilot.js";
import {
  inferExistingReadingFrontier, type DiagnosticLexicon,
} from "./audit-attested-gold-blind-reading.js";
import { PINNED_GSD_BLOBS } from "./mine-attested-standalone-contexts.js";
import { reviewedTargetTokens } from "./prototype-attested-reading-selector.js";
import type { ReviewCandidate, ReviewQueue } from "./sample-attested-review-queue.js";

interface SourceBoundQueue extends ReviewQueue {
  readonly sourceBlobs: { readonly train: string };
  readonly groupCounts: { readonly train: Readonly<Record<string,number>> };
}
const EXPECTED_SOURCE = {
  sentenceId:"train-s3887",
  tokenId:2,
  word:"種",
  upos:"VERB",
  context:"有些種的花是兩性同花的",
  previousWord:"有些",
  nextWord:"的",
} as const;
const DICTIONARY_NOMINAL_SPECIES =
  "https://dict.concised.moe.edu.tw/dictView.jsp?ID=31268";
const DICTIONARY_PLANTING_ACTION =
  "https://dict.concised.moe.edu.tw/dictView.jsp?ID=31340";

export function auditZhongSourcePosRisk(
  queue: SourceBoundQueue,
  catalog: DiagnosticLexicon,
) {
  if(queue.sourceBlobs.train!==PINNED_GSD_BLOBS.train)
    throw new Error("source-blind train queue does not match pinned CoNLL-U Git blob");
  if(queue.trainReviewCandidates.length!==queue.trainQueueSize)
    throw new Error("queue must contain its full train candidates");
  const groupCounts: Record<string,number>={};
  for(const item of queue.trainReviewCandidates){
    if(item.split!=="train"||item.reviewStatus!=="unlabeled")
      throw new Error("reviewed or held-out samples cannot be treated as raw train");
    const k=item.word+"/"+item.corpusUpos;
    groupCounts[k]=(groupCounts[k]??0)+1;
  }
  for(const [k,n] of Object.entries(queue.groupCounts.train)){
    if(groupCounts[k]!==n)throw new Error("source train group-count mismatch for "+k);
  }
  if(Object.keys(groupCounts).length!==Object.keys(queue.groupCounts.train).length)
    throw new Error("unexpected new group");
  // Evaluate only distinct written-form/UPOS keys once: all occurrences
  // in a group share the exact same source metadata supplied to this audit.
  // No reading labels or sentence content may enter the candidate frontier.
  const groupFrontiers=Object.entries(groupCounts).sort(([a],[b])=>a.localeCompare(b))
    .map(([group,occurrences])=>{
      const exemplar=queue.trainReviewCandidates.find(row=>
        row.word+"/"+row.corpusUpos===group)!;
      const input={word:exemplar.word,sourceUpos:exemplar.corpusUpos,targetOffset:0};
      const shipping=inferExistingReadingFrontier(input,catalog);
      const optIn=inferExistingReadingFrontier(input,catalog,reviewedZhongRolePilotEligible);
      const readings=(frontier:typeof shipping)=>frontier.distinctTargetPronunciations
        .map(alt=>alt.targetTokens.join("|"));
      return {
        group,occurrences,
        shippingStatus:shipping.frontierStatus,
        optInStatus:optIn.frontierStatus,
        shippingCandidateReadings:readings(shipping),
        optInCandidateReadings:readings(optIn),
        approvedCorrectReadingCount:0,
      };
    });
  const occurrenceTotals={
    shippingUnique:groupFrontiers.filter(x=>x.shippingStatus==="one-pronunciation")
      .reduce((n,g)=>n+g.occurrences,0),
    shippingAmbiguous:groupFrontiers.filter(x=>x.shippingStatus==="multiple-pronunciations")
      .reduce((n,g)=>n+g.occurrences,0),
    trialUnique:groupFrontiers.filter(x=>x.optInStatus==="one-pronunciation")
      .reduce((n,g)=>n+g.occurrences,0),
    trialAmbiguous:groupFrontiers.filter(x=>x.optInStatus==="multiple-pronunciations")
      .reduce((n,g)=>n+g.occurrences,0),
    trainCasesWithIndependentlyApprovedReading:0,
  };
  // Being uniquely selected under a supplied and potentially incorrect UPOS
  // is a candidate-set statistic; it cannot be counted as correct pronunciation.
  const unhandled=queue.trainQueueSize - occurrenceTotals.shippingUnique
    - occurrenceTotals.shippingAmbiguous;
  const trialUnhandled=queue.trainQueueSize - occurrenceTotals.trialUnique
    - occurrenceTotals.trialAmbiguous;
  if(unhandled<0||trialUnhandled<0)throw new Error("frontier occurrence totals overflow");
  const suspects=queue.trainReviewCandidates.filter(row=>
    row.word==="種" && (row.corpusUpos==="PART"||row.corpusUpos==="VERB"));
  const nounContextTags=suspects.map(row=>({
    id:row.sentenceId+"#"+row.tokenId,
    rawUpos:row.corpusUpos,
    sentence:row.originalSentence,
    contextualCue:row.corpusUpos==="VERB" ? "species-of-flower nominal context"
      : "taxonomic kind/species compound",
    uposReview:"suspected-source-pos-error" as const,
    annotatedReading:"unlabeled" as const,
    independentlySecondReviewed:false,
  }));
  const candidate=queue.trainReviewCandidates.filter(row=>
    row.sentenceId===EXPECTED_SOURCE.sentenceId
    && row.tokenId===EXPECTED_SOURCE.tokenId);
  if(candidate.length!==1)throw new Error("missing/duplicate predeclared counterexample");
  const item:ReviewCandidate=candidate[0]!;
  if(item.word!==EXPECTED_SOURCE.word||item.corpusUpos!==EXPECTED_SOURCE.upos
    ||!item.originalSentence.includes(EXPECTED_SOURCE.context)
    ||item.previousWord!==EXPECTED_SOURCE.previousWord
    ||item.nextWord!==EXPECTED_SOURCE.nextWord)
    throw new Error("counterexample identity/context differs from pinned source");
  const input={word:item.word,sourceUpos:item.corpusUpos,targetOffset:0};
  const baseline=inferExistingReadingFrontier(input,catalog);
  const roleTrial=inferExistingReadingFrontier(input,catalog,reviewedZhongRolePilotEligible);
  // Only AFTER both frontiers are fixed, compare to a provisional human
  // lexical-sense interpretation backed by the MOE dictionary definition.
  const provisionalNominalReading=reviewedTargetTokens("ㄓㄨㄥˇ");
  const matches=(frontier:typeof baseline)=>frontier.distinctTargetPronunciations.some(x=>
    x.targetTokens.length===provisionalNominalReading.length
    && x.targetTokens.every((t,i)=>t===provisionalNominalReading[i]));
  const baselineContainsProvisionalNominalReading=matches(baseline);
  const roleTrialContainsProvisionalNominalReading=matches(roleTrial);
  const report={
    schemaVersion:"attested-zhong-pos-counterexample-v1",
    originalTrainBlobSha:queue.sourceBlobs.train,
    trainQueueSize:queue.trainQueueSize,
    sourceGroups:groupCounts,
    groupFrontiers,
    occurrenceTotals,
    suspectedSourcePosRows:nounContextTags,
    sourceSenseGoldApproval:"provisional-human-interpretation-only",
    independentSecondReviewComplete:false,
    dictionaryNominalSpeciesUrl:DICTIONARY_NOMINAL_SPECIES,
    dictionaryPlantingActionUrl:DICTIONARY_PLANTING_ACTION,
    counterexample:{
      id:item.sentenceId+"#"+item.tokenId,
      originalSentence:item.originalSentence,
      sourceUpos:item.corpusUpos,
      sourceWord:item.word,
      provisionalSense:"species-noun-not-planting-verb",
      provisionalReading:"ㄓㄨㄥˇ",
      baselineStatus:baseline.frontierStatus,
      roleTrialStatus:roleTrial.frontierStatus,
      baselineReadings:baseline.distinctTargetPronunciations.map(r=>r.targetTokens),
      roleTrialReadings:roleTrial.distinctTargetPronunciations.map(r=>r.targetTokens),
      baselineContainsProvisionalNominalReading,
      roleTrialContainsProvisionalNominalReading,
      uniqueWrongIfProvisionalSenseConfirmed:
        roleTrial.frontierStatus==="one-pronunciation"
        && !roleTrialContainsProvisionalNominalReading,
    },
    guardrail:"Do not ship 種/VERB=>ㄓㄨㄥˋ from raw GSD UPOS; this is an explicitly provisional train-split counterexample, not a scored blind test.",
  };
  return report;
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const queuePath=process.argv[2]??"data/generated/attested-standalone-unlabeled-train-queue.json";
  const output=process.argv[3]??"data/generated/attested-zhong-pos-counterexample.json";
  const queue=JSON.parse(readFileSync(queuePath,"utf8")) as SourceBoundQueue;
  const report=auditZhongSourcePosRisk(queue,{
    entries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES,
  });
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    sourceGroups:report.sourceGroups,
    groupFrontiers:report.groupFrontiers,
    occurrenceTotals:report.occurrenceTotals,
    suspectedPosCases:report.suspectedSourcePosRows.length,
    counterexample:report.counterexample,
    independentSecondReviewComplete:false,
    guardrail:report.guardrail,
  },null,2));
}
