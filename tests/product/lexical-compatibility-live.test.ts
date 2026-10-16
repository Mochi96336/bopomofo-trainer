import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../../src/app/generated/catalog.js";
import { buildLexicalCompatibilityIndex, surfaceCompatibilityScore, type LexicalCompatibilityArtifact } from "../../src/compatibility/lexical-pairs.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import { createProductEnvironment } from "../../src/product/session.js";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";

function fixture(): LexicalCompatibilityArtifact {
  const core = {
    adapterVersion: "lexical-compatibility-test-only",
    schemaVersion: "ud-lexical-compatibility-v1" as const,
    source: { sourceId: "unit-fixture-not-UD-evidence" },
    candidateCount: 2,
    minimumPairCount: 1,
    surfaceObservationCount: 1,
    dependencyObservationCount: 0,
    surfacePairs: [{ leftText: "吃", rightText: "飯", count: 1, score: 1 }],
    dependencyPairs: [],
  };
  return { ...core, determinismDigest: sha256Canonical(core) };
}

describe("product lexical compatibility handoff", () => {
  const source = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };

  it("keeps the shipping product's prior sampler when no evidence is supplied", () => {
    const environment = createProductEnvironment(source);
    expect(environment.lexicalCompatibility).toBeUndefined();
  });

  it("validates a supplied source and preserves it across tier filtering", () => {
    const evidence = fixture();
    const environment = createProductEnvironment({ ...source, lexicalCompatibility: evidence });
    expect(environment.lexicalCompatibility).toBeDefined();
    expect(surfaceCompatibilityScore(environment.lexicalCompatibility!, "吃", "飯")).toBe(1);
    expect(surfaceCompatibilityScore(environment.lexicalCompatibility!, "吃", "理論")).toBe(0);
    expect(buildLexicalCompatibilityIndex(evidence)).toEqual(environment.lexicalCompatibility);

    const narrowed = catalogsForCommonnessTiers(
      { ...source, lexicalCompatibility: evidence }, COMMONNESS_TIER_THRESHOLDS, [1],
    );
    expect(narrowed.lexicalCompatibility).toBe(evidence);
    expect(createProductEnvironment(narrowed).lexicalCompatibility).toBeDefined();
  });

  it("fails closed on tampered source evidence instead of quietly enabling it", () => {
    const corrupted = { ...fixture(), determinismDigest: "unverified" };
    expect(() => createProductEnvironment({ ...source, lexicalCompatibility: corrupted }))
      .toThrow("stale or invalid");
  });
});
