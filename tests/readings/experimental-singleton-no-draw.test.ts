import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import {
  compareSingletonNoDraw,type NoDrawAudit,
} from "../../scripts/compare-candidate-no-draw.js";
const id={
  z4:catalogEntryId("種","ㄓㄨㄥ4"),
  z3:catalogEntryId("種","ㄓㄨㄥ3"),
  j3:catalogEntryId("給","ㄐㄧ3"),
  g3:catalogEntryId("給","ㄍㄟ3"),
};
const origin=Array.from({length:2048},(_,i)=>({
  seedIndex:i,root:"sentence.test",
  text:i===10?"三種物品":i===20?"我給你":"今天下雨",
  entryIds:i===10?[id.z4]:i===20?[id.j3]:[],
}));
const hits=[
  {seedIndex:10,text:"種",selectedUpos:"NOUN",selectedEntryId:id.z4},
  {seedIndex:20,text:"給",selectedUpos:"VERB",selectedEntryId:id.j3},
];
const baseline:NoDrawAudit={
  readingEligibilityPolicy:"reviewed-roles",
  sampleCount:2048,successfulSentences:2048,failedSentences:0,
  seedNamespace:"unit-stable",catalogEntryCount:4,
  sentences:origin,hits,
};
const prior:NoDrawAudit={
  ...baseline,readingEligibilityPolicy:"candidate-risk-abstention-preserve-word-trial",
  sentences:origin.map(x=>x.seedIndex===10?{...x,text:"三種東西",entryIds:[id.z3]}
    :x.seedIndex===20?{...x,entryIds:[id.g3]}:x),
  hits:[
    {seedIndex:10,text:"種",selectedUpos:"NOUN",selectedEntryId:id.z3},
    {seedIndex:20,text:"給",selectedUpos:"VERB",selectedEntryId:id.g3},
  ],
};
const noDraw:NoDrawAudit={
  ...prior,readingEligibilityPolicy:"candidate-risk-abstention-singleton-no-draw-trial",
  sentences:origin.map(x=>x.seedIndex===10?{...x,entryIds:[id.z3]}
    :x.seedIndex===20?{...x,entryIds:[id.g3]}:x),
};
describe("zero-extra-random singleton reading rescue",()=>{
  it("preserves exact written context without pretending the new reading is verified",()=>{
    const result=compareSingletonNoDraw(baseline,prior,noDraw);
    expect(result).toMatchObject({
      samples:2048,originalFlaggedCandidateCount:2,newlyFlaggedCandidateCount:0,
      originalTargetWordsDropped:0,unrelatedSeedDrift:0,
      previousIdenticalWrittenSentences:1,
      singletonNoDrawIdenticalWrittenSentences:2,
      beforeChangedSeedCount:2,afterChangedSeedCount:2,
      approvedForProduct:false,independentHeldoutAccuracy:null,
    });
    expect(result.cases.every(x=>!x.independentlyVerifiedCorrectReading
      &&!x.independentlyVerifiedSentenceNaturalness)).toBe(true);
  });
  it("rejects dropped words, lingering risky candidates and unrelated seed drift",()=>{
    expect(()=>compareSingletonNoDraw(baseline,prior,{
      ...noDraw,hits:[noDraw.hits[0]!],
    })).toThrow(/dropped target/);
    expect(()=>compareSingletonNoDraw(baseline,prior,{
      ...noDraw,hits:[...noDraw.hits,hits[0]!],
    })).toThrow(/untraceable|retained a predeclared risky reading/);
    expect(()=>compareSingletonNoDraw(baseline,prior,{
      ...noDraw,sentences:noDraw.sentences.map(x=>x.seedIndex===32
        ? {...x,text:"an unrelated alteration"} : x),
    })).toThrow(/unrelated/);
  });
  it("does not accept flawed populations or false context preservation",()=>{
    expect(()=>compareSingletonNoDraw(baseline,prior,{
      ...noDraw,failedSentences:1,successfulSentences:2047,
    })).toThrow(/incomparable/);
    expect(()=>compareSingletonNoDraw(baseline,prior,{
      ...noDraw,seedNamespace:"different",
    })).toThrow(/incomparable/);
    expect(()=>compareSingletonNoDraw(baseline,prior,{
      ...noDraw,sentences:prior.sentences.map(x=>x.seedIndex===20
        ? {...x,text:"我給甲"} : x),
    })).toThrow(/worsened/);
  });
});
