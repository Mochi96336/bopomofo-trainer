import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { PINNED_GSD_BLOBS } from "../../scripts/mine-attested-standalone-contexts.js";
import { auditZhongSourcePosRisk } from "../../scripts/audit-attested-zhong-pos-counterexample.js";
import type { ReviewCandidate } from "../../scripts/sample-attested-review-queue.js";

const sourceSentence="有些種的花是兩性同花的，有些是單性的。";
const token=(sent:string,id:number,upos:string,text:string,previousWord:string,nextWord:string):ReviewCandidate=>({
  split:"train",sentenceId:sent,tokenId:id,
  originalSentence:text,word:"種",corpusUpos:upos,
  corpusHeadId:4,corpusDependency:"acl:relcl",
  previousWord,nextWord,reviewStatus:"unlabeled",
});
const raw=[
  token("train-s3887",2,"VERB",sourceSentence,"有些","的"),
  token("train-s2794",9,"PART","聖赫勒拿島戴勝是大西洋聖赫勒拿島的特有種。","特有","。"),
  token("train-s344",7,"PART","島蚺是模里西斯的地方特有種，因此只分布於當地一帶。","特有","，"),
  token("train-s411",26,"PART","布氏奇非鯽為特有種，體長可達15.3公分。","特有","，"),
  token("train-s712",32,"PART","截頜鯉為特有種，體長可達13.3公分。","特有","，"),
  token("train-s3068",6,"PART","提子屬於歐亞種葡萄。","亞","葡萄"),
];
const queue={
  sourceBlobs:{train:PINNED_GSD_BLOBS.train},
  groupCounts:{train:{"種/VERB":1,"種/PART":5}},
  trainQueueSize:raw.length,trainReviewCandidates:raw,
};
const catalog={entries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES};

describe("original-train-source-based counterexample to naive 種/VERB reading trial",()=>{
  it("keeps both readings in baseline, but the opt-in role gate discards nominal reading",()=>{
    const result=auditZhongSourcePosRisk(queue,catalog);
    expect(result.sourceGroups).toEqual({"種/VERB":1,"種/PART":5});
    expect(result.counterexample).toMatchObject({
      id:"train-s3887#2",
      sourceUpos:"VERB",
      provisionalSense:"species-noun-not-planting-verb",
      provisionalReading:"ㄓㄨㄥˇ",
      baselineStatus:"multiple-pronunciations",
      roleTrialStatus:"one-pronunciation",
      baselineContainsProvisionalNominalReading:true,
      roleTrialContainsProvisionalNominalReading:false,
      uniqueWrongIfProvisionalSenseConfirmed:true,
    });
    expect(result.groupFrontiers.map(g=>[g.group,g.occurrences])).toEqual([
      ["種/PART",5],["種/VERB",1],
    ].sort((a,b)=>String(a[0]).localeCompare(String(b[0]))));
    expect(result.occurrenceTotals).toMatchObject({
      shippingUnique:0,shippingAmbiguous:6,
      trialUnique:1,trialAmbiguous:5,
      trainCasesWithIndependentlyApprovedReading:0,
    });
    expect(result.groupFrontiers.find(g=>g.group==="種/VERB"))
      .toMatchObject({shippingStatus:"multiple-pronunciations",optInStatus:"one-pronunciation"});
    expect(result.suspectedSourcePosRows).toHaveLength(6);
    expect(result.independentSecondReviewComplete).toBe(false);
    expect(result.sourceSenseGoldApproval).toBe("provisional-human-interpretation-only");
  });
  it("rejects any change to the pinned train source, word, or original context",()=>{
    expect(()=>auditZhongSourcePosRisk({
      ...queue,sourceBlobs:{train:"unverified"}},catalog))
      .toThrow(/pinned/);
    const malformed=raw.map((r,i)=>i===0 ? {...r,previousWord:"其他"} : r);
    expect(()=>auditZhongSourcePosRisk({
      ...queue,trainReviewCandidates:malformed},catalog))
      .toThrow(/differs/);
  });
  it("never treats a source UPOS mismatch as additional training gold",()=>{
    const malformed=raw.map((r,i)=>i===0 ? {...r,corpusUpos:"NOUN"} : r);
    expect(()=>auditZhongSourcePosRisk({
      ...queue,trainReviewCandidates:malformed},catalog))
      .toThrow(/group-count mismatch/);
    expect(raw.every(r=>r.reviewStatus==="unlabeled")).toBe(true);
  });
});
