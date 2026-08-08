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
  entryId: string | undefined = `word:${text}:test`,
): boolean {
  return lexicalConstructionFeatureMatches(entryId, text, valueProfile, feature, value);
}

describe("lexical construction feature matching", () => {
  it("distinguishes closed-class case markers by form", () => {
    const caseAdp = profile("ADP", "case");
    expect(matches("把", caseAdp, "voice", "disposal", "word:把:ㄅㄚ3")).toBe(true);
    expect(matches("在", caseAdp, "voice", "disposal")).toBe(false);
    expect(matches("比", caseAdp, "clauseType", "comparative", "word:比:ㄅㄧ3")).toBe(true);
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

  // UD evidence is keyed by written form, so each of these profiles is shared
  // verbatim by every reading of its homograph in the committed artifact.
  const homographs: readonly {
    readonly text: string;
    readonly licensedReading: string;
    readonly unlicensedReading: string;
    readonly profile: RuntimeSyntaxProfile;
    readonly feature: Parameters<typeof lexicalConstructionFeatureMatches>[3];
    readonly value: Parameters<typeof lexicalConstructionFeatureMatches>[4];
  }[] = [
    {
      text: "的",
      licensedReading: "ㄉㄜ5",
      unlicensedReading: "ㄉㄧ4",
      profile: profile("SCONJ", "mark:rel"),
      feature: "clauseType",
      value: "relative",
    },
    {
      text: "著",
      licensedReading: "ㄓㄜ5",
      unlicensedReading: "ㄓㄨㄛ2",
      profile: profile("AUX", "aux"),
      feature: "aspect",
      value: "marked",
    },
    {
      text: "過",
      licensedReading: "ㄍㄨㄛ4",
      unlicensedReading: "ㄍㄨㄛ1",
      profile: profile("AUX", "aux"),
      feature: "aspect",
      value: "marked",
    },
    {
      text: "把",
      licensedReading: "ㄅㄚ3",
      unlicensedReading: "ㄅㄚ4",
      profile: profile("ADP", "case"),
      feature: "voice",
      value: "disposal",
    },
    {
      text: "將",
      licensedReading: "ㄐㄧㄤ1",
      unlicensedReading: "ㄑㄧㄤ1",
      profile: profile("ADP", "case"),
      feature: "voice",
      value: "disposal",
    },
    {
      text: "比",
      licensedReading: "ㄅㄧ3",
      unlicensedReading: "ㄅㄧ1",
      profile: profile("ADP", "case"),
      feature: "clauseType",
      value: "comparative",
    },
    {
      text: "嗎",
      licensedReading: "ㄇㄚ5",
      unlicensedReading: "ㄇㄚ3",
      profile: profile("PART", "discourse:sp"),
      feature: "questionType",
      value: "polar",
    },
    {
      text: "沒",
      licensedReading: "ㄇㄟ2",
      unlicensedReading: "ㄇㄛ4",
      profile: profile("ADV", "advmod"),
      feature: "polarity",
      value: "negative",
    },
    {
      text: "得",
      licensedReading: "ㄉㄜ5",
      unlicensedReading: "ㄉㄟ3",
      profile: profile("PART", "compound:ext"),
      feature: "complementType",
      value: "potential",
    },
    {
      text: "和",
      licensedReading: "ㄏㄜ2",
      unlicensedReading: "ㄏㄨㄛ4",
      profile: profile("CCONJ", "cc"),
      feature: "coordinationType",
      value: "coordination",
    },
    {
      text: "哪",
      licensedReading: "ㄋㄚ3",
      unlicensedReading: "ㄋㄜ2",
      profile: profile("PRON", "det"),
      feature: "questionType",
      value: "constituent",
    },
  ];

  it.each(homographs)(
    "licenses $text only as $licensedReading, not $unlicensedReading",
    ({ text, licensedReading, unlicensedReading, profile: entryProfile, feature, value }) => {
      expect(matches(text, entryProfile, feature, value, `word:${text}:${licensedReading}`))
        .toBe(true);
      expect(matches(text, entryProfile, feature, value, `word:${text}:${unlicensedReading}`))
        .toBe(false);
    },
  );

  it("licenses a narrower negator for A-not-A than for a negative clause", () => {
    const adverbialNegator = profile("ADV", "advmod");
    for (const [text, entryId] of [
      ["不", "word:不:ㄅㄨ4"],
      ["沒", "word:沒:ㄇㄟ2"],
    ] as const) {
      expect(matches(text, adverbialNegator, "polarity", "negative", entryId)).toBe(true);
      expect(matches(text, adverbialNegator, "questionType", "a-not-a", entryId)).toBe(true);
    }
    // 別/未/非/無 negate a clause but never form V-neg-V.
    for (const [text, entryId] of [
      ["別", "word:別:ㄅㄧㄝ2"],
      ["未", "word:未:ㄨㄟ4"],
      ["非", "word:非:ㄈㄟ1"],
      ["無", "word:無:ㄨ2"],
    ] as const) {
      expect(matches(text, adverbialNegator, "polarity", "negative", entryId)).toBe(true);
      expect(matches(text, adverbialNegator, "questionType", "a-not-a", entryId)).toBe(false);
    }
  });

  it("fails a pinned construction form closed when the identity is unknown", () => {
    expect(matches("的", profile("SCONJ", "mark:rel"), "clauseType", "relative", undefined))
      .toBe(false);
  });

  it("licenses only the polar particle form for polar-question slots", () => {
    const sentenceParticle = profile("PART", "discourse:sp");
    expect(matches("嗎", sentenceParticle, "questionType", "polar", "word:嗎:ㄇㄚ5")).toBe(true);
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
