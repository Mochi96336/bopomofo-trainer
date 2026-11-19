import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG } from "../../src/app/generated/catalog.js";
import { compileExerciseInputPlan } from "../../src/practice/input-plan.js";
import { prepareVerifiedGuidedLexemePractice } from "../../src/readings/verified-guided-lexeme-practice.js";

const two=PRACTICE_CATALOG.filter(e=>
  e.id==="word:看:ㄎㄢ1" || e.id==="word:看:ㄎㄢ4");
const manifest={
  schemaVersion:"tier1-source-verified-guided-lexeme-targets-v1",
  sourceEdition:"20260929",
  policy:"isolated guided-only source-backed reading",
  pendingWordUposGroups:1,pendingReadingIdentities:2,
  sourceMatchStatusCounts:{"both-dictionaries-exact-reading":2},
  eligibleStandaloneGuidedReadings:2,
  excludedForIncompleteSourceEvidence:0,
  rows:two.map(e=>({
    entryId:e.id,word:e.prompt.text,
    verifiedSourceIds:{concised:"2550",revised:"04501"},
    activeUposesFromPendingConflict:["VERB"],
  })),
  excluded:[],productionPolicyChanged:false,
} as const;

describe("source-backed whole-lexeme guided typing target",()=>{
  it("keeps two readings as different fixed-input exercises without sentence inference",()=>{
    expect(two).toHaveLength(2);
    const prepared=prepareVerifiedGuidedLexemePractice(manifest,PRACTICE_CATALOG);
    expect(prepared.eligibleEntryIds).toHaveLength(2);
    for(const id of prepared.eligibleEntryIds){
      const exercise=prepared.exerciseFor(id,"standard");
      expect(exercise.mode).toBe("guided");
      expect(exercise.entries.map(e=>e.id)).toEqual([id]);
      expect(compileExerciseInputPlan(exercise).syllables.length)
        .toBe(exercise.entries[0]!.syllables.length);
    }
  });
  it("rejects unauthorized, missing and malformed source manifests",()=>{
    const compiled=prepareVerifiedGuidedLexemePractice(manifest,PRACTICE_CATALOG);
    expect(()=>compiled.exerciseFor("word:看:ㄎㄢ5","standard")).toThrow();
    expect(()=>compiled.exerciseFor(two[0]!.id,"")).toThrow();
    expect(()=>prepareVerifiedGuidedLexemePractice({
      ...manifest,rows:[manifest.rows[0],manifest.rows[0]]
    },PRACTICE_CATALOG)).toThrow();
    expect(()=>prepareVerifiedGuidedLexemePractice({
      ...manifest,rows:[{...manifest.rows[0],verifiedSourceIds:{concised:"",revised:"04501"}},manifest.rows[1]]
    },PRACTICE_CATALOG)).toThrow();
    expect(()=>prepareVerifiedGuidedLexemePractice({
      ...manifest,sourceEdition:"20260101"
    },PRACTICE_CATALOG)).toThrow();
    expect(()=>prepareVerifiedGuidedLexemePractice({
      ...manifest,productionPolicyChanged:true
    },PRACTICE_CATALOG)).toThrow();
  });
});
