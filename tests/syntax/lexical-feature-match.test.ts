import { describe, expect, it } from "vitest";
import {
  lexicalConstructionFeatureMatches,
  supportsLexicalConstructionFeature,
} from "../../src/syntax/lexical-feature-match.js";
import type { RuntimeSyntaxProfile, Upos } from "../../src/syntax/types.js";

function profile(
  upos: Upos,
  relation: string,
  functions: RuntimeSyntaxProfile["functions"] = [],
): RuntimeSyntaxProfile {
  return {
    id: `profile:${upos}:${relation}`,
    entryId: "entry:test",
    upos,
    functions,
    valencyFrames: ["avalent"],
    dependencyEvidence: {
      dependencyRelationCounts: { [relation]: 1 },
      surfacePositionCounts: { medial: 1 },
    },
    provenanceIds: ["ud:test"],
  };
}

function matches(
  text: string,
  valueProfile: RuntimeSyntaxProfile,
  feature: Parameters<typeof lexicalConstructionFeatureMatches>[3],
  value: Parameters<typeof lexicalConstructionFeatureMatches>[4],
  entryId = `word:${text}:test`,
): boolean {
  return lexicalConstructionFeatureMatches(entryId, text, valueProfile, feature, value);
}

describe("lexical construction feature matching", () => {
  it("distinguishes closed-class case markers by form", () => {
    const caseAdp = profile("ADP", "case");
    expect(matches("把", caseAdp, "voice", "disposal")).toBe(true);
    expect(matches("在", caseAdp, "voice", "disposal")).toBe(false);
    expect(matches("比", caseAdp, "clauseType", "comparative")).toBe(true);
    expect(matches("從", caseAdp, "clauseType", "comparative")).toBe(false);
  });

  it("accepts both short and long passive evidence for 被", () => {
    expect(matches("被", profile("AUX", "aux:pass"), "voice", "passive")).toBe(true);
    expect(matches("被", profile("ADP", "case"), "voice", "passive")).toBe(true);
    expect(matches("被", profile("AUX", "aux"), "voice", "passive")).toBe(false);
  });

  it("keeps aspect 了 separate from sentence-final 了", () => {
    expect(matches(
      "了",
      profile("AUX", "aux"),
      "aspect",
      "marked",
      "word:了:ㄌㄜ5",
    )).toBe(true);
    expect(matches(
      "了",
      profile("PART", "discourse:sp"),
      "aspect",
      "marked",
      "word:了:ㄌㄜ5",
    )).toBe(false);
  });

  it("does not project the aspect license onto another reading of the same text", () => {
    const aspectProfile = profile("AUX", "aux");
    expect(matches("了", aspectProfile, "aspect", "marked", "word:了:ㄌㄜ5")).toBe(true);
    expect(matches("了", aspectProfile, "aspect", "marked", "word:了:ㄌㄧㄠ3")).toBe(false);
  });

  it("licenses only the polar particle form for polar-question slots", () => {
    const sentenceParticle = profile("PART", "discourse:sp");
    expect(matches("嗎", sentenceParticle, "questionType", "polar")).toBe(true);
    expect(matches("呢", sentenceParticle, "questionType", "polar")).toBe(false);
  });

  it("licenses bounded constituent-question forms rather than arbitrary nouns", () => {
    expect(matches("誰", profile("PRON", "nsubj"), "questionType", "constituent")).toBe(true);
    expect(matches("石頭", profile("NOUN", "nsubj"), "questionType", "constituent")).toBe(false);
  });

  it("uses relation evidence for directional complements", () => {
    expect(matches("出來", profile("VERB", "compound:dir"), "complementType", "directional"))
      .toBe(true);
    expect(matches("理論", profile("VERB", "xcomp"), "complementType", "directional"))
      .toBe(false);
  });

  it("keeps licensed feature pairs explicit", () => {
    expect(supportsLexicalConstructionFeature("voice", "passive")).toBe(true);
    expect(supportsLexicalConstructionFeature("questionType", "constituent")).toBe(true);
  });
});
