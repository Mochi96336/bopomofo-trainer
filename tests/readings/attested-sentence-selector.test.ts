import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../../src/curriculum/random.js";
import type { LearnerBindingEvidence } from "../../src/curriculum/types.js";
import {
  attestedCaseTargetEntry,
  selectAttestedSentence,
  validateAttestedPolyphoneBank,
  type AttestedPolyphoneBank,
} from "../../src/research/attested-sentence-selector.js";

const bank = JSON.parse(readFileSync("data/research/attested-polyphones-v1.json", "utf8")) as AttestedPolyphoneBank;
function weakness(tokenId: string): readonly LearnerBindingEvidence[] {
  return [{
    scope: { mode: "guided", layoutId: "standard", tokenId },
    attempts: 16, errors: 12, timingSamples: 0,
    currentTimeToTypeMs: null, bestTimeToTypeMs: null,
  }];
}

describe("attested polyphonic natural-sentence candidate pilot", () => {
  it("requires 6 REAL within-character pronunciation contrasts, with exact lexeme spans and source provenance", () => {
    expect(() => validateAttestedPolyphoneBank(bank)).not.toThrow();
    expect(bank.cases).toHaveLength(12);
    expect(new Set(bank.cases.map(c => c.character))).toEqual(
      new Set(["行", "長", "重", "種", "樂", "好"]),
    );
    for (const target of new Set(bank.cases.map(c => c.character))) {
      expect(new Set(bank.cases.filter(c=>c.character===target)
        .map(c=>c.expectedZhuyin)).size).toBe(2);
    }
    for (const item of bank.cases) {
      expect(item.sentence.includes(item.lexeme)).toBe(true);
      expect(item.lexeme[item.targetCharIndex]).toBe(item.character);
      expect(item.ud.sentId.startsWith(item.ud.split + "-s")).toBe(true);
      expect(item.moeWordUrl).toContain("dict.revised.moe.edu.tw/dictView.jsp");
      expect(item.annotation.completeSentenceReadings).toBe("unreviewed");
      expect(item.annotation.naturalness).toBe("corpus_attested_not_independently_rated");
      expect(attestedCaseTargetEntry(item).syllables).toHaveLength(1);
    }
  });

  it("does not trust erroneous UD Translit as the pronunciation answer", () => {
    const knownMistransliterations = ["xing-bank", "chang-length", "zhong-again", "zhong-plant", "le-music", "hao-enthusiast"];
    const expected = ["ㄏㄤ2", "ㄔㄤ2", "ㄔㄨㄥ2", "ㄓㄨㄥ4", "ㄩㄝ4", "ㄏㄠ4"];
    for (let i = 0; i < knownMistransliterations.length; i++) {
      const item = bank.cases.find(c => c.id === knownMistransliterations[i]);
      expect(item?.ud.rawTranslitUntrusted).toBeTruthy();
      expect(item?.expectedZhuyin).toBe(expected[i]);
    }
    // A contradictory source transcript cannot overwrite a reviewed lexeme reading.
    const altered = structuredClone(bank) as AttestedPolyphoneBank;
    const sample = altered.cases.find(x=>x.id==="xing-bank")!;
    expect(sample.ud.rawTranslitUntrusted).toBe("yínxíng");
    expect(sample.expectedZhuyin).toBe("ㄏㄤ2");
  });

  it("rejects fake or incomplete pronunciation/source attestations", () => {
    const clone = structuredClone(bank);
    (clone.cases[0] as { targetCharIndex: number }).targetCharIndex = 0;
    expect(() => validateAttestedPolyphoneBank(clone)).toThrow("polyphone target");
    const clone2 = structuredClone(bank);
    (clone2.cases[0] as { expectedTokens: string[] }).expectedTokens = ["tone:4"];
    expect(() => validateAttestedPolyphoneBank(clone2)).toThrow("Zhuyin");
    const clone3 = structuredClone(bank);
    (clone3.cases[0] as { sentence: string }).sentence = "這是我自己新造的一句話。";
    expect(() => validateAttestedPolyphoneBank(clone3)).toThrow("exactly once");
  });

  it("uses original production learner-weight scoring without changing any approved reading", () => {
    const normal = selectAttestedSentence(bank, [], createSeededRandom("same-pilot-seed"));
    const fourth = selectAttestedSentence(bank, weakness("tone:4"), createSeededRandom("same-pilot-seed"));
    expect(normal.candidates.map(c=>({id:c.id,reading:c.expectedZhuyin})))
      .toEqual(fourth.candidates.map(c=>({id:c.id,reading:c.expectedZhuyin})));
    for (const item of bank.cases) {
      const normalWeight = normal.candidates.find(c=>c.id===item.id)!.weight;
      const fourthWeight = fourth.candidates.find(c=>c.id===item.id)!.weight;
      expect(normalWeight).toBe(1); // no commonness projection in this isolated pilot
      if (item.expectedTokens.includes("tone:4")) {
        expect(fourthWeight).toBeGreaterThan(normalWeight);
      } else {
        expect(fourthWeight).toBe(normalWeight);
      }
    }
    expect(normal.selected.id).toBe(selectAttestedSentence(
      bank, [], createSeededRandom("same-pilot-seed"),
    ).selected.id);
  });

  it("increases frequency of real fourth-tone practice targets over paired deterministic draws", () => {
    let baseline = 0, withWeakness = 0;
    for (let seed = 0; seed < 512; seed++) {
      const name = "attested-weakness-test:" + seed;
      const base = selectAttestedSentence(bank, [], createSeededRandom(name)).selected;
      const weak = selectAttestedSentence(bank, weakness("tone:4"), createSeededRandom(name)).selected;
      baseline += Number(base.expectedTokens.includes("tone:4"));
      withWeakness += Number(weak.expectedTokens.includes("tone:4"));
      expect(bank.cases.find(x => x.id === weak.id)?.expectedZhuyin).toBe(weak.expectedZhuyin);
    }
    expect(withWeakness).toBeGreaterThan(baseline);
  });
});
