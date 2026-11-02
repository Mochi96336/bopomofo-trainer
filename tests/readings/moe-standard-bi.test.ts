import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { reviewedMoeStandardBiReadingEligible } from "../../src/readings/moe-standard-bi.js";
import { reviewedMoeStandardLeReadingEligible } from "../../src/readings/moe-standard-le.js";
import { reviewedAdjacentReadingEligible, reviewedAdjacentPreDrawReadingEligible } from "../../src/readings/reviewed-adjacent-context.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function entry(text:string, reading:string): CatalogEntry {
  return {id:catalogEntryId(text,reading),prompt:{text,locale:"zh-TW"},syllables:[{tokens:["zhuyin:ㄅ","tone:1"]}],tags:[],provenanceIds:[]};
}
function profile(x:CatalogEntry,upos:Upos,fn:"subject"|"predicate"="predicate"):RuntimeSyntaxProfile {
  return {id:x.id+"/"+upos,entryId:x.id,upos,functions:[fn],valencyFrames:["avalent"],dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},provenanceIds:[]};
}
const wrong=entry("比","ㄅㄧ1");
const bi3=entry("比","ㄅㄧ3");
const bi4=entry("比","ㄅㄧ4");
const pi2=entry("比","ㄆㄧ2");
const subject=entry("她","ㄊㄚ1");
const alternate=entry("好","ㄏㄠ3");
const rule: ProductionRule={
  id:"sentence.bi-identity-scope-fixture",grammarVersion:FORMAL_GRAMMAR_VERSION,output:"Sentence",
  constituents:[
    {key:"subject",category:"Lexeme",minimum:1,maximum:1,recursive:false,allowedUpos:["PRON"],requiredFunctions:["subject"],requiredValencyFrames:[],requiredFeatures:{}},
    {key:"predicate",category:"Lexeme",minimum:1,maximum:1,recursive:false,allowedUpos:["VERB"],requiredFunctions:["predicate"],requiredValencyFrames:[],requiredFeatures:{}},
  ],
  surfaceOrders:[{id:"canonical",constituentKeys:["subject","predicate"]}],
  constraints:[],positiveFixtureIds:["one"],negativeFixtureIds:["two"],
};
describe("MOE-approved exact standalone 比 reading identities",()=>{
  it("preserves ㄅㄧ3, ㄅㄧ4 and ㄆㄧ2 independent of weak-key evidence or guessed POS",()=>{
    for(const upos of ["VERB","NOUN","ADP","CCONJ","X"] as Upos[]){
      expect(reviewedMoeStandardBiReadingEligible(wrong,profile(wrong,upos))).toBe(false);
      for(const e of [bi3,bi4,pi2]){
        expect(reviewedMoeStandardBiReadingEligible(e,profile(e,upos))).toBe(true);
      }
    }
    const compound=entry("比例","ㄅㄧ3-ㄌㄧ4");
    expect(reviewedMoeStandardBiReadingEligible(compound,profile(compound,"NOUN"))).toBe(true);
    expect(()=>reviewedMoeStandardBiReadingEligible(wrong,profile(bi3,"VERB"))).toThrow(/selected catalog identity/);
  });
  it("only redraws the selected unapproved identity; retains other already-legal selections",()=>{
    const config={
      eligibleEntries:[subject,wrong,bi3,bi4,pi2,alternate],
      profiles:[profile(subject,"PRON","subject"),profile(wrong,"VERB"),profile(bi3,"VERB"),profile(bi4,"VERB"),profile(pi2,"VERB"),profile(alternate,"VERB")],
      rules:[rule],samplingMode:"raw" as const,random:{next:()=>0.5},
      entryWeightsById:{[subject.id]:1,[wrong.id]:1000000,[bi3.id]:1,[bi4.id]:1,[pi2.id]:1,[alternate.id]:1000},
      minimumLexicalEntries:2,maximumCandidates:1,maximumAttempts:1,
    };
    const raw=composeFormalSyntaxUtterances(config).candidates[0]!;
    const fixed=composeFormalSyntaxUtterances({...config,
      readingEligibility:reviewedAdjacentReadingEligible,
      preDrawReadingEligibility:reviewedAdjacentPreDrawReadingEligible,
      finalCandidateReadingEligibility:reviewedMoeStandardBiReadingEligible,
    }).candidates[0]!;
    expect(raw.entries[1]?.id).toBe(wrong.id);
    expect(fixed.entries[1]?.id).not.toBe(wrong.id);
    expect(fixed.entries[0]?.id).toBe(raw.entries[0]?.id);
    expect(fixed.syntaxRootRuleId).toBe(raw.syntaxRootRuleId);
    const legal={...config,entryWeightsById:{
      [subject.id]:1,[wrong.id]:0.001,[bi3.id]:1,[bi4.id]:1,[pi2.id]:1,[alternate.id]:1000000,
    }};
    const legalRaw=composeFormalSyntaxUtterances(legal).candidates[0]!;
    const legalFixed=composeFormalSyntaxUtterances({...legal,
      readingEligibility:reviewedAdjacentReadingEligible,preDrawReadingEligibility:reviewedAdjacentPreDrawReadingEligible,
      finalCandidateReadingEligibility:reviewedMoeStandardBiReadingEligible,
    }).candidates[0]!;
    expect(legalRaw.entries[1]?.id).toBe(alternate.id);
    expect(legalFixed.entries.map(x=>x.id)).toEqual(legalRaw.entries.map(x=>x.id));
  });
  it("does not accidentally change the established MOE-standard 了 gate",()=>{
    const leWrong=entry("了","ㄌㄧㄠ4");
    const leGood=entry("了","ㄌㄧㄠ3");
    expect(reviewedMoeStandardLeReadingEligible(leWrong,profile(leWrong,"VERB"))).toBe(false);
    expect(reviewedAdjacentReadingEligible(leWrong,profile(leWrong,"VERB"),null,null)).toBe(false);
    expect(reviewedAdjacentReadingEligible(leGood,profile(leGood,"VERB"),null,null)).toBe(true);
  });
});
