import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import {
  ACTIVE_CAUSATIVE_CONSTRUCTION_VIEWS,
  CAUSATIVE_FINITE_CCOMP_VIEW,
  rulesForFormalSyntaxConstructionView,
} from "../../src/syntax/causative-construction-view.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { syntaxProfileMatchesRequirements } from "../../src/syntax/profile-match.js";
import {
  CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY,
} from "../../src/syntax/runtime-occurrence-capabilities.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const STABLE_RANDOM = { next: () => 0.999 };

function profile(
  id: string,
  options: {
    readonly ccomp: boolean;
    readonly occurrenceCapability: boolean;
    readonly aggregateVoiceCau?: boolean;
  },
): RuntimeSyntaxProfile {
  return {
    id,
    entryId: `entry:${id}`,
    upos: "VERB",
    functions: ["predicate"],
    valencyFrames: options.ccomp ? ["clausal-complement"] : ["transitive"],
    ...(options.occurrenceCapability ? {
      occurrenceCapabilities: [CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY],
    } : {}),
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
      ...(options.aggregateVoiceCau ? { morphologicalFeatureCounts: { "Voice=Cau": 1 } } : {}),
    },
    provenanceIds: ["test"],
  };
}

function matrixSlot() {
  const rules = rulesForFormalSyntaxConstructionView(CAUSATIVE_FINITE_CCOMP_VIEW);
  const shape = sampleStructuralDerivation({
    rootCategory: CAUSATIVE_FINITE_CCOMP_VIEW.rootCategory,
    rootProductionRuleId: CAUSATIVE_FINITE_CCOMP_VIEW.rootProductionRuleId,
    rules,
    random: STABLE_RANDOM,
    maximumAttempts: 1,
  });
  expect(shape).not.toBeNull();
  const marked = shape?.lexicalSlots.filter((slot) =>
    slot.requiredOccurrenceCapabilities?.includes(CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY)
  ) ?? [];
  expect(marked).toHaveLength(1);
  return marked[0]!;
}

describe("same-occurrence causative construction view", () => {
  it("derives a stricter ccomp view without mutating canonical grammar", () => {
    expect(ACTIVE_CAUSATIVE_CONSTRUCTION_VIEWS).toEqual([CAUSATIVE_FINITE_CCOMP_VIEW]);
    expect(CAUSATIVE_FINITE_CCOMP_VIEW).toMatchObject({
      id: "causative.finite-ccomp",
      rootCategory: "Clause",
      rootProductionRuleId: "clause.object-content",
      evidenceContract: "same-token-voice-cau-direct-ccomp-v1",
    });

    const rules = rulesForFormalSyntaxConstructionView(CAUSATIVE_FINITE_CCOMP_VIEW);
    expect(rules).toHaveLength(FORMAL_SYNTAX_RULES.length);
    expect(rules.map((rule) => rule.id)).toEqual(FORMAL_SYNTAX_RULES.map((rule) => rule.id));

    const canonicalRoot = FORMAL_SYNTAX_RULES.find((rule) => rule.id === "clause.object-content")!;
    const derivedRoot = rules.find((rule) => rule.id === "clause.object-content")!;
    expect(canonicalRoot.constituents.find((item) => item.key === "predicate")
      ?.requiredOccurrenceCapabilities).toBeUndefined();
    expect(derivedRoot.constituents.find((item) => item.key === "predicate")
      ?.requiredOccurrenceCapabilities).toEqual([CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY]);

    const canonicalPredicateHeads = FORMAL_SYNTAX_RULES
      .filter((rule) => rule.output === "Predicate")
      .map((rule) => rule.constituents.find((item) => item.key === "head"));
    const derivedPredicateHeads = rules
      .filter((rule) => rule.output === "Predicate")
      .map((rule) => rule.constituents.find((item) => item.key === "head"));
    expect(canonicalPredicateHeads.every((head) => head?.inheritOccurrenceCapabilities === undefined))
      .toBe(true);
    expect(derivedPredicateHeads.every((head) => head?.inheritOccurrenceCapabilities === true))
      .toBe(true);
    expect(derivedPredicateHeads.map((head) => head?.allowedUpos))
      .toEqual(canonicalPredicateHeads.map((head) => head?.allowedUpos));
  });

  it("marks only the matrix lexical head and keeps ccomp as the structural embedding requirement", () => {
    const slot = matrixSlot();
    expect(slot.requiredValencyFrames).toEqual(["clausal-complement"]);
    expect(slot.requiredOccurrenceCapabilities).toEqual([
      CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY,
    ]);
    expect(slot.requiredFeatures.voice).toBeUndefined();
  });

  it("trusts the explicit capability instead of rebuilding it from aggregate morphology and valency", () => {
    const slot = matrixSlot();

    expect(syntaxProfileMatchesRequirements(
      profile("explicit-capability", { ccomp: true, occurrenceCapability: true }),
      slot,
      "讓",
    )).toBe(true);

    // This is the historical unsafe shape: both aggregate inputs exist, but the
    // same-occurrence capability is absent. It must remain rejected.
    expect(syntaxProfileMatchesRequirements(
      profile("aggregate-only", {
        ccomp: true,
        occurrenceCapability: false,
        aggregateVoiceCau: true,
      }),
      slot,
      "阻止",
    )).toBe(false);

    expect(syntaxProfileMatchesRequirements(
      profile("capability-without-ccomp-shape", {
        ccomp: false,
        occurrenceCapability: true,
      }),
      slot,
      "讓",
    )).toBe(false);
  });

  it("rejects packaged 阻止 at the consumer boundary", () => {
    const slot = matrixSlot();
    const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
    const aggregateOnly = SYNTAX_PROFILES.find((profile) =>
      textByEntryId.get(profile.entryId) === "阻止"
        && profile.valencyFrames.includes("clausal-complement")
        && (profile.dependencyEvidence.morphologicalFeatureCounts?.["Voice=Cau"] ?? 0) > 0
    );
    expect(aggregateOnly).toBeDefined();
    expect(aggregateOnly?.occurrenceCapabilities ?? []).not.toContain(
      CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY,
    );
    expect(syntaxProfileMatchesRequirements(aggregateOnly!, slot, "阻止")).toBe(false);

    const supported = SYNTAX_PROFILES.find((profile) =>
      profile.valencyFrames.includes("clausal-complement")
        && profile.occurrenceCapabilities?.includes(CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY)
    );
    expect(supported).toBeDefined();
    const supportedText = textByEntryId.get(supported!.entryId);
    expect(supportedText).toBeDefined();
    expect(syntaxProfileMatchesRequirements(supported!, slot, supportedText)).toBe(true);
  });
});
