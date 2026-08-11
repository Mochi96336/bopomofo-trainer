import { describe, expect, it } from "vitest";
import {
  catalogEntryId,
  decodeSyntaxProfiles,
  encodeSyntaxProfiles,
} from "../../src/app/catalog-codec.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const syllables = [{ tokens: ["initial:ㄖ", "final:ㄤ", "tone:4"] }] as const;
const entry: CatalogEntry = {
  id: catalogEntryId("讓", syllables),
  prompt: { text: "讓", locale: "zh-TW" },
  syllables,
  tags: [],
  provenanceIds: [],
};

const profile: RuntimeSyntaxProfile = {
  id: "profile:讓",
  entryId: entry.id,
  upos: "VERB",
  functions: ["predicate"],
  valencyFrames: ["clausal-complement"],
  occurrenceCapabilities: ["voice-cau-ccomp-same-occurrence"],
  dependencyEvidence: {
    dependencyRelationCounts: { ccomp: 1 },
    surfacePositionCounts: { initial: 1 },
    morphologicalFeatureCounts: { "Voice=Cau": 1 },
  },
  provenanceIds: [],
};

describe("compact occurrence capability transport", () => {
  it("round-trips reviewed capability evidence as an optional eighth field", () => {
    const encoded = encodeSyntaxProfiles([profile], [entry]);
    expect(encoded.occurrenceCapabilityKeys).toEqual(["voice-cau-ccomp-same-occurrence"]);
    expect(encoded.profiles[0]?.length).toBe(8);

    const decoded = decodeSyntaxProfiles(
      encoded.profiles,
      [entry],
      encoded.relationKeys,
      encoded.positionKeys,
      encoded.morphologyKeys,
      encoded.occurrenceCapabilityKeys,
    );
    expect(decoded[0]?.occurrenceCapabilities).toEqual(["voice-cau-ccomp-same-occurrence"]);
    expect(decoded[0]?.dependencyEvidence.morphologicalFeatureCounts).toEqual({ "Voice=Cau": 1 });
  });

  it("keeps historical six-field tuples readable", () => {
    const decoded = decodeSyntaxProfiles([[0, 15, [], [], [], []]], [entry], [], []);
    expect(decoded[0]?.occurrenceCapabilities).toBeUndefined();
    expect(decoded[0]?.dependencyEvidence.morphologicalFeatureCounts).toBeUndefined();
  });

  it("rejects an unreviewed occurrence-capability key table", () => {
    expect(() => decodeSyntaxProfiles(
      [[0, 15, [], [], [], [], [], [0]]],
      [entry],
      [],
      [],
      [],
      ["made-up-capability"],
    )).toThrow(/unreviewed occurrence capability/u);
  });
});
