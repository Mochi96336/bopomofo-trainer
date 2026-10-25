import { describe,expect,it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { compareCandidatePreservation } from "../../scripts/compare-candidate-preservation.js";
const z4=catalogEntryId("種","ㄓㄨㄥ4");
const z3=catalogEntryId("種","ㄓㄨㄥ3");
const j3=catalogEntryId("給","ㄐㄧ3");
const g3=catalogEntryId("給","ㄍㄟ3");
const other=catalogEntryId("寫","ㄒㄧㄝ3");
const oldSentences=Array.from({length:2048},(_,i)=>({
  seedIndex:i,text:i===100?"三種":i===200?"我給你":"一個測試",
  root:"sentence.declarative",
  entryIds:i===100?[z4]:i===200?[j3]:[other],
}));
const base={
  readingEligibilityPolicy:"reviewed-roles",
  sampleCount:2048,
  seedNamespace:"seed-namespace",
  catalogEntryCount:5,
  successfulSentences:2048,failedSentences:0,
  sentences:oldSentences,
  hits:[
    {seedIndex:100,text:"種",selectedEntryId:z4,selectedUpos:"NOUN"},
    {seedIndex:200,text:"給",selectedEntryId:j3,selectedUpos:"VERB"},
  ],
};
const discarded={
  ...base,readingEligibilityPolicy:"candidate-risk-abstention-trial",
  sentences:oldSentences.map(x=>x.seedIndex===100?{...x,text:"三本",entryIds:[other]}
    :x.seedIndex===200?{...x,text:"我寫你",entryIds:[other]}:x),
  hits:[],
};
const rescued={
  ...base,readingEligibilityPolicy:"candidate-risk-abstention-preserve-word-trial",
  sentences:oldSentences.map(x=>x.seedIndex===100?{...x,entryIds:[z3]}
    :x.seedIndex===200?{...x,entryIds:[g3]}:x),
  hits:[
    {seedIndex:100,text:"種",selectedEntryId:z3,selectedUpos:"NOUN"},
    {seedIndex:200,text:"給",selectedEntryId:g3,selectedUpos:"VERB"},
  ],
};
describe("candidate-risk reading rescue vs word displacement",()=>{
  it("records lost opportunities separately from preserved text and phonetic correctness",()=>{
    const r=compareCandidatePreservation(base,discarded,rescued);
    expect(r).toMatchObject({
      originalFlaggedCandidates:2,
      ordinaryFlaggedCandidates:0,
      preservedFlaggedCandidates:0,
      affectedSeedCount:2,
      ordinaryChangedSeedCount:2,
      preserveWordChangedSeedCount:2,
      originalTargetWordDroppedByOrdinary:2,
      originalTargetWordDroppedByPreserveWord:0,
      identicalWrittenSentenceWithPreserveWord:2,
      targetWordOccurrences:{
        baseline:{"種":1,"給":1},
        ordinary:{"種":0,"給":0},
        preserveWord:{"種":1,"給":1},
      },
      independentPronunciationErrorRate:null,
      verifiedExerciseNaturalness:null,
      permissionToDeploy:false,
    });
  });
  it("fails on unrelated drift, wrongly retained original risk, or target-word removal",()=>{
    expect(()=>compareCandidatePreservation(base,discarded,{
      ...rescued,sentences:rescued.sentences.map(x=>x.seedIndex===300
        ? {...x,text:"unrelated"}:x),
    })).toThrow(/unrelated/);
    expect(()=>compareCandidatePreservation(base,discarded,{
      ...rescued,hits:[...rescued.hits,base.hits[0]!],
    })).toThrow(/not backed|did not remove/);
    expect(()=>compareCandidatePreservation(base,discarded,{
      ...rescued,hits:rescued.hits.slice(1),
    })).toThrow(/lost the target/);
  });
  it("rejects mismatched seed universes and invalid hit identities",()=>{
    expect(()=>compareCandidatePreservation(base,{
      ...discarded,seedNamespace:"not-matching",
    },rescued)).toThrow(/differing populations/);
    expect(()=>compareCandidatePreservation(base,discarded,{
      ...rescued,hits:[{...rescued.hits[0]!,selectedEntryId:"fabricated"}],
    })).toThrow(/not backed/);
  });
});
