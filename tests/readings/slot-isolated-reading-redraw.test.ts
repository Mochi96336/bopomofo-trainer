import { describe, expect, it } from "vitest";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";

function word(id:string):CatalogEntry {
  return {
    id, prompt:{text:id,locale:"zh-TW"},
    syllables:[{tokens:["zhuyin:ㄅ","tone:1"]}],
    tags:[],provenanceIds:[],
  };
}
function profile(item:CatalogEntry):RuntimeSyntaxProfile {
  return {
    id:item.id+"/NOUN",entryId:item.id,upos:"NOUN",
    functions:["subject"],valencyFrames:["avalent"],
    dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},provenanceIds:[],
  };
}
function counter(seed:string) {
  const random=createSeededRandom(seed);
  let calls=0;
  const counted:RandomSource={next:()=>{calls+=1;return random.next();}};
  return {random:counted,count:()=>calls};
}
const first=word("first");
const bad=word("nonstandard-bi");
const legal=word("other-reading");
const lastA=word("last-a");
const lastB=word("last-b");
const entries=[first,bad,legal,lastA,lastB];
const profiles=entries.map(profile);
const rule:ProductionRule={
  id:"sentence.reading-redraw-rng-isolation",
  grammarVersion:FORMAL_GRAMMAR_VERSION,output:"Sentence",
  constituents:[
    {key:"first",category:"Lexeme",minimum:1,maximum:1,recursive:false,allowedUpos:["NOUN"],requiredFunctions:["subject"],requiredValencyFrames:[],requiredFeatures:{}},
    {key:"target",category:"Lexeme",minimum:1,maximum:1,recursive:false,allowedUpos:["NOUN"],requiredFunctions:["subject"],requiredValencyFrames:[],requiredFeatures:{}},
    {key:"last",category:"Lexeme",minimum:1,maximum:1,recursive:false,allowedUpos:["NOUN"],requiredFunctions:["subject"],requiredValencyFrames:[],requiredFeatures:{}},
  ],
  surfaceOrders:[{id:"canonical",constituentKeys:["first","target","last"]}],
  constraints:[],positiveFixtureIds:["p"],negativeFixtureIds:["n"],
};
function run(seed:string, guard:boolean) {
  const source=counter(seed);
  const result=composeFormalSyntaxUtterances({
    eligibleEntries:entries,profiles,random:source.random,
    rules:[rule],samplingMode:"raw",
    entryWeightsById:{
      [first.id]:1, [bad.id]:1000000,
      [legal.id]:1, [lastA.id]:1, [lastB.id]:1,
    },
    ...(guard ? {
      readingEligibility:(item:CatalogEntry)=>item.id!==bad.id,
      isolatedReadingRedrawEntryIds:new Set([bad.id]),
    }:{}),
    maximumCandidates:1,maximumAttempts:1,minimumLexicalEntries:2,
  });
  const calls=source.count();
  const nextValue=source.random.next();
  return {candidate:result.candidates[0],calls,nextValue,reason:result.fallbackReasons};
}

describe("opt-in pronunciation rejection does not advance parent RNG",()=>{
  it("preserves the shared RNG draw count and subsequent token stream on rejection",()=>{
    for(let i=0;i<64;i++){
      const baseline=run("rng-isolation:"+i,false);
      const guarded=run("rng-isolation:"+i,true);
      expect(guarded.candidate).toBeDefined();
      expect(baseline.candidate).toBeDefined();
      expect(guarded.candidate?.entries.every(e=>e.id!==bad.id)).toBe(true);
      expect(guarded.calls).toBe(baseline.calls);
      expect(guarded.nextValue).toBe(baseline.nextValue);
      expect(guarded.candidate?.syntaxRootRuleId).toBe(baseline.candidate?.syntaxRootRuleId);
    }
  });
});
