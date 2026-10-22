import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile,Upos } from "../../src/syntax/types.js";
import { inspectReadingProvenance } from "../../scripts/audit-attested-frontier-provenance.js";
import { selectBlindReviewSample, type ReviewCandidate } from "../../scripts/sample-attested-review-queue.js";

function entry(word:string,reading:string):CatalogEntry{
  return {
    id:catalogEntryId(word,reading),prompt:{text:word,locale:"zh-TW"},
    syllables:[{tokens:[reading]}],tags:[],provenanceIds:[],
  };
}
function profile(e:CatalogEntry,upos:Upos):RuntimeSyntaxProfile{
  return {
    id:e.id+":"+upos,entryId:e.id,upos,
    functions:["predicate"],valencyFrames:["transitive"],
    provenanceIds:[],dependencyEvidence:{
      dependencyRelationCounts:{obj:1},surfacePositionCounts:{},
    },
  };
}
const rows=[entry("種","tone:3"),entry("種","tone:4"),entry("給","tone:3"),entry("給","tone:4")];
const catalog={
  entries:rows,profiles:rows.map((e,i)=>profile(e,i<2?"NOUN":"VERB")),
};
const candidate=(id:number,word:"種"|"給",upos:string):ReviewCandidate=>({
  split:"train",sentenceId:"train-s"+id,tokenId:1,
  originalSentence:"人工測試 "+word,word,corpusUpos:upos,
  corpusHeadId:0,corpusDependency:"root",
  previousWord:null,nextWord:null,reviewStatus:"unlabeled",
});

describe("unresolved frontier provenance and human-review sampling",()=>{
  it("shows both 種/NOUN candidates remain: existing reviewed role gate is not a disambiguator",()=>{
    const r=inspectReadingProvenance({word:"種",upos:"NOUN",targetOffset:0},catalog);
    expect(r.gateIsReadingSpecific).toBe(false);
    expect(r.exactAlignedCatalogCount).toBe(2);
    expect(r.sameUposEntryCount).toBe(2);
    expect(r.shippingLicensedEntryCount).toBe(2);
    expect(r.entries.every(e=>e.allowedByShippingGate)).toBe(true);
  });
  it("keeps both existing 給/VERB reading identities visible",()=>{
    const r=inspectReadingProvenance({word:"給",upos:"VERB",targetOffset:0},catalog);
    expect(r.gateIsReadingSpecific).toBe(false);
    expect(r.sameUposEntryCount).toBe(2);
    expect(r.entries.every(e=>e.matchingProfiles[0]!.functions.includes("predicate"))).toBe(true);
  });
  it("selects deterministic train-only examples without gold or dev/test",()=>{
    const entries=[
      candidate(1,"給","VERB"),candidate(2,"給","VERB"),
      candidate(3,"給","VERB"),candidate(4,"種","NOUN"),
    ];
    const queue={trainQueueSize:entries.length,trainReviewCandidates:entries};
    const a=selectBlindReviewSample(queue,2);
    const b=selectBlindReviewSample(queue,2);
    expect(a).toEqual(b);
    expect(a.groups.reduce((sum,g)=>sum+g.sample.length,0)).toBe(3);
    expect(a.manuallyApprovedReadings).toBe(0);
    expect(a.eligibleForTrainingOrEvaluation).toBe(false);
    expect(JSON.stringify(a)).not.toContain("Translit");
    const bad={
      ...queue,trainReviewCandidates:[{...entries[0]!,split:"dev"},...entries.slice(1)],
    };
    expect(()=>selectBlindReviewSample(bad,2)).toThrow(/train/);
  });
  it("detects duplicates rather than treating repetition as more evidence",()=>{
    const one=candidate(2,"給","VERB");
    expect(()=>selectBlindReviewSample({
      trainQueueSize:2,trainReviewCandidates:[one,{...one}],
    })).toThrow(/duplicate/);
  });
});
