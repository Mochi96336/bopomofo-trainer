import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import {
  auditGeneratedReadingRisk,
  type GeneratedHit,type GeneratedReport,
} from "../../scripts/audit-generated-polyphonic-risk.js";

const seeds=Array.from({length:2048},(_,i)=>({
  seedIndex:i,text:i===10?"多少種":i===20?"他們給對方":"簡單",
  entryIds:i===10?[catalogEntryId("種","ㄓㄨㄥ4")]
    :i===20?[catalogEntryId("給","ㄐㄧ3")]:[],
}));
const hit=(seedIndex:number,word:"種"|"給",reading:string,upos:string):GeneratedHit=>({
  seedIndex,sentence:seeds[seedIndex]!.text!,text:word,
  selectedEntryId:catalogEntryId(word,reading),selectedUpos:upos,
  entryIndex:0,previousEntryText:null,nextEntryText:null,
});
const base:GeneratedReport={
  readingEligibilityPolicy:"reviewed-roles",
  sampleCount:2048,successfulSentences:2048,failedSentences:0,
  seedNamespace:"fixed-test-seeds",sentences:seeds,
  hits:[hit(10,"種","ㄓㄨㄥ4","NOUN"),hit(20,"給","ㄐㄧ3","VERB")],
};
const trial:GeneratedReport={
  ...base,readingEligibilityPolicy:"zhong-role-trial",
  hits:[hit(20,"給","ㄐㄧ3","VERB")],
};
describe("product-formal composer risk exposures, never human phonetic error labels",()=>{
  it("tracks exact selected entry IDs, not substrings or guessed G2P",()=>{
    const report=auditGeneratedReadingRisk(base,trial);
    expect(report.riskRows.map(x=>[x.writtenForm,x.shippingHits,x.trialHits]))
      .toEqual([["種",1,0],["給",1,1]]);
    expect(report.totalShippingFlaggedHits).toBe(2);
    expect(report.totalTrialFlaggedHits).toBe(1);
    expect(report.riskRows.every(x=>
      x.reviewedWrongReadingCount===null&&!x.contextReadingVerified)).toBe(true);
    expect(report.goldOrHumanAccuracyAvailable).toBe(false);
    expect(report.countsAreExposureNotError).toBe(true);
  });
  it("refuses false matches or changes to seed, source policy and production entry",()=>{
    expect(()=>auditGeneratedReadingRisk({...base,
      hits:[{...base.hits[0]!,selectedEntryId:"word:種:bogus"}]},trial))
      .toThrow(/joined/);
    expect(()=>auditGeneratedReadingRisk({...base,sampleCount:2047},trial))
      .toThrow(/2048/);
    expect(()=>auditGeneratedReadingRisk({...base,readingEligibilityPolicy:"none"},trial))
      .toThrow(/shipping reviewed roles/);
    expect(()=>auditGeneratedReadingRisk(base,{...trial,seedNamespace:"not-matching"}))
      .toThrow(/populations/);
  });
  it("does not flag the reviewed pronunciation identity even when the surface matches",()=>{
    const safe={...base,
      hits:[hit(10,"種","ㄓㄨㄥ3","NOUN")],
      sentences:base.sentences.map(row=>row.seedIndex===10
        ? {...row,entryIds:[catalogEntryId("種","ㄓㄨㄥ3")]} : row),
    };
    expect(auditGeneratedReadingRisk(safe,trial).totalShippingFlaggedHits).toBe(0);
  });
});
