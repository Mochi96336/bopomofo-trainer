import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../../src/curriculum/random.js";
import type { LearnerBindingEvidence } from "../../src/curriculum/types.js";
import {
  projectedTargetEntry,
  scoreAttestedReadingCandidates,
  selectAttestedReading,
  targetReadingTokens,
  validateAttestedCases,
  type AttestedReadingCase,
} from "../../src/research/attested-reading-selector.js";

const rows = (JSON.parse(readFileSync("research/attested-context-v1.json", "utf8")) as {
  rows: AttestedReadingCase[];
}).rows;

function evidence(tokenId: string): readonly LearnerBindingEvidence[] {
  return [{
    scope: { mode: "guided", layoutId: "standard", tokenId },
    attempts: 16, errors: 12, timingSamples: 0,
    currentTimeToTypeMs: null, bestTimeToTypeMs: null,
  }];
}
function find(id: string): AttestedReadingCase {
  const row = rows.find(row => row.source.sentenceId === id);
  if (!row) throw new Error("required provenance missing " + id);
  return row;
}

describe("attested corpus source and independently anchored target readings", () => {
  it("keeps 12 pinned examples across all four polyphonic characters and a separate test holdout", () => {
    expect(() => validateAttestedCases(rows)).not.toThrow();
    expect(rows).toHaveLength(12);
    expect(new Set(rows.map(x => x.targetCharacter))).toEqual(new Set(["好", "行", "種", "給"]));
    expect(rows.filter(x => x.source.split === "test")).toHaveLength(3);
    for (const r of rows) {
      expect(r.excerpt).toContain(r.targetLexeme);
      expect([...r.targetLexeme][r.characterIndexInLexeme]).toBe(r.targetCharacter);
      expect(r.source.blobSha).toMatch(/^[0-9a-f]{40}$/);
      expect(r.readingEvidence.url).toContain("dict.revised.moe.edu.tw");
      expect(r.labelScope).toBe("target_character_only_not_full_sentence");
    }
  });

  it("pins genuine contrasting readings, including two standalone NOUN 行 contexts", () => {
    expect(find("train-s20").characterReading).toBe("ㄒㄧㄥˊ");
    expect(find("dev-s231").characterReading).toBe("ㄏㄤˊ");
    expect(find("train-s20").source.sourceUpos).toBe("NOUN");
    expect(find("dev-s231").source.sourceUpos).toBe("NOUN");
    expect(find("train-s715").characterReading).toBe("ㄏㄠˇ");
    expect(find("test-s416").characterReading).toBe("ㄏㄠˋ");
    expect(find("dev-s80").characterReading).toBe("ㄓㄨㄥˇ");
    expect(find("dev-s188").characterReading).toBe("ㄓㄨㄥˋ");
    expect(find("train-s1").characterReading).toBe("ㄍㄟˇ");
    expect(find("dev-s278").characterReading).toBe("ㄐㄧˇ");
  });

  it("does NOT treat GSD pinyin or UPOS as gold pronunciation labels", () => {
    const sourceWrong = find("dev-s231");
    expect(sourceWrong.source.sourceTransliterationUnverified).toBe("xíng");
    expect(projectedTargetEntry(sourceWrong).syllables[0]?.tokens).toEqual([
      "zhuyin:ㄏ", "zhuyin:ㄤ", "tone:2",
    ]);
    const mislabelledUpos = find("test-s335");
    expect(mislabelledUpos.source.sourceUpos).toBe("PART");
    expect(mislabelledUpos.characterReading).toBe("ㄏㄠˇ");
    const newRaw = {
      ...sourceWrong, source: { ...sourceWrong.source, sourceTransliterationUnverified: "nonsense" },
    };
    expect(projectedTargetEntry(newRaw).syllables)
      .toEqual(projectedTargetEntry(sourceWrong).syllables);
  });

  it("rejects corrupted evidence or ambiguous lexeme locations instead of guessing", () => {
    expect(() => validateAttestedCases([...rows, rows[0]!])).toThrow("duplicate");
    const bad = { ...rows[0]!, excerpt: "完全不包含目標詞" };
    expect(() => validateAttestedCases([bad, ...rows.slice(1)])).toThrow("target word");
    expect(() => targetReadingTokens("ㄏㄠˇ ㄒㄧㄥˊ")).toThrow("single Bopomofo syllable");
    expect(targetReadingTokens("ㄐㄧˇ")).toEqual(["zhuyin:ㄐ", "zhuyin:ㄧ", "tone:3"]);
  });
});

describe("pronunciation first, real policy weighting second (nonproduction prototype)", () => {
  const baseline = scoreAttestedReadingCandidates(rows, []);
  const boosted = scoreAttestedReadingCandidates(rows, evidence("tone:4"));

  it("holds out the test split from practice selection", () => {
    expect(baseline).toHaveLength(9);
    expect(baseline.every(x => x.example.source.split !== "test")).toBe(true);
    expect(baseline.map(x => x.example.id))
      .toEqual(boosted.map(x => x.example.id));
  });

  it("may reweight correctly labeled fourth-tone cases but NEVER relabel them", () => {
    expect(baseline.map(x => x.expectedTokens)).toEqual(boosted.map(x => x.expectedTokens));
    expect(baseline.map(x => x.example.characterReading))
      .toEqual(boosted.map(x => x.example.characterReading));
    const legalTone4 = boosted.filter(x => x.expectedTokens.includes("tone:4"));
    const unboosted = baseline.filter(x => x.expectedTokens.includes("tone:4"));
    expect(legalTone4.length).toBeGreaterThan(0);
    for (let i=0;i<legalTone4.length;i++) {
      expect(legalTone4[i]!.score.totalWeight).toBeGreaterThan(unboosted[i]!.score.totalWeight);
    }
    // No amount of fourth-tone mistakes can make the attested good-quality 好 a fourth-tone answer.
    const good = boosted.find(x => x.example.source.sentenceId === "train-s715")!;
    expect(good.example.characterReading).toBe("ㄏㄠˇ");
    expect(good.expectedTokens).toContain("tone:3");
    expect(good.expectedTokens).not.toContain("tone:4");
  });

  it("reuses deterministic production weightedPick and preserves every selected gold reading", () => {
    const selected = Array.from({length:32},(_,i)=>selectAttestedReading(
      boosted,createSeededRandom("reading-test:"+i),
    ));
    const again = Array.from({length:32},(_,i)=>selectAttestedReading(
      boosted,createSeededRandom("reading-test:"+i),
    ));
    expect(selected.map(x=>x.example.id)).toEqual(again.map(x=>x.example.id));
    expect(selected.every(x=>x.example.characterReading
      === rows.find(row=>row.id===x.example.id)?.characterReading)).toBe(true);
  });
});
