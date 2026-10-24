import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { compareRiskAbstentionGenerations } from "../../scripts/compare-candidate-risk-abstention.js";

const s1=catalogEntryId("種","ㄓㄨㄥ4");
const s2=catalogEntryId("種","ㄓㄨㄥ3");
const g1=catalogEntryId("給","ㄐㄧ3");
const g2=catalogEntryId("給","ㄍㄟ3");
const sentences=Array.from({length:2048},(_,i)=>({
  seedIndex:i,text:i===10?"生物種":i===20?"給對方":"普通測試",
  root:"sentence.test",entryIds:i===10?[s1]:i===20?[g1]:[],
}));
const original={
  readingEligibilityPolicy:"reviewed-roles",
  seedNamespace:"fixed-test",sampleCount:2048,catalogEntryCount:4,
  failedSentences:0,successfulSentences:2048,sentences,
  hits:[
    {seedIndex:10,text:"種",selectedUpos:"NOUN",selectedEntryId:s1},
    {seedIndex:20,text:"給",selectedUpos:"VERB",selectedEntryId:g1},
  ],
};
const candidate={
  ...original,readingEligibilityPolicy:"candidate-risk-abstention-trial",
  hits:[
    {seedIndex:10,text:"種",selectedUpos:"NOUN",selectedEntryId:s2},
    {seedIndex:20,text:"給",selectedUpos:"VERB",selectedEntryId:g2},
  ],
  sentences:sentences.map(s=>s.seedIndex===10?{...s,entryIds:[s2]}
    :s.seedIndex===20?{...s,entryIds:[g2]}:s),
};
describe("candidate-risk abstention generated output vs shipping, research-only",()=>{
  it("counts risk disappearance without inventing phonetic accuracy",()=>{
    const report=compareRiskAbstentionGenerations(original,candidate);
    expect(report).toMatchObject({
      flaggedOriginalOccurrences:2,flaggedTrialOccurrences:0,
      affectedSeedCount:2,changedSeedCount:2,unrelatedSeedCount:0,
      productionApproved:false,independentHeldoutReadingAccuracy:null,
      generatedSentenceNaturalness:null,
    });
  });
  it("rejects unlicensed/unrelated seed drift and residual risky entry identities",()=>{
    expect(()=>compareRiskAbstentionGenerations(original,{
      ...candidate,sentences:candidate.sentences.map(s=>s.seedIndex===25
        ? {...s,text:"unrelated change"}:s),
    })).toThrow(/unrelated/);
    expect(()=>compareRiskAbstentionGenerations(original,{
      ...candidate,hits:[...candidate.hits,original.hits[0]!],
    })).toThrow(/retained/);
  });
  it("requires identical seed universe and no generation failures",()=>{
    expect(()=>compareRiskAbstentionGenerations(original,{
      ...candidate,failedSentences:1,successfulSentences:2047,
    })).toThrow(/generation failure/);
    expect(()=>compareRiskAbstentionGenerations(original,{
      ...candidate,seedNamespace:"other",
    })).toThrow(/non-comparable/);
    expect(()=>compareRiskAbstentionGenerations(original,{
      ...candidate,sentences:candidate.sentences.slice(1),
    })).toThrow(/non-comparable/);
  });
});
