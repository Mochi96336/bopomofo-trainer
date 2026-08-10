import { describe, expect, it } from "vitest";
import {
  decodeSyntaxProfiles,
  encodeSyntaxProfiles,
} from "../../src/app/catalog-codec.js";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  lexicalConstructionFeatureMatches,
  supportsLexicalConstructionFeature,
} from "../../src/syntax/lexical-feature-match.js";
import {
  projectRuntimeMorphologicalFeatureCounts,
  validRuntimeMorphologicalFeatureCounts,
} from "../../src/syntax/runtime-morphology.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const ENTRY: CatalogEntry = {
  id: "word:讓:ㄖㄤ4",
  prompt: { text: "讓", locale: "zh-TW" },
  syllables: [{ tokens: ["initial:ㄖ", "medial:ㄤ", "tone:4"] }],
  tags: [],
  provenanceIds: [],
};

function profile(morphology?: Readonly<Record<string, number>>): RuntimeSyntaxProfile {
  return {
    id: "runtime:test:讓",
    entryId: ENTRY.id,
    upos: "VERB",
    functions: ["predicate"],
    valencyFrames: ["clausal-complement"],
    dependencyEvidence: {
      dependencyRelationCounts: { ccomp: 1 },
      surfacePositionCounts: { medial: 1 },
      ...(morphology === undefined ? {} : { morphologicalFeatureCounts: morphology }),
    },
    provenanceIds: ["ud:chinese-gsd:r2.18"],
  };
}

describe("reviewed runtime morphology", () => {
  it("projects only reviewed morphology and normalizes positive counts to presence", () => {
    expect(projectRuntimeMorphologicalFeatureCounts({
      "Voice=Cau": 7,
      "Aspect=Perf": 12,
    })).toEqual({ "Voice=Cau": 1 });
    expect(projectRuntimeMorphologicalFeatureCounts({ "Aspect=Perf": 12 })).toBeUndefined();
  });

  it("rejects unreviewed or non-presence runtime morphology", () => {
    expect(validRuntimeMorphologicalFeatureCounts(undefined)).toBe(true);
    expect(validRuntimeMorphologicalFeatureCounts({ "Voice=Cau": 1 })).toBe(true);
    expect(validRuntimeMorphologicalFeatureCounts({ "Voice=Cau": 2 })).toBe(false);
    expect(validRuntimeMorphologicalFeatureCounts({ "Aspect=Perf": 1 })).toBe(false);
  });

  it("licenses causative voice only from exact source morphology", () => {
    expect(supportsLexicalConstructionFeature("voice", "causative")).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      ENTRY.id,
      ENTRY.prompt.text,
      profile({ "Voice=Cau": 1 }),
      "voice",
      "causative",
    )).toBe(true);
    expect(lexicalConstructionFeatureMatches(
      ENTRY.id,
      ENTRY.prompt.text,
      profile(),
      "voice",
      "causative",
    )).toBe(false);
    expect(lexicalConstructionFeatureMatches(
      ENTRY.id,
      ENTRY.prompt.text,
      profile({ "Aspect=Perf": 1 }),
      "voice",
      "causative",
    )).toBe(false);
  });

  it("keeps pre-morphology 6-tuples readable and emits a seventh field only when needed", () => {
    const legacy = encodeSyntaxProfiles([profile()], [ENTRY]);
    expect(legacy.morphologyKeys).toEqual([]);
    expect(legacy.profiles[0]).toHaveLength(6);

    const reviewed = encodeSyntaxProfiles([profile({ "Voice=Cau": 5 })], [ENTRY]);
    expect(reviewed.morphologyKeys).toEqual(["Voice=Cau"]);
    expect(reviewed.profiles[0]).toHaveLength(7);
    expect(decodeSyntaxProfiles(
      reviewed.profiles,
      [ENTRY],
      reviewed.relationKeys,
      reviewed.positionKeys,
      reviewed.morphologyKeys,
    )[0]?.dependencyEvidence.morphologicalFeatureCounts).toEqual({ "Voice=Cau": 1 });

    const legacyDecoded = decodeSyntaxProfiles(
      [[0, 15, [3], [6], [0], [0]]],
      [ENTRY],
      ["ccomp"],
      ["medial"],
    );
    expect(legacyDecoded[0]?.dependencyEvidence.morphologicalFeatureCounts).toEqual({});
  });
});
