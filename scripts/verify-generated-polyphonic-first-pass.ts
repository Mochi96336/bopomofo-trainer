import { mkdirSync,readFileSync,writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export type NaturalnessStatus =
  | "incoherent-lexical-sequence"
  | "incomplete-clause"
  | "context-needed";
export interface FirstPassNaturalnessRow {
  readonly seedIndex:number;
  readonly sentence:string;
  readonly provisionalNaturalnessStatus:NaturalnessStatus;
  readonly reason:string;
  readonly reviewStatus:"first-pass-provisional";
  readonly readingContextReviewStatus:"unreviewed";
  readonly suitableAsStandalonePracticeItem:false;
}
export interface FirstPassNaturalnessReview {
  readonly schemaVersion:string;
  readonly fromSeedNamespace:string;
  readonly independentSecondReviewComplete:boolean;
  readonly eligibleAsPronunciationGold:boolean;
  readonly eligibleAsValidatedNaturalnessBenchmark:boolean;
  readonly productionActivationAllowed:boolean;
  readonly provisionalOnly:boolean;
  readonly rows:readonly FirstPassNaturalnessRow[];
}
export interface GeneratedTargetHit {
  readonly seedIndex:number;
  readonly sentence:string;
  readonly originalWrittenToken:string;
  readonly predeclaredRiskFlag:boolean;
}
export interface GeneratedTargetRiskReport {
  readonly schemaVersion:string;
  readonly shippingReadingEligibilityPolicy:string;
  readonly sampleCount:number;
  readonly allTargetHits:readonly GeneratedTargetHit[];
  readonly unreviewedGeneratedTargetCount:number;
  readonly totalShippingFlaggedHits:number;
  readonly riskRows:readonly {readonly shippingHits:number}[];
}
export function verifyGeneratedFirstPassNaturalness(
  generated:GeneratedTargetRiskReport,
  review:FirstPassNaturalnessReview,
) {
  if(generated.schemaVersion!=="generated-attested-polyphonic-risk-v1"
    ||generated.shippingReadingEligibilityPolicy!=="reviewed-roles"
    ||generated.sampleCount!==2048)
    throw new Error("not the pinned product-family reviewed-roles composer population");
  if(review.schemaVersion!=="generated-polyphonic-first-pass-naturalness-v1"
    ||review.fromSeedNamespace!=="formal-syntax-v2-phase1-product-baseline-v1")
    throw new Error("not the reviewed fixed-seed first-pass population");
  if(review.independentSecondReviewComplete || review.eligibleAsPronunciationGold
    ||review.eligibleAsValidatedNaturalnessBenchmark
    ||review.productionActivationAllowed || !review.provisionalOnly)
    throw new Error("unverified first-pass scores cannot be promoted to production or gold");
  if(generated.allTargetHits.length!==generated.unreviewedGeneratedTargetCount
    ||generated.totalShippingFlaggedHits!==generated.riskRows
      .reduce((sum,row)=>sum+row.shippingHits,0))
    throw new Error("inconsistent generated target universe or risk counts");
  // Same seed may contain two target occurrences, so join by seed AND full text;
  // in the current 30 occurrences none repeats the same seed+sentence. Fail
  // explicitly if this ceases to be true rather than silently dropping a row.
  const key=(seed:number,sentence:string)=>JSON.stringify([seed,sentence]);
  const source=new Map<string,GeneratedTargetHit>();
  for(const hit of generated.allTargetHits){
    if(hit.originalWrittenToken!=="種"&&hit.originalWrittenToken!=="給")
      throw new Error("non-target generated candidate");
    const k=key(hit.seedIndex,hit.sentence);
    if(source.has(k))throw new Error("duplicate seed/sentence requires explicit occurrence ID");
    source.set(k,hit);
  }
  if(source.size!==review.rows.length)
    throw new Error("not all source-generated 種/給 utterances have first-pass review");
  const categories:Record<string,number>={};
  const seen=new Set<string>();
  let flagged=0;
  for(const row of review.rows){
    const k=key(row.seedIndex,row.sentence);
    if(seen.has(k))throw new Error("duplicate first-pass reviewed sentence");
    seen.add(k);
    const original=source.get(k);
    if(original===undefined)throw new Error("fabricated/changed generated source sentence");
    if(!row.reason.trim()||row.reviewStatus!=="first-pass-provisional"
      ||row.readingContextReviewStatus!=="unreviewed"
      ||row.suitableAsStandalonePracticeItem!==false)
      throw new Error("missing review rationale or attempted approval");
    if(!["incoherent-lexical-sequence","incomplete-clause","context-needed"]
      .includes(row.provisionalNaturalnessStatus))
      throw new Error("unsupported qualitative review category");
    categories[row.provisionalNaturalnessStatus]=
      (categories[row.provisionalNaturalnessStatus]??0)+1;
    flagged+=Number(original.predeclaredRiskFlag);
  }
  if(flagged!==generated.totalShippingFlaggedHits)
    throw new Error("first-pass review does not cover flagged and control cases equally");
  return {
    schemaVersion:"generated-polyphonic-first-pass-review-verification-v1",
    originalGeneratedTargetCount:source.size,
    originalFlaggedTargetCount:flagged,
    reviewedCount:review.rows.length,
    firstPassQualitativeCounts:categories,
    independentlyApprovedNaturalnessCount:0,
    independentlyApprovedCorrectReadingCount:0,
    note:"Human first-pass qualitative evidence for a biased 30-target-word sample, NOT product-wide naturalness accuracy, pronunciation gold or production eligibility.",
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const [source,reviewFile,out]=process.argv.slice(2);
  if(!source||!reviewFile||!out)
    throw new Error("usage: tsx scripts/verify-generated-polyphonic-first-pass.ts <generated-risk.json> <review.json> <output.json>");
  const result=verifyGeneratedFirstPassNaturalness(
    JSON.parse(readFileSync(source,"utf8")) as GeneratedTargetRiskReport,
    JSON.parse(readFileSync(reviewFile,"utf8")) as FirstPassNaturalnessReview,
  );
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(result,null,2)+"\n","utf8");
  console.log(JSON.stringify(result,null,2));
}
