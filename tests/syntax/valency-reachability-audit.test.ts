import { describe, expect, it } from "vitest";
import { SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { auditValencyReachability } from "../../src/syntax/valency-reachability-audit.js";
import type { ProductionRule, RuntimeSyntaxProfile, ValencyFrame } from "../../src/syntax/types.js";

function profile(entryId: string, frames: readonly ValencyFrame[]): RuntimeSyntaxProfile {
  return {
    id: `profile:${entryId}`,
    entryId,
    upos: "VERB",
    functions: [],
    valencyFrames: frames,
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function rule(
  id: string,
  requiredFrames: readonly ValencyFrame[],
): ProductionRule {
  return {
    id,
    grammarVersion: FORMAL_GRAMMAR_VERSION,
    output: "Predicate",
    constituents: [{
      key: "head",
      category: "Lexeme",
      minimum: 1,
      maximum: 1,
      recursive: false,
      allowedUpos: ["VERB"],
      requiredFunctions: [],
      requiredValencyFrames: requiredFrames,
      requiredFeatures: {},
    }],
    surfaceOrders: [{ id: "canonical", constituentKeys: ["head"] }],
    constraints: [],
    positiveFixtureIds: [`${id}:minimum`],
    negativeFixtureIds: [`${id}:overflow`],
  };
}

describe("valency reachability audit", () => {
  it("distinguishes dead requirements from mixed fallback requirements", () => {
    const audit = auditValencyReachability(
      [
        rule("rule:dead", ["causative"]),
        rule("rule:mixed", ["transitive", "resultative"]),
        rule("rule:live", ["intransitive"]),
      ],
      [
        profile("verb:transitive", ["transitive"]),
        profile("verb:intransitive", ["intransitive"]),
      ],
    );

    expect(audit.zeroSupportFrames).toContain("causative");
    expect(audit.zeroSupportFrames).toContain("resultative");
    expect(audit.zeroSupportSlots.map((slot) => slot.ruleId)).toEqual(["rule:dead"]);
    expect(audit.mixedSupportSlots.map((slot) => slot.ruleId)).toEqual(["rule:mixed"]);
    expect(audit.requirementSlots.find((slot) => slot.ruleId === "rule:mixed"))
      .toMatchObject({
        supportedFrames: ["transitive"],
        unsupportedFrames: ["resultative"],
        supportEntryCount: 1,
      });
  });

  it("keeps the packaged audit reproducible", () => {
    const audit = auditValencyReachability(FORMAL_SYNTAX_RULES, SYNTAX_PROFILES);
    console.info(`VALENCY_REACHABILITY_AUDIT ${JSON.stringify({
      zeroSupportFrames: audit.zeroSupportFrames,
      zeroSupportSlots: audit.zeroSupportSlots,
      mixedSupportSlots: audit.mixedSupportSlots,
    })}`);
    expect(audit.profileCount).toBe(SYNTAX_PROFILES.length);
    expect(audit.entryCount).toBeGreaterThan(0);
    expect(audit.zeroSupportFrames).toEqual([
      "serial-verb",
      "causative",
      "resultative",
      "subject-controlled-open-complement",
      "object-controlled-open-complement",
    ]);
    expect(audit.zeroSupportSlots.map((slot) => [slot.ruleId, slot.constituentKey])).toEqual([
      ["clause.serial-verb", "firstPredicate"],
      ["clause.serial-verb", "secondPredicate"],
      ["clause.xcomp-object-control", "predicate"],
      ["clause.xcomp-subject-control", "predicate"],
      ["complement.result", "result"],
    ]);
    expect(audit.mixedSupportSlots.map((slot) => [slot.ruleId, slot.constituentKey])).toEqual([
      ["clause.ba", "predicate"],
    ]);
  });
});
