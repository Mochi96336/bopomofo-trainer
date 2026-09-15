import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { sha256Canonical } from "../../src/reference/importers/canonical-json.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
  validRuntimeOccurrenceCapabilities,
} from "../../src/syntax/runtime-occurrence-capabilities.js";
import {
  applyRuntimeOccurrenceCapabilityProjection,
  type RuntimeOccurrenceCapabilityProjectionArtifact,
} from "../../src/syntax/runtime-occurrence-capability-projection.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const SOURCE_DIGEST = "short-passive-current-main-test-source";

function shortPassiveArtifact(profileId: string): RuntimeOccurrenceCapabilityProjectionArtifact {
  const core = {
    schemaVersion: "runtime-occurrence-capability-projection-v1" as const,
    sourceProfileArtifactDigest: SOURCE_DIGEST,
    sourceProvenanceId: "ud:chinese-gsd-r2.18",
    sourceVersion: "r2.18",
    sourceCommit: "e0d85a020182e264d6384be2a59c0f4879a1cc35",
    reviewedCapability: SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
    evidenceContract: "same-predicate-aux-pass-bei-v1" as const,
    identityPolicy: "unique-active-entry-per-form-upos-v1" as const,
    profileCount: 1,
    entryCount: 1,
    profileIds: [profileId],
  };
  return { ...core, determinismDigest: sha256Canonical(core) };
}

describe("short-passive current-main integration", () => {
  it("keeps the reviewed capability in the runtime capability registry", () => {
    expect(validRuntimeOccurrenceCapabilities([
      "voice-cau-ccomp-same-occurrence",
      "ba-obl-patient-case-same-occurrence",
      "preverbal-auxiliary-same-occurrence",
      SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
    ])).toBe(true);
  });

  it("accepts reviewed short-passive evidence without reconstructing generic transitivity", () => {
    const profile: RuntimeSyntaxProfile = {
      id: "profile:short-passive",
      entryId: "entry:short-passive",
      upos: "VERB",
      functions: [],
      valencyFrames: [],
      provenanceIds: ["test"],
      dependencyEvidence: {
        dependencyRelationCounts: {},
        surfacePositionCounts: {},
        morphologicalFeatureCounts: {},
      },
    };
    const projected = applyRuntimeOccurrenceCapabilityProjection(
      [profile],
      SOURCE_DIGEST,
      shortPassiveArtifact(profile.id),
    );
    expect(projected[0]?.occurrenceCapabilities).toEqual([
      SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
    ]);
  });

  it("packages the complete reviewed 248-profile short-passive frontier", () => {
    const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
    const occurrenceBacked = SYNTAX_PROFILES.filter((profile) =>
      profile.occurrenceCapabilities?.includes(
        SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false,
    );

    expect(occurrenceBacked).toHaveLength(248);
    expect(new Set(occurrenceBacked.map((profile) => profile.entryId)).size).toBe(248);
    expect(occurrenceBacked.every((profile) => profile.upos === "VERB")).toBe(true);
    expect(occurrenceBacked.every((profile) => textByEntryId.has(profile.entryId))).toBe(true);
  });

  it("keeps short-passive capability out of canonical grammar consumers", () => {
    const consumers = FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents.filter((constituent) =>
        constituent.requiredOccurrenceCapabilities?.includes(
          SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
        ) ?? false,
      ).map((constituent) => `${rule.id}:${constituent.key}`),
    );
    expect(consumers).toEqual([]);
  });
});
