import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";
import {
  evaluateBlindReadingDiagnostic, inferExistingReadingFrontier,
  type DiagnosticLexicon,
} from "../../scripts/audit-attested-gold-blind-reading.js";
import { validateAttestedBank, type ContextBank } from "../../scripts/prototype-attested-reading-selector.js";

const original=JSON.parse(readFileSync("research/attested-reading-pilot/cases.json","utf8")) as ContextBank;
function entry(form: string, reading: string, syllable: readonly string[]): CatalogEntry {
  return {id:catalogEntryId(form,reading),prompt:{text:form,locale:"zh-TW"},
    syllables:[{tokens:syllable}],tags:[],provenanceIds:[]};
}
function profile(e:CatalogEntry,upos:Upos):RuntimeSyntaxProfile {
  return {id:e.id+"/"+upos,entryId:e.id,upos,
    functions:["predicate"],valencyFrames:["avalent"],
    dependencyEvidence:{dependencyRelationCounts:{},surfacePositionCounts:{}},provenanceIds:[]};
}
const three=entry("種","ㄓㄨㄥ3",["zhuyin:ㄓ","zhuyin:ㄨ","zhuyin:ㄥ","tone:3"]);
const four=entry("種","ㄓㄨㄥ4",["zhuyin:ㄓ","zhuyin:ㄨ","zhuyin:ㄥ","tone:4"]);
const context:DiagnosticLexicon={
  entries:[three,four],profiles:[profile(three,"NOUN"),profile(four,"NOUN")],
};
interface UdEvidenceToken {
  tokenId:number; text:string; upos:string; headTokenId:number; deprel:string;
}
interface UndecidedSourceEvidence {
  cases:readonly {
    caseId:string;sourceSentId:string;sourceTokenId:number;
    sourceWord:string;sourceUpos:string;sourceCorpusBlobSha:string;
    rawUdEvidenceTokens:readonly UdEvidenceToken[];
    reviewStatus:string;untestedHypothesis:string;
  }[];
}
const undecided=JSON.parse(readFileSync(
  "research/attested-reading-pilot/unresolved-context-evidence.json","utf8"
)) as UndecidedSourceEvidence;

describe("real-word reading diagnostic must be gold-blind",()=>{
  it("reports multiple licensed pronunciations rather than guessing by source UPOS",()=>{
    const result=inferExistingReadingFrontier({
      word:"種",sourceUpos:"NOUN",targetOffset:0,
    },context);
    expect(result.frontierStatus).toBe("multiple-pronunciations");
    expect(result.distinctTargetPronunciations).toHaveLength(2);
  });
  it("does not use reviewed gold or UD transliteration in the prediction frontier",()=>{
    validateAttestedBank(original);
    const row=original.cases.find(x=>x.id==="gsd-012")!;
    const contextOfRow={word:row.sourceTokenText,sourceUpos:row.sourceTokenUpos,
      targetOffset:row.characterOffsetInToken};
    const blind=inferExistingReadingFrontier(contextOfRow,context);
    const wrongGold=structuredClone(original);
    const idx=wrongGold.cases.findIndex(x=>x.id===row.id);
    (wrongGold.cases[idx] as {reviewedCharacterZhuyin:string}).reviewedCharacterZhuyin="ㄓㄨㄥˋ";
    (wrongGold.cases[idx] as {sourceTokenTranslit:string}).sourceTokenTranslit="invented";
    // The annotation changes, but the candidate set is unchanged: no gold leakage.
    expect(inferExistingReadingFrontier(contextOfRow,context)).toEqual(blind);
    const a=evaluateBlindReadingDiagnostic(original,context).rows.find(x=>x.id===row.id)!;
    const b=evaluateBlindReadingDiagnostic(wrongGold,context).rows.find(x=>x.id===row.id)!;
    expect(a.distinctTargetPronunciations).toEqual(b.distinctTargetPronunciations);
    expect(a.frontierStatus).toBe(b.frontierStatus);
    expect(a.outcome).toBe("ambiguous-includes-reviewed-gold");
    expect(b.outcome).toBe("ambiguous-includes-reviewed-gold");
  });
  it("distinguishes a unique wrong prediction from an ambiguous but correct-containing frontier",()=>{
    const oneReading:DiagnosticLexicon={
      entries:[four],profiles:[profile(four,"NOUN")],
    };
    const r=evaluateBlindReadingDiagnostic(original,oneReading).rows.find(x=>x.id==="gsd-012")!;
    expect(r.frontierStatus).toBe("one-pronunciation");
    expect(r.outcome).toBe("unique-conflicts-with-reviewed-gold");
    const two=evaluateBlindReadingDiagnostic(original,context).rows.find(x=>x.id==="gsd-012")!;
    expect(two.outcome).toBe("ambiguous-includes-reviewed-gold");
  });
  it("marks mismatched source POS or absent whole written word as undetermined",()=>{
    expect(inferExistingReadingFrontier({word:"種",sourceUpos:"VERB",targetOffset:0},context)
      .frontierStatus).toBe("no-compatible-source-upos-profile");
    expect(inferExistingReadingFrontier({word:"不存在",sourceUpos:"NOUN",targetOffset:0},context)
      .frontierStatus).toBe("word-absent");
  });
  it("pins raw source dependency evidence for all 3 ambiguous cases without licensing a pronunciation",()=>{
    expect(undecided.cases.map(x=>x.caseId)).toEqual(["gsd-012","gsd-013","gsd-015"]);
    for(const cue of undecided.cases){
      const originalRow=original.cases.find(x=>x.id===cue.caseId)!;
      expect(cue.sourceSentId).toBe(originalRow.sourceSentId);
      expect(cue.sourceTokenId).toBe(originalRow.sourceTokenId);
      expect(cue.sourceWord).toBe(originalRow.sourceTokenText);
      expect(cue.sourceUpos).toBe(originalRow.sourceTokenUpos);
      expect(cue.sourceCorpusBlobSha).toBe(original.source.blobSha);
      expect(cue.reviewStatus).toBe("to-review");
      expect(cue.untestedHypothesis.length).toBeGreaterThan(15);
      expect(cue.rawUdEvidenceTokens.some(t=>
        t.tokenId===cue.sourceTokenId && t.text===cue.sourceWord)).toBe(true);
    }
    const seed=undecided.cases[0]!.rawUdEvidenceTokens;
    expect(seed).toEqual(expect.arrayContaining([
      expect.objectContaining({text:"兩",headTokenId:10,deprel:"nummod"}),
      expect.objectContaining({text:"種",tokenId:10,upos:"NOUN"}),
    ]));
    const beneficiary=undecided.cases[1]!.rawUdEvidenceTokens;
    expect(beneficiary).toEqual(expect.arrayContaining([
      expect.objectContaining({text:"給",tokenId:17,headTokenId:20,deprel:"advcl"}),
      expect.objectContaining({text:"分析",headTokenId:17,deprel:"obj"}),
      expect.objectContaining({text:"提供",tokenId:20,deprel:"root"}),
    ]));
    const transfer=undecided.cases[2]!.rawUdEvidenceTokens;
    expect(transfer).toEqual(expect.arrayContaining([
      expect.objectContaining({text:"交",tokenId:13,headTokenId:15,deprel:"advcl"}),
      expect.objectContaining({text:"給",tokenId:15,upos:"VERB"}),
      expect.objectContaining({text:"叔父",headTokenId:15,deprel:"obj"}),
    ]));
  });
});
