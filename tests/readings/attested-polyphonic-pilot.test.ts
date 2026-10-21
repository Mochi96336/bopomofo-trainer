import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { blindReadingReviewCsv } from "../../research/prepare-attested-blind-review.js";
import {
  type AttestedTarget,
  selectVerifiedTarget,
  validateAttestedTargetRows,
  verifiedTargetTokens,
  verifiedTargetWeight,
} from "../../research/attested-target-selector.js";

const data=JSON.parse(readFileSync(
  "research/data/attested-polyphonic-target-pilot.json","utf8",
)) as {cases:AttestedTarget[]};
const rows=data.cases;

describe("attested natural-context Zhuyin pilot",()=>{
  it("anchors 17 exact corpus instances and four genuine differing readings",()=>{
    expect(rows).toHaveLength(17);
    expect(()=>validateAttestedTargetRows(rows)).not.toThrow();
    for(const char of ["好","行","種","給"]){
      const targets=rows.filter(x=>x.target.character===char);
      expect(new Set(targets.map(x=>x.target.goldZhuyin)).size).toBeGreaterThanOrEqual(2);
    }
    expect(rows.filter(x=>x.target.udPinyinTargetCheck==="conflict")).toHaveLength(10);
  });
  it("does not silently promote incorrect UD Translit into gold",()=>{
    const cases=[
      ["銀行","ㄏㄤˊ"],["種植","ㄓㄨㄥˋ"],["補給","ㄐㄧˇ"],
      ["給予","ㄐㄧˇ"],["愛好","ㄏㄠˋ"],["行列","ㄏㄤˊ"],
    ];
    for(const [word,reading] of cases){
      const matching=rows.filter(x=>x.target.writtenWord===word);
      expect(matching.length).toBeGreaterThan(0);
      for(const item of matching){
        expect(item.target.udPinyinTargetCheck).toBe("conflict");
        expect(item.target.goldZhuyin).toBe(reading);
      }
    }
  });
  it("extracts target-only Zhuyin tokens; does not guess a sentence-wide transcription",()=>{
    expect(verifiedTargetTokens("ㄓㄨㄥˋ")).toEqual([
      "zhuyin:ㄓ","zhuyin:ㄨ","zhuyin:ㄥ","tone:4",
    ]);
    expect(verifiedTargetTokens("ㄏㄤˊ")).toEqual(["zhuyin:ㄏ","zhuyin:ㄤ","tone:2"]);
    expect(verifiedTargetTokens("ㄐㄧˇ")).toEqual(["zhuyin:ㄐ","zhuyin:ㄧ","tone:3"]);
    expect(()=>verifiedTargetTokens("wrong")).toThrow();
  });
  it("never uses learner mistakes to relabel approved phonetics",()=>{
    const four=rows.find(x=>x.target.writtenWord==="種植")!;
    const original=JSON.stringify(four);
    const e={"tone:4":{attempts:16,errors:12}};
    expect(verifiedTargetWeight(four,e)).toBeGreaterThan(1);
    for(let i=0;i<128;i++){
      const selected=selectVerifiedTarget(rows,e,createSeededRandom("weight-does-not-label:"+i));
      expect(rows).toContain(selected);
      expect(selected.target.scope).toBe("verified-target-character-only");
    }
    expect(JSON.stringify(four)).toBe(original);
  });
  it("uses existing minimum attempts and learner boost cap",()=>{
    const four=rows.find(x=>x.target.goldZhuyin==="ㄓㄨㄥˋ")!;
    expect(verifiedTargetWeight(four,{})).toBe(1);
    expect(verifiedTargetWeight(four,{"tone:4":{attempts:3,errors:3}})).toBe(1);
    expect(verifiedTargetWeight(four,{"tone:4":{attempts:16,errors:12}})).toBe(1.45);
  });
  it("is reproducible and increases actual verified-target exposure",()=>{
    function count(evidence:Record<string,{attempts:number;errors:number}>, token:string){
      let hits=0;
      for(let i=0;i<4096;i++){
        const choice=selectVerifiedTarget(rows,evidence,
          createSeededRandom("pilot-fixed:"+i));
        if(verifiedTargetTokens(choice.target.goldZhuyin).includes(token))hits++;
      }
      return hits;
    }
    for(const token of ["tone:4","tone:3","zhuyin:ㄐ"]){
      const baseline=count({},token);
      const boosted=count({[token]:{attempts:16,errors:12}},token);
      expect(boosted).toBeGreaterThan(baseline);
    }
  });
  it("prepares an independent annotation sheet without leaked gold/transliteration",()=>{
    const csv=blindReadingReviewCsv(rows);
    const [header,...lines]=csv.trimEnd().split("\\n");
    expect(lines).toHaveLength(rows.length);
    expect(header).toContain("reviewer_reading");
    expect(header).not.toContain("gold");
    expect(header).not.toContain("Translit");
    expect(csv).toContain(rows[0]!.origin.sourceSentenceId);
    expect(csv).not.toContain("ㄓㄨㄥˋ");
    expect(csv).not.toContain("ㄏㄤˊ");
    expect(csv).not.toContain("yínxíng");
    expect(csv).not.toContain("dict.revised.moe.edu.tw");
  });
  it("fails closed on missing targets instead of generating invented readings",()=>{
    expect(()=>selectVerifiedTarget([],{},createSeededRandom("no-targets"))).toThrow();
    const modified=rows.map(x=>x);
    modified[0]={...modified[0]!,target:{...modified[0]!.target,goldZhuyin:"ㄐㄧˋ"}};
    modified[1]={...modified[1]!,id:modified[0]!.id};
    expect(()=>validateAttestedTargetRows(modified)).toThrow(/duplicate/);
  });
});
