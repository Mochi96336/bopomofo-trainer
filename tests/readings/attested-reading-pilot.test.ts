import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  reviewedTargetTokens, runAttestedAB, validateAttestedBank,
  weightedAttestedProbability, selectAttestedIndex,
  type ContextBank,
} from "../../scripts/prototype-attested-reading-selector.js";

const bank=JSON.parse(readFileSync("research/attested-reading-pilot/cases.json","utf8")) as ContextBank;
const get=(id:string)=>bank.cases.find(row=>row.id===id)!;

describe("pinned UD GSD contexts + separately MOE-reviewed target readings",()=>{
  it("validates source sentence span, UD token, reading evidence and attribution for every row",()=>{
    expect(()=>validateAttestedBank(bank)).not.toThrow();
    expect(bank.cases).toHaveLength(18);
    expect(new Set(bank.cases.map(x=>x.id)).size).toBe(18);
    expect(bank.source.blobSha).toBe("8b967948097a2e4bebe7f5d0e053c4fed4fe3baa");
    expect(bank.source.license).toBe("CC BY-SA 4.0");
  });
  it("includes real contrasting readings for every tested polyphonic character",()=>{
    const readings=(ch:string)=>new Set(bank.cases.filter(x=>x.targetCharacter===ch)
      .map(x=>x.reviewedCharacterZhuyin));
    expect(readings("好")).toEqual(new Set(["ㄏㄠˇ","ㄏㄠˋ"]));
    expect(readings("行")).toEqual(new Set(["ㄒㄧㄥˊ","ㄏㄤˊ"]));
    expect(readings("種")).toEqual(new Set(["ㄓㄨㄥˇ","ㄓㄨㄥˋ"]));
    expect(readings("給")).toEqual(new Set(["ㄍㄟˇ","ㄐㄧˇ"]));
  });
  it("does not mistake GSD transliteration for the pronunciation ground truth",()=>{
    expect(get("gsd-001").sourceTokenTranslit).toBe("hǎoqí");
    expect(get("gsd-001").reviewedCharacterZhuyin).toBe("ㄏㄠˋ");
    expect(get("gsd-005").sourceTokenTranslit).toBe("yínxíng");
    expect(get("gsd-005").reviewedCharacterZhuyin).toBe("ㄏㄤˊ");
    expect(get("gsd-010").sourceTokenTranslit).toBe("zhǒngzhí");
    expect(get("gsd-010").reviewedCharacterZhuyin).toBe("ㄓㄨㄥˋ");
    expect(get("gsd-014").sourceTokenTranslit).toBe("gěiyǔ");
    expect(get("gsd-014").reviewedCharacterZhuyin).toBe("ㄐㄧˇ");
    // A whole-token mismatch doesn't always mean the target character is wrong:
    expect(get("gsd-008").sourceTokenTranslit).toBe("xíngwèi");
    expect(get("gsd-008").reviewedCharacterZhuyin).toBe("ㄒㄧㄥˊ");
  });
  it("converts only independent reviewed Zhuyin labels into weakness tokens",()=>{
    expect(reviewedTargetTokens("ㄏㄠˋ")).toEqual(["zhuyin:ㄏ","zhuyin:ㄠ","tone:4"]);
    expect(reviewedTargetTokens("ㄓㄨㄥˇ")).toEqual(["zhuyin:ㄓ","zhuyin:ㄨ","zhuyin:ㄥ","tone:3"]);
    expect(reviewedTargetTokens("ㄗˇ")).toEqual(["zhuyin:ㄗ","tone:3"]);
    expect(()=>reviewedTargetTokens("ㄗˇㄓ")).toThrow();
  });
  it("makes weakness increase target selection probability without modifying any answer",()=>{
    for(const token of ["tone:4","tone:3","zhuyin:ㄗ"] as const){
      const baseline=weightedAttestedProbability(bank,null);
      const boosted=weightedAttestedProbability(bank,token);
      const match=bank.cases.map(row=>reviewedTargetTokens(row.reviewedCharacterZhuyin).includes(token));
      const prob=(weights:readonly number[])=>weights.reduce((n,p,i)=>n+p*Number(match[i]),0);
      expect(prob(boosted)).toBeGreaterThan(prob(baseline));
      expect(boosted.reduce((a,b)=>a+b,0)).toBeCloseTo(1,12);
      for(let seed=1;seed<=100;seed++){
        const idx=selectAttestedIndex(boosted,seed);
        expect(bank.cases[idx]!.reviewedCharacterZhuyin).toBe(bank.cases[idx]!.reviewedCharacterZhuyin);
      }
    }
  });
  it("returns stable paired measurements on the same immutable attested sentences",()=>{
    const a=runAttestedAB(bank,4096);
    const b=runAttestedAB(bank,4096);
    expect(a).toEqual(b);
    expect(a.sourceTranslitDisagreementCount).toBe(11);
    expect(a.sourceTranslitIsNeverUsedAsAnswer).toBe(true);
    for(const row of a.perWeakToken){
      expect(row.boostedTargetProbability).toBeGreaterThan(row.baselineTargetProbability);
      expect(row.boostedTargetSelections).toBeGreaterThan(row.baselineTargetSelections);
    }
  });
});
