import { describe, expect, it } from "vitest";
import { PREDICATE_PRODUCTION_RULES } from "../../src/syntax/predicate-rules.js";
import {
  EMPTY_SYNTAX_REQUIREMENTS,
  requirementsForConstituent,
} from "../../src/syntax/requirements.js";
import type { ProductionConstituent } from "../../src/syntax/types.js";

function constituent(
  overrides: Partial<ProductionConstituent> = {},
): ProductionConstituent {
  return {
    key: "child",
    category: "Lexeme",
    minimum: 1,
    maximum: 1,
    recursive: false,
    allowedUpos: ["VERB"],
    requiredFunctions: [],
    requiredValencyFrames: [],
    requiredFeatures: {},
    ...overrides,
  };
}

describe("syntax requirement propagation", () => {
  it("inherits only requirement kinds declared on the edge", () => {
    const parent = {
      requiredFunctions: ["predicate"] as const,
      requiredValencyFrames: ["transitive", "ambitransitive"] as const,
      requiredFeatures: { polarity: "negative" } as const,
    };
    expect(requirementsForConstituent(constituent({
      inheritFunctions: true,
      inheritValencyFrames: true,
    }), parent)).toEqual({
      requiredFunctions: ["predicate"],
      requiredValencyFrames: ["ambitransitive", "transitive"],
      requiredFeatures: {},
    });
  });

  it("inherits compatible features only when the edge opts in", () => {
    const parent = {
      requiredFunctions: [] as const,
      requiredValencyFrames: [] as const,
      requiredFeatures: { voice: "causative", polarity: "negative" } as const,
    };
    expect(requirementsForConstituent(constituent({
      inheritFeatures: true,
      requiredFeatures: { aspect: "marked" },
    }), parent)?.requiredFeatures).toEqual({
      aspect: "marked",
      polarity: "negative",
      voice: "causative",
    });
    expect(requirementsForConstituent(constituent({
      requiredFeatures: { aspect: "marked" },
    }), parent)?.requiredFeatures).toEqual({ aspect: "marked" });
  });

  it("fails closed when local and inherited feature requirements conflict", () => {
    const parent = {
      requiredFunctions: [] as const,
      requiredValencyFrames: [] as const,
      requiredFeatures: { voice: "causative" } as const,
    };
    expect(requirementsForConstituent(constituent({
      inheritFeatures: true,
      requiredFeatures: { voice: "passive" },
    }), parent)).toBeNull();
    expect(requirementsForConstituent(constituent({
      inheritFeatures: true,
      requiredFeatures: { voice: "causative" },
    }), parent)?.requiredFeatures).toEqual({ voice: "causative" });
  });

  it("does not leak parent requirements into an unrelated child", () => {
    const parent = {
      requiredFunctions: ["subject"] as const,
      requiredValencyFrames: [] as const,
      requiredFeatures: { voice: "causative" } as const,
    };
    expect(requirementsForConstituent(constituent({
      allowedUpos: ["ADJ"],
      requiredFunctions: ["modifier"],
    }), parent)).toEqual({
      requiredFunctions: ["modifier"],
      requiredValencyFrames: [],
      requiredFeatures: {},
    });
  });

  it("intersects alternative valency requirements instead of widening them", () => {
    const parent = {
      requiredFunctions: [] as const,
      requiredValencyFrames: ["transitive", "ambitransitive"] as const,
      requiredFeatures: {},
    };
    expect(requirementsForConstituent(constituent({
      inheritValencyFrames: true,
      requiredValencyFrames: ["transitive", "resultative"],
    }), parent)?.requiredValencyFrames).toEqual(["transitive"]);
    expect(requirementsForConstituent(constituent({
      inheritValencyFrames: true,
      requiredValencyFrames: ["intransitive"],
    }), parent)).toBeNull();
  });

  it("carries predicate-level feature requirements only to the lexical head", () => {
    const parent = {
      requiredFunctions: [] as const,
      requiredValencyFrames: ["clausal-complement"] as const,
      requiredFeatures: { voice: "causative" } as const,
    };
    for (const rule of PREDICATE_PRODUCTION_RULES) {
      const head = rule.constituents.find((item) => item.key === "head");
      expect(head?.inheritFeatures).toBe(true);
      expect(head === undefined ? null : requirementsForConstituent(head, parent)).toMatchObject({
        requiredValencyFrames: ["clausal-complement"],
        requiredFeatures: { voice: "causative" },
      });
      for (const nonHead of rule.constituents.filter((item) => item.key !== "head")) {
        expect(nonHead.inheritFeatures).not.toBe(true);
      }
    }
  });

  it("keeps an unconstrained edge empty", () => {
    expect(requirementsForConstituent(
      constituent(),
      EMPTY_SYNTAX_REQUIREMENTS,
    )).toEqual(EMPTY_SYNTAX_REQUIREMENTS);
  });
});
