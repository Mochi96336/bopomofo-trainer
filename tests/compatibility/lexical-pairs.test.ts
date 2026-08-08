import { describe, expect, it } from "vitest";
import {
  buildLexicalCompatibilityIndex,
  dependencyCompatibilityScore,
  lexicalCompatibilityMultiplier,
  surfaceCompatibilityScore,
  type LexicalCompatibilityArtifact,
} from "../../src/compatibility/lexical-pairs.js";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";

function artifact(): LexicalCompatibilityArtifact {
  const core = {
    adapterVersion: "fixture",
    schemaVersion: "ud-lexical-compatibility-v1" as const,
    source: { sourceId: "fixture" },
    candidateCount: 4,
    minimumPairCount: 2,
    surfaceObservationCount: 10,
    dependencyObservationCount: 8,
    surfacePairs: [{ leftText: "吃", rightText: "飯", count: 3, score: 0.8 }],
    dependencyPairs: [{
      headText: "吃",
      dependentText: "飯",
      relation: "obj",
      count: 3,
      score: 0.7,
    }],
  };
  return { ...core, determinismDigest: sha256Canonical(core) };
}

describe("lexical compatibility evidence", () => {
  it("indexes sparse surface and dependency associations", () => {
    const index = buildLexicalCompatibilityIndex(artifact());
    expect(surfaceCompatibilityScore(index, "吃", "飯")).toBe(0.8);
    expect(surfaceCompatibilityScore(index, "吃", "理論")).toBe(0);
    expect(dependencyCompatibilityScore(index, "吃", "飯", "obj")).toBe(0.7);
    expect(dependencyCompatibilityScore(index, "飯", "吃", "obj")).toBe(0);
  });

  it("treats absence of corpus evidence as neutral rather than illegal", () => {
    expect(lexicalCompatibilityMultiplier(0, 2)).toBe(1);
    expect(lexicalCompatibilityMultiplier(0.5, 2)).toBe(2);
    expect(lexicalCompatibilityMultiplier(1, 2)).toBe(3);
  });

  it("fails closed on stale or duplicate artifacts", () => {
    expect(() => buildLexicalCompatibilityIndex({
      ...artifact(),
      determinismDigest: "stale",
    })).toThrow(/stale or invalid/u);

    const value = artifact();
    const core = {
      ...value,
      surfacePairs: [...value.surfacePairs, ...value.surfacePairs],
    };
    const { determinismDigest: _ignored, ...withoutDigest } = core;
    expect(() => buildLexicalCompatibilityIndex({
      ...withoutDigest,
      determinismDigest: sha256Canonical(withoutDigest),
    })).toThrow(/duplicate surface pairs/u);
  });
});
