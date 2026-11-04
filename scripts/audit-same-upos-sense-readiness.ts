import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PolyphonicContextHit } from "../src/readings/polyphonic-audit.js";
import type { SameUposReviewQueue } from "../src/readings/same-upos-review.js";
import { auditSameUposSenseReadiness } from "../src/readings/same-upos-sense-readiness.js";

/**
 * Read-only review aid derived from the same *final delivered* 2048-seed
 * sample and same-UPOS queue. Never judges semantic correctness or changes
 * production selection policies.
 */
interface Input {
  readonly schemaVersion: string;
  readonly readingEligibilityPolicy: string;
  readonly sampleCount: number;
  readonly successfulSentences: number;
  readonly failedSentences: number;
  readonly hits: readonly PolyphonicContextHit[];
}
type Queue = SameUposReviewQueue & {
  readonly sampleCount: number;
  readonly sourcePolicy: string;
};

const args = process.argv.slice(2);
let exposurePath = "data/generated/polyphonic-context-standard-role-eighth-trial.json";
let queuePath = "data/generated/same-upos-polyphone-review.json";
let outputPath = "data/generated/same-upos-sense-readiness.json";
for(let i=0;i<args.length;i+=2){
  const name=args[i],value=args[i+1];
  if(value===undefined)throw new Error("missing value for "+name);
  if(name==="--exposure")exposurePath=value;
  else if(name==="--queue")queuePath=value;
  else if(name==="--output")outputPath=value;
  else throw new Error("unknown option "+name);
}
const exposure=JSON.parse(await readFile(exposurePath,"utf8")) as Input;
const queue=JSON.parse(await readFile(queuePath,"utf8")) as Queue;
if(exposure.schemaVersion!=="polyphonic-context-exposure-v1"
  || exposure.readingEligibilityPolicy!=="standard-role-eighth-trial"
  || exposure.sampleCount!==2048
  || exposure.successfulSentences!==2048 || exposure.failedSentences!==0
  || !Array.isArray(exposure.hits)
  || queue.schemaVersion!=="same-upos-review-queue-v1"
  || queue.sampleCount!==2048
  || queue.sourcePolicy!==exposure.readingEligibilityPolicy
  || queue.sampledPolyphonicOccurrences!==exposure.hits.length) {
  throw new Error("sense readiness requires same exact successful final 2048-seed exposure and review queue");
}
const review=auditSameUposSenseReadiness(queue,exposure.hits);
const output={...review,sampleCount:exposure.sampleCount,sourcePolicy:exposure.readingEligibilityPolicy};
await mkdir(dirname(outputPath),{recursive:true});
await writeFile(outputPath,JSON.stringify(output,null,2)+"\n","utf8");
console.log(JSON.stringify({
  outputPath,
  sampleCount:output.sampleCount,
  sourcePolicy:output.sourcePolicy,
  unchangedUnreviewedGroups:output.unchangedUnreviewedGroups,
  unchangedUnreviewedOccurrences:output.unchangedUnreviewedOccurrences,
  moeAttestedGroups:output.moeAttestedGroups,
  moeAttestedOccurrences:output.moeAttestedOccurrences,
  groupsWithIdenticalProfileFunctions:output.groupsWithIdenticalProfileFunctions,
  groups:output.groups.map(g=>({
    key:g.text+"/"+g.upos,
    occurrences:g.occurrences,
    profileFunctionsAllReadingsIdentical:g.profileFunctionsAllReadingsIdentical,
    distinctProfileFunctionSets:g.distinctProfileFunctionSets,
    perInstanceSenseEvidence:g.perInstanceSenseEvidence,
  })),
  caveat:output.caveat,
},null,2));
