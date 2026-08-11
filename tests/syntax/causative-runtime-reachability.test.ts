import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  summarizeCausativeRuntimeReachability,
} from "../../scripts/causative-runtime-reachability.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../../src/syntax/runtime-profiles.js";
import type { RuntimeSyntaxProfile, ValencyFrame } from "../../src/syntax/types.js";

function profile(
  id: string,
  entryId: string,
  valencyFrames: readonly ValencyFrame[],
  causative = true,
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos: "VERB",
    functions: ["predicate"],
    valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
      ...(causative ? { morphologicalFeatureCounts: { "Voice=Cau": 1 } } : {}),
    },
    provenanceIds: ["test"],
  };
}

describe("causative runtime reachability audit", () => {
  it("keeps predicate marking and embedding capabilities as an intersection", () => {
    const summary = summarizeCausativeRuntimeReachability([
      profile("ccomp-a", "entry:a", ["clausal-complement"]),
      profile("ccomp-a-2", "entry:a", ["clausal-complement"]),
      profile("object-xcomp", "entry:b", ["object-controlled-open-complement"]),
      profile("multi", "entry:c", [
        "clausal-complement",
        "subject-controlled-open-complement",
      ]),
      profile("none", "entry:d", ["transitive"]),
      profile("not-causative", "entry:e", ["clausal-complement"], false),
    ]);

    expect(summary).toEqual({
      reviewedFeature: "Voice=Cau",
      morphologyProfileCount: 5,
      morphologyEntryCount: 4,
      selectorSupport: {
        finiteCcomp: { profileCount: 3, entryCount: 2 },
        subjectControlledXcomp: { profileCount: 1, entryCount: 1 },
        objectControlledXcomp: { profileCount: 1, entryCount: 1 },
        untypedOpenXcomp: { profileCount: 0, entryCount: 0 },
      },
      noReviewedEmbeddingProfileCount: 1,
      multiSelectorProfileCount: 1,
    });
  });

  it("reports the packaged identity-safe Voice=Cau intersections without inventing support", () => {
    const artifact = JSON.parse(readFileSync(
      new URL("../../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url),
      "utf8",
    )) as ActiveCatalogSyntaxProfilesArtifact;
    expect(artifact.runtimeMorphologyProjection?.reviewedFeature).toBe("Voice=Cau");
    expect(artifact.runtimeMorphologyProjection?.identityPolicy)
      .toBe("unique-active-entry-per-form-upos-v1");

    const summary = summarizeCausativeRuntimeReachability(artifact.profiles);
    expect(summary.morphologyProfileCount).toBeGreaterThan(0);
    expect(summary.morphologyEntryCount).toBeGreaterThan(0);
    for (const support of Object.values(summary.selectorSupport)) {
      expect(support.profileCount).toBeLessThanOrEqual(summary.morphologyProfileCount);
      expect(support.entryCount).toBeLessThanOrEqual(summary.morphologyEntryCount);
    }
    expect(summary.noReviewedEmbeddingProfileCount).toBeLessThanOrEqual(summary.morphologyProfileCount);
    expect(summary.multiSelectorProfileCount).toBeLessThanOrEqual(summary.morphologyProfileCount);

    console.log(`causative-runtime-reachability ${JSON.stringify(summary)}`);
  });
});
