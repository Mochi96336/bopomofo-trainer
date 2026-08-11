import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import type { RandomSource } from "../../src/core/model.js";
import {
  createSentenceConstructionPracticePlan,
} from "../../src/curriculum/formal-syntax-construction-practice.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { CAUSATIVE_FINITE_CCOMP_VIEW } from "../../src/syntax/causative-construction-view.js";

class DeterministicRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

describe("packaged causative construction reachability", () => {
  it("realizes finite-ccomp causative practice from shipped catalog profiles", () => {
    const plan = createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
    );
    const result = composeFormalSyntaxUtterances({
      ...plan,
      eligibleEntries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      random: new DeterministicRandom(0x5ca1ab1e),
      maximumCandidates: 8,
      maximumAttempts: 512,
    });

    expect(
      result.candidates.length,
      `packaged causative practice was unreachable: ${result.fallbackReasons.join(", ")}`,
    ).toBeGreaterThan(0);

    const profilesById = new Map(SYNTAX_PROFILES.map((profile) => [profile.id, profile]));
    for (const candidate of result.candidates) {
      expect(candidate.kind).toBe("formal-syntax");
      expect(candidate.syntaxRootRuleId).toBe("sentence.declarative");
      expect(candidate.syntaxProfileIds).toBeDefined();
      const syntaxProfileIds = candidate.syntaxProfileIds ?? [];
      const selectedProfiles = syntaxProfileIds
        .map((profileId) => profilesById.get(profileId))
        .filter((profile) => profile !== undefined);
      expect(selectedProfiles).toHaveLength(syntaxProfileIds.length);
      expect(selectedProfiles.some((profile) =>
        profile.valencyFrames.includes("clausal-complement")
        && (profile.dependencyEvidence.morphologicalFeatureCounts?.["Voice=Cau"] ?? 0) > 0,
      )).toBe(true);
    }
  });
});
