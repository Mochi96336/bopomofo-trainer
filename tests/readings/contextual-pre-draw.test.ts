import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import {
  reviewedContextualPreDrawReadingEligible,
  reviewedRoleAndOrdinalLineReadingEligible,
} from "../../src/readings/ordinal-line-context.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function word(text: string, reading: string, tone: string): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄏ", tone] }],
    provenanceIds: [], tags: [],
  };
}
function profile(entry: CatalogEntry, upos: Upos, fn: "subject" | "predicate"): RuntimeSyntaxProfile {
  return {
    id: entry.id + "/" + upos,
    entryId: entry.id, upos, functions: [fn],
    valencyFrames: ["avalent"], provenanceIds: [],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
  };
}
const he = word("他","ㄊㄚ1","tone:1");
const good = word("好","ㄏㄠ3","tone:3");
const fond = word("好","ㄏㄠ4","tone:4");
const bad = word("壞","ㄏㄨㄞ4","tone:4");
const rule: ProductionRule = {
  id:"sentence.reviewed-adjective",
  grammarVersion:FORMAL_GRAMMAR_VERSION,output:"Sentence",
  constituents:[
    { key:"subject",category:"Lexeme",minimum:1,maximum:1,recursive:false,
      allowedUpos:["PRON"],requiredFunctions:["subject"],requiredValencyFrames:[],requiredFeatures:{} },
    { key:"predicate",category:"Lexeme",minimum:1,maximum:1,recursive:false,
      allowedUpos:["ADJ"],requiredFunctions:["predicate"],requiredValencyFrames:[],requiredFeatures:{} },
  ],
  surfaceOrders:[{id:"canonical",constituentKeys:["subject","predicate"]}],
  constraints:[],positiveFixtureIds:["valid"],negativeFixtureIds:["invalid"],
};
function generate(weights: Readonly<Record<string,number>>, prefilter: boolean) {
  return composeFormalSyntaxUtterances({
    eligibleEntries:[he,good,fond,bad],
    profiles:[profile(he,"PRON","subject"),profile(good,"ADJ","predicate"),
      profile(fond,"ADJ","predicate"),profile(bad,"ADJ","predicate")],
    rules:[rule],samplingMode:"raw",random:{next:()=>0.5},
    entryWeightsById:weights,minimumLexicalEntries:2,
    maximumCandidates:1,maximumAttempts:1,
    readingEligibility:reviewedRoleAndOrdinalLineReadingEligible,
    ...(prefilter ? {preDrawReadingEligibility:reviewedContextualPreDrawReadingEligible} : {}),
  }).candidates[0];
}
describe("reviewed contextual pre-draw license (research only)",()=>{
  it("invalid ㄏㄠ4 weight cannot inflate the probability of legal 好/ㄏㄠ3",()=>{
    const weights={
      [he.id]:1,
      [fond.id]:1_000_000,
      [good.id]:1,
      [bad.id]:1_000,
    };
    const candidate=generate(weights,true);
    expect(candidate?.entries.map(x=>x.id)).toEqual([he.id,bad.id]);
    expect(candidate?.text).toBe("他壞");
  });
  it("correct adjective 好 stays eligible and wins with its own weight",()=>{
    const weights={
      [he.id]:1,[fond.id]:1_000_000,[good.id]:2_000,[bad.id]:1,
    };
    const candidate=generate(weights,true);
    expect(candidate?.entries.map(x=>x.id)).toEqual([he.id,good.id]);
    expect(candidate?.text).toBe("他好");
  });
  it("does not affect unreviewed roles or a different written character",()=>{
    expect(reviewedContextualPreDrawReadingEligible(
      fond, profile(fond,"VERB","predicate"),{},null,
    )).toBe(true);
    expect(reviewedContextualPreDrawReadingEligible(
      bad,profile(bad,"ADJ","predicate"),{},null,
    )).toBe(true);
    expect(reviewedContextualPreDrawReadingEligible(
      fond,profile(fond,"ADJ","predicate"),{},null,
    )).toBe(false);
  });
});
