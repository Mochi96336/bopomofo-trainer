import { describe, expect, it } from "vitest";
import { buildSelectedMoeHeadwordCoverage, type Projection,
  type SelectedExposureReport } from "../../src/readings/selected-moe-headword-coverage.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";

const good=catalogEntryId("好","ㄏㄠ3");
const rare=catalogEntryId("個","ㄍㄜ3");
const noProjection=catalogEntryId("大","ㄉㄞ4");
const revisedMatch=catalogEntryId("南","ㄋㄢ2");
const revisedDifference=catalogEntryId("南","ㄋㄚ2");

function fixture(){
  const sentences=Array.from({length:2048},(_,seedIndex)=>({
    seedIndex,text:"好",root:"sentence.declarative",entryIds:[good],
  }));
  sentences[0]={...sentences[0]!,text:"個",entryIds:[rare]};
  sentences[1]={...sentences[1]!,text:"大",entryIds:[noProjection]};
  sentences[2]={...sentences[2]!,text:"南",entryIds:[revisedMatch]};
  sentences[3]={...sentences[3]!,text:"南",entryIds:[revisedDifference]};
  const audit:SelectedExposureReport={
    schemaVersion:"polyphonic-context-exposure-v1",readingEligibilityPolicy:"standard-role-evidence-trial",
    sampleCount:2048,catalogEntryCount:100,successfulSentences:2048,failedSentences:0,sentences,
  };
  const concised:Projection={
    adapterVersion:"moe-concised-reading-adapter-v1",
    rows:[
      {lookupText:"好",trainerReading:"ㄏㄠ3",sourceEntryId:"moe-c1"},
      {lookupText:"個",trainerReading:"ㄍㄜ4",sourceEntryId:"moe-c2"},
    ],
  };
  const revised:Projection={
    adapterVersion:"moe-revised-reading-fallback-adapter-v1",
    rows:[{lookupText:"南",trainerReading:"ㄋㄢ2",sourceEntryId:"moe-r1",fallbackStatus:"provisional"}],
  };
  return {audit,concised,revised};
}

describe("selected MOE headword projection coverage is evidence, not a deletion policy",()=>{
  it("tracks all selected slots and keeps rare, valid heteronyms as REVIEW leads",()=>{
    const {audit,concised,revised}=fixture();
    const result=buildSelectedMoeHeadwordCoverage(audit,concised,revised);
    expect(result.totalSelectedOccurrences).toBe(2048);
    expect(result.uniqueSelectedIdentities).toBe(5);
    expect(result.countByStatus).toEqual({
      "matches-concised-projection":1,
      "differs-from-concised-projection":1,
      "matches-revised-fallback-projection":1,
      "differs-from-revised-fallback-projection":1,
      "not-in-exact-headword-projections":1,
    });
    const byId=new Map(result.identities.map(row=>[row.entryId,row]));
    expect(byId.get(rare)?.status).toBe("differs-from-concised-projection");
    expect(byId.get(rare)?.needsReferenceReview).toBe(true);
    expect(byId.get(rare)?.selectedExamples[0]).toEqual({
      seedIndex:0,lexicalSlot:0,sentence:"個",
    });
    // The MOE Revised dictionary licenses 個/ㄍㄜ3 in 自個兒,
    // despite this deliberately restricted one-reading Concised projection.
    expect(byId.get(revisedDifference)?.status).toBe("differs-from-revised-fallback-projection");
    expect(byId.get(noProjection)?.status).toBe("not-in-exact-headword-projections");
    expect(byId.get(good)?.occurrences).toBe(2044);
    expect(result.reviewedAsIncorrectCount).toBe(0);
    expect(result.caveat).toMatch(/never proof of invalid pronunciation/);
  });
  it("refuses truncated, reordered, or non-shipping population rather than undercounting",()=>{
    const {audit,concised,revised}=fixture();
    expect(()=>buildSelectedMoeHeadwordCoverage({...audit,sentences:audit.sentences.slice(1)},concised,revised))
      .toThrow(/successful exact 2048/);
    expect(()=>buildSelectedMoeHeadwordCoverage({...audit,readingEligibilityPolicy:"standard-nan-trial"},concised,revised))
      .toThrow(/successful exact 2048/);
    const malformed=[...audit.sentences];
    malformed[1]={...malformed[1]!,seedIndex:10};
    expect(()=>buildSelectedMoeHeadwordCoverage({...audit,sentences:malformed},concised,revised))
      .toThrow(/unaligned/);
  });
  it("refuses ambiguous and overlapping projection rows",()=>{
    const {audit,concised,revised}=fixture();
    expect(()=>buildSelectedMoeHeadwordCoverage(audit,{
      ...concised,rows:[...concised.rows,concised.rows[0]!],
    },revised)).toThrow(/ambiguous exact-headword/);
    expect(()=>buildSelectedMoeHeadwordCoverage(audit,concised,{
      ...revised,rows:[...revised.rows,{...revised.rows[0]!,lookupText:"好"}],
    })).toThrow(/overlapping source projections/);
  });
  it("rejects Revised fallback missing its provisional provenance",()=>{
    const {audit,concised,revised}=fixture();
    expect(()=>buildSelectedMoeHeadwordCoverage(audit,concised,{
      ...revised,rows:[{...revised.rows[0]!,fallbackStatus:"confirmed"}],
    })).toThrow(/explicitly provisional/);
  });
});
