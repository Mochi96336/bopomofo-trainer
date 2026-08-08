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

describe("lexical construction feature matching", () => {
  it("distinguishes closed-class case markers by form", () => {
    const caseAdp = profile("ADP", "case");
    expect(lexicalConstructionFeatureMatches("把", caseAdp, "voice", "disposal")).toBe(true);
    expect(lexicalConstructionFeatureMatches("在", caseAdp, "voice", "disposal")).toBe(false);
    expect(lexicalConstructionFeatureMatches("比", caseAdp, "clauseType", "comparative")).toBe(true);
    expect(lexicalConstructionFeatureMatches("從", caseAdp, "clauseType", "comparative")).toBe(false);
  });

  it("accepts both short and long passive evidence for 被", () => {
    expect(lexicalConstructionFeatureMatches(
      "被",
      profile("AUX", "aux:pass"),
      "voice",
      "passive",
    )).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      "被",
      profile("ADP", "case"),
      "voice",
      "passive",
    )).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      "被",
      profile("AUX", "aux"),
      "voice",
      "passive",
    )).toBe(false);
  });

  it("keeps aspect 了 separate from sentence-final 了", () => {
    expect(lexicalConstructionFeatureMatches(
      "了",
      profile("AUX", "aux"),
      "aspect",
      "marked",
    )).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      "了",
      profile("PART", "discourse:sp"),
      "aspect",
      "marked",
    )).toBe(false);
  });

  it("licenses only the polar particle form for polar-question slots", () => {
    const sentenceParticle = profile("PART", "discourse:sp");
    expect(lexicalConstructionFeatureMatches(
      "嗎",
      sentenceParticle,
      "questionType",
      "polar",
    )).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      "呢",
      sentenceParticle,
      "questionType",
      "polar",
    )).toBe(false);
  });

  it("uses relation evidence for directional complements", () => {
    expect(lexicalConstructionFeatureMatches(
      "出來",
      profile("VERB", "compound:dir"),
      "complementType",
      "directional",
    )).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      "理論",
      profile("VERB", "xcomp"),
      "complementType",
      "directional",
    )).toBe(false);
  });

  it("keeps licensed feature pairs explicit", () => {
    expect(supportsLexicalConstructionFeature("voice", "passive")).toBe(true);
    expect(supportsLexicalConstructionFeature("questionType", "constituent")).toBe(false);
  });
});
