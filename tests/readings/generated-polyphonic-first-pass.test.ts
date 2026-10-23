import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  verifyGeneratedFirstPassNaturalness,
  type FirstPassNaturalnessReview,
  type GeneratedTargetRiskReport,
} from "../../scripts/verify-generated-polyphonic-first-pass.js";
const review=JSON.parse(readFileSync(
  "research/attested-reading-pilot/generated-2048-first-pass-naturalness.json","utf8",
)) as FirstPassNaturalnessReview;
const flagged=new Set([144,191,268,443,872,1084,1196,1516,1650,1774,1783,1804,1930,2039]);
const report:GeneratedTargetRiskReport={
  schemaVersion:"generated-attested-polyphonic-risk-v1",
  shippingReadingEligibilityPolicy:"reviewed-roles",sampleCount:2048,
  allTargetHits:review.rows.map(row=>({
    seedIndex:row.seedIndex,sentence:row.sentence,
    originalWrittenToken:row.seedIndex===121?"種":"給",
    predeclaredRiskFlag:flagged.has(row.seedIndex),
  })),
  unreviewedGeneratedTargetCount:30,totalShippingFlaggedHits:14,
  riskRows:[{shippingHits:6},{shippingHits:8}],
};
describe("full generated-utterance first pass is not pronunciation gold",()=>{
  it("covers all 30, including 16 controls, without declaring a safe exercise",()=>{
    const result=verifyGeneratedFirstPassNaturalness(report,review);
    expect(result).toMatchObject({
      reviewedCount:30,originalGeneratedTargetCount:30,
      originalFlaggedTargetCount:14,
      firstPassQualitativeCounts:{
        "incoherent-lexical-sequence":22,
        "incomplete-clause":6,
        "context-needed":2,
      },
      independentlyApprovedNaturalnessCount:0,
      independentlyApprovedCorrectReadingCount:0,
    });
    expect(review.rows.every(x=>x.suitableAsStandalonePracticeItem===false)).toBe(true);
  });
  it("rejects dropped, fabricated, modified, or duplicate generated contexts",()=>{
    expect(()=>verifyGeneratedFirstPassNaturalness({...report,
      allTargetHits:report.allTargetHits.slice(1)},review)).toThrow(/not all source-generated/);
    expect(()=>verifyGeneratedFirstPassNaturalness(report,{
      ...review,rows:review.rows.map((x,i)=>i===0
        ? {...x,sentence:"invented"} : x),
    })).toThrow(/fabricated/);
    expect(()=>verifyGeneratedFirstPassNaturalness(report,{
      ...review,rows:[...review.rows.slice(1),review.rows[1]!],
    })).toThrow(/duplicate/);
  });
  it("refuses unreviewed naturalness and reading as production training labels",()=>{
    for(const key of [
      "independentSecondReviewComplete",
      "eligibleAsPronunciationGold",
      "eligibleAsValidatedNaturalnessBenchmark",
      "productionActivationAllowed",
    ] as const){
      expect(()=>verifyGeneratedFirstPassNaturalness(report,{...review,[key]:true}))
        .toThrow(/cannot be promoted/);
    }
    expect(()=>verifyGeneratedFirstPassNaturalness(report,{
      ...review,rows:review.rows.map((r,i)=>i===0
        ? {...r,suitableAsStandalonePracticeItem:true as never} : r),
    })).toThrow(/attempted approval/);
  });
});
