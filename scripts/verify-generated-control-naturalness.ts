import { createHash } from "node:crypto";
import { mkdirSync,readFileSync,writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface SourceSentence {
  readonly seedIndex:number;
  readonly text:string|null;
}
export interface ControlSource {
  readonly readingEligibilityPolicy:string;
  readonly sampleCount:number;
  readonly seedNamespace:string;
  readonly sentences:readonly SourceSentence[];
}
export interface ControlReviewRow {
  readonly seedIndex:number;
  readonly sentence:string;
  readonly provisionalNaturalnessStatus:string;
  readonly reason:string;
  readonly reviewStatus:string;
  readonly readingStatus:string;
}
export interface ControlReview {
  readonly schemaVersion:string;
  readonly samplingCodeVersion:string;
  readonly seedNamespace:string;
  readonly independentSecondReviewComplete:boolean;
  readonly eligibleAsNaturalnessBenchmark:boolean;
  readonly eligibleAsReadingGold:boolean;
  readonly productionActivationAllowed:boolean;
  readonly rows:readonly ControlReviewRow[];
}
const EXPECTED_NAMESPACE="formal-syntax-v2-phase1-product-baseline-v1";
const N=30;
export function getFixedNonPolyphonicControlSample(
  sentences:readonly SourceSentence[],n=N,
):readonly SourceSentence[]{
  if(!Number.isInteger(n)||n<1)throw new Error("invalid control count");
  const candidates=sentences.filter(x=>x.text!==null
    && !x.text.includes("種") && !x.text.includes("給"));
  const digest=(seed:number)=>createHash("sha256").update("control-v1:"+seed).digest("hex");
  return [...candidates].sort((a,b)=>
    digest(a.seedIndex).localeCompare(digest(b.seedIndex))
    ||a.seedIndex-b.seedIndex).slice(0,n);
}
export function verifyGeneratedControlNaturalness(
  source:ControlSource,review:ControlReview,
) {
  if(source.readingEligibilityPolicy!=="reviewed-roles"
    ||source.seedNamespace!==EXPECTED_NAMESPACE
    ||source.sampleCount!==2048||source.sentences.length!==2048
    ||source.sentences.some((x,i)=>x.seedIndex!==i))
    throw new Error("not the complete canonical 2048 reviewed-roles source");
  if(review.schemaVersion!=="generated-2048-hash-control-naturalness-v1"
    ||review.samplingCodeVersion!=="control-v1"
    ||review.seedNamespace!==EXPECTED_NAMESPACE)
    throw new Error("control review source version drift");
  if(review.independentSecondReviewComplete
    ||review.eligibleAsNaturalnessBenchmark||review.eligibleAsReadingGold
    ||review.productionActivationAllowed)
    throw new Error("first-pass controls are not approved training, gold or production evidence");
  const expected=getFixedNonPolyphonicControlSample(source.sentences);
  if(expected.length!==N||review.rows.length!==N)
    throw new Error("fixed control sample does not have exactly 30 rows");
  const categories:Record<string,number>={};
  for(let i=0;i<N;i++){
    const a=expected[i]!,b=review.rows[i]!;
    if(b.seedIndex!==a.seedIndex||b.sentence!==a.text)
      throw new Error("control sample differs from deterministic original at row "+i);
    if(b.reviewStatus!=="first-pass-provisional"||b.readingStatus!=="unreviewed"
      ||!b.reason.trim())throw new Error("control sample was improperly reviewed or promoted");
    if(!["incoherent-lexical-sequence","incomplete-clause","context-needed"]
      .includes(b.provisionalNaturalnessStatus))
      throw new Error("unrecognized first-pass control category");
    categories[b.provisionalNaturalnessStatus]=
      (categories[b.provisionalNaturalnessStatus]??0)+1;
  }
  return {
    schemaVersion:"generated-2048-control-first-pass-verification-v1",
    sourceSamples:2048,
    conditionalPopulation:"nonempty outputs without characters 種 or 給",
    sampleSize:N,
    reviewedContextQualitativeCounts:categories,
    independentNaturalnessApproved:0,
    independentPronunciationApproved:0,
    warning:"Deterministic hash sample, not independently validated sentence naturalness or phonetic correctness. No product-wide error-rate claim.",
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const [sourceFile,reviewFile,out]=process.argv.slice(2);
  if(!sourceFile||!reviewFile||!out)
    throw new Error("usage: tsx scripts/verify-generated-control-naturalness.ts <reviewed-roles-source.json> <first-pass-control.json> <output.json>");
  const result=verifyGeneratedControlNaturalness(
    JSON.parse(readFileSync(sourceFile,"utf8")) as ControlSource,
    JSON.parse(readFileSync(reviewFile,"utf8")) as ControlReview,
  );
  mkdirSync(dirname(out),{recursive:true});
  writeFileSync(out,JSON.stringify(result,null,2)+"\n","utf8");
  console.log(JSON.stringify(result,null,2));
}
