import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import {
  getFixedNonPolyphonicControlSample,
  verifyGeneratedControlNaturalness,
  type ControlSource,
  type ControlReview,
} from "../../scripts/verify-generated-control-naturalness.js";
const review=JSON.parse(readFileSync(
  "research/attested-reading-pilot/generated-2048-hash-control-naturalness.json","utf8",
)) as ControlReview;
const texts=new Map(review.rows.map(x=>[x.seedIndex,x.sentence]));
// Every source sentence is generated, but all other synthetic sentences
// contain the excluded character so the exact hash-ranked 30 are stable.
const source:ControlSource={
  readingEligibilityPolicy:"reviewed-roles",sampleCount:2048,
  successfulSentences:2048,
  seedNamespace:"formal-syntax-v2-phase1-product-baseline-v1",
  sentences:Array.from({length:2048},(_,i)=>({
    seedIndex:i,text:texts.get(i)??"含種的測試用句",
  })),
};
describe("fixed 30-seed naturalness controls independent of polyphone selection",()=>{
  it("uses deterministic SHA-rank and matches every original non-target control",()=>{
    expect(getFixedNonPolyphonicControlSample(source.sentences).map(x=>x.seedIndex))
      .toEqual(review.rows.map(x=>x.seedIndex));
    const result=verifyGeneratedControlNaturalness(source,review);
    expect(result).toMatchObject({
      sourceSamples:2048,sampleSize:30,
      reviewedContextQualitativeCounts:{
        "incoherent-lexical-sequence":23,
        "incomplete-clause":3,
        "context-needed":4,
      },
      independentNaturalnessApproved:0,
      independentPronunciationApproved:0,
    });
  });
  it("rejects text drift, missing original seeds and first-pass promotion",()=>{
    const altered={...review,
      rows:review.rows.map((x,i)=>i===0 ? {...x,sentence:"rewritten"} : x),
    };
    expect(()=>verifyGeneratedControlNaturalness(source,altered)).toThrow(/differs/);
    expect(()=>verifyGeneratedControlNaturalness({
      ...source,successfulSentences:2047,
    },review)).toThrow(/complete canonical/);
    expect(()=>verifyGeneratedControlNaturalness(source,{
      ...review,eligibleAsNaturalnessBenchmark:true,
    })).toThrow(/not approved/);
  });
});
