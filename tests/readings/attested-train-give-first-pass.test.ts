import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import { PINNED_GSD_BLOBS } from "../../scripts/mine-attested-standalone-contexts.js";
import {
  verifyFirstPassGiveReview,
  type FirstPassGiveReview,
  type PinnedGiveQueue,
} from "../../scripts/verify-attested-train-give-review.js";

const complete=JSON.parse(readFileSync(
  "research/attested-reading-pilot/train-give-preliminary-review.json","utf8",
)) as FirstPassGiveReview;

const first=complete.entries[0]!;
const second=complete.entries[1]!;
const entry=(row:typeof first)=>({
  split:"train" as const,sentenceId:row.sentenceId,tokenId:row.tokenId,
  originalSentence:"練習句：給他一個東西。",word:"給",
  corpusUpos:"VERB",corpusHeadId:0,corpusDependency:"root",
  previousWord:null,nextWord:"他",reviewStatus:"unlabeled" as const,
});
const queue:PinnedGiveQueue={
  sourceBlobs:{train:PINNED_GSD_BLOBS.train},
  trainQueueSize:2,trainReviewCandidates:[entry(first),entry(second)],
};
const review:FirstPassGiveReview={...complete,entries:[first,second]};

describe("independently traceable, provisional-only standalone 給 review",()=>{
  it("preserves the complete 36-target first pass without elevating it to gold",()=>{
    expect(complete.entries).toHaveLength(36);
    expect(new Set(complete.entries.map(x=>x.sentenceId+"#"+x.tokenId)).size).toBe(36);
    expect(complete.eligibleAsGold).toBe(false);
    expect(complete.eligibleForModelTraining).toBe(false);
    expect(complete.independentSecondReviewComplete).toBe(false);
    expect(complete.shouldTriggerProductionReadingGate).toBe(false);
    expect(complete.noProvisionalStandaloneJiInThisSample).toBe(true);
    expect(complete.entries.every(x=>x.reviewStatus==="first-pass-not-second-verified")).toBe(true);
  });
  it("joins original token identities before allowing an auditable first-pass report",()=>{
    const result=verifyFirstPassGiveReview(queue,review);
    expect(result).toMatchObject({
      reviewedTokenCount:2,originalTokenCount:2,
      originalSourceUposDistribution:{VERB:2},
      preliminaryGeiCount:2,preliminaryJiCount:0,
      eligibleGoldCount:0,independentSecondReviewApprovedCount:0,
    });
  });
  it("fails closed on fabricated corpus IDs, duplicate records, or incomplete source",()=>{
    expect(()=>verifyFirstPassGiveReview(queue,{
      ...review,entries:[{...first,sentenceId:"train-s99999"},second],
    })).toThrow(/unattested/);
    expect(()=>verifyFirstPassGiveReview(queue,{
      ...review,entries:[first,first],
    })).toThrow(/duplicate/);
    expect(()=>verifyFirstPassGiveReview({
      ...queue,trainQueueSize:3,
    },review)).toThrow(/incomplete/);
  });
  it("rejects promotion of a first-pass claim into gold or production permission",()=>{
    for(const change of [
      {eligibleAsGold:true},{eligibleForModelTraining:true},
      {independentSecondReviewComplete:true},{shouldTriggerProductionReadingGate:true},
    ]){
      expect(()=>verifyFirstPassGiveReview(queue,{...review,...change})).toThrow(/never be promoted/);
    }
    expect(()=>verifyFirstPassGiveReview({
      ...queue,sourceBlobs:{train:"unverifiable"},
    },review)).toThrow(/provenance/);
    expect(()=>verifyFirstPassGiveReview(queue,{
      ...review,entries:[{...first,provisionalTargetReading:"ㄐㄧˇ"},second],
    })).toThrow(/tentative contrast flag/);
  });
});
