import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PINNED_GSD_BLOBS } from "./mine-attested-standalone-contexts.js";
import type { ReviewQueue } from "./sample-attested-review-queue.js";

interface FirstPassGiveRow {
  readonly sentenceId:string;
  readonly tokenId:number;
  readonly provisionalTargetReading:string;
  readonly contextKind:string;
  readonly reviewStatus:string;
}
export interface FirstPassGiveReview {
  readonly schemaVersion:string;
  readonly originalTrainBlobSha:string;
  readonly split:string;
  readonly independentSecondReviewComplete:boolean;
  readonly eligibleAsGold:boolean;
  readonly eligibleForModelTraining:boolean;
  readonly shouldTriggerProductionReadingGate:boolean;
  readonly noConfirmedStandaloneJiInThisSample:boolean;
  readonly entries:readonly FirstPassGiveRow[];
}
export interface PinnedGiveQueue extends ReviewQueue {
  readonly sourceBlobs:{readonly train:string};
}
export function verifyFirstPassGiveReview(queue:PinnedGiveQueue,review:FirstPassGiveReview){
  if(queue.sourceBlobs.train!==PINNED_GSD_BLOBS.train
    ||review.originalTrainBlobSha!==PINNED_GSD_BLOBS.train)
    throw new Error("original train source provenance mismatch");
  if(review.schemaVersion!=="attested-train-give-preliminary-reading-review-v1"
    ||review.split!=="train")
    throw new Error("wrong first-pass review schema/split");
  if(review.independentSecondReviewComplete||review.eligibleAsGold
    ||review.eligibleForModelTraining||review.shouldTriggerProductionReadingGate)
    throw new Error("unverified first-pass judgments must never be promoted");
  if(queue.trainReviewCandidates.length!==queue.trainQueueSize)
    throw new Error("incomplete original train queue");
  const originals=queue.trainReviewCandidates.filter(x=>x.word==="給");
  const reference=new Map<string,typeof originals[number]>();
  for(const row of originals){
    if(row.split!=="train"||row.reviewStatus!=="unlabeled")
      throw new Error("source queue must remain train-only and unlabelled");
    const key=row.sentenceId+"#"+row.tokenId;
    if(reference.has(key))throw new Error("duplicate source token "+key);
    reference.set(key,row);
  }
  if(review.entries.length!==reference.size)
    throw new Error("first-pass 給 review does not cover all original occurrences");
  const visited=new Set<string>();
  const kinds:Record<string,number>={};
  let firstPassJi=0;
  for(const row of review.entries){
    const key=row.sentenceId+"#"+row.tokenId;
    if(visited.has(key))throw new Error("duplicate preliminary entry "+key);
    visited.add(key);
    if(!reference.has(key))throw new Error("unattested preliminary token "+key);
    if(row.reviewStatus!=="first-pass-not-second-verified")
      throw new Error("preliminary reading cannot masquerade as verified");
    if(row.provisionalTargetReading!=="ㄍㄟˇ"&&row.provisionalTargetReading!=="ㄐㄧˇ")
      throw new Error("unexpected provisional 給 target reading");
    if(!["giving-or-transfer","recipient-or-benefactive","constructional-gei"].includes(row.contextKind))
      throw new Error("invalid first-pass context type");
    kinds[row.contextKind]=(kinds[row.contextKind]??0)+1;
    firstPassJi+=Number(row.provisionalTargetReading==="ㄐㄧˇ");
  }
  if(review.noConfirmedStandaloneJiInThisSample!== (firstPassJi===0))
    throw new Error("review report's tentative contrast flag disagrees with rows");
  return {
    schemaVersion:"attested-train-give-first-pass-verification-v1",
    originalTrainBlobSha:queue.sourceBlobs.train,
    reviewedTokenCount:visited.size,
    originalTokenCount:reference.size,
    originalSourceUposDistribution:Object.fromEntries(
      [...new Set(originals.map(x=>x.corpusUpos))].sort().map(pos=>[
        pos,originals.filter(x=>x.corpusUpos===pos).length,
      ])),
    preliminaryContextKinds:kinds,
    preliminaryGeiCount:visited.size-firstPassJi,
    preliminaryJiCount:firstPassJi,
    independentSecondReviewApprovedCount:0,
    eligibleGoldCount:0,
    note:"Tentative first-pass judgments of original sentences only. Not source transliteration, independent gold, blind-test accuracy, or a production policy.",
  };
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const q=process.argv[2]??"data/generated/attested-standalone-unlabeled-train-queue.json";
  const r=process.argv[3]??"research/attested-reading-pilot/train-give-preliminary-review.json";
  const o=process.argv[4]??"data/generated/attested-train-give-first-pass-verification.json";
  const result=verifyFirstPassGiveReview(
    JSON.parse(readFileSync(q,"utf8")) as PinnedGiveQueue,
    JSON.parse(readFileSync(r,"utf8")) as FirstPassGiveReview,
  );
  mkdirSync(dirname(o),{recursive:true});
  writeFileSync(o,JSON.stringify(result,null,2)+"\n","utf8");
  console.log(JSON.stringify(result,null,2));
}
