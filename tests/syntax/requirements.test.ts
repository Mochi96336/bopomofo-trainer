import { describe, expect, it } from "vitest";
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

  it("does not leak parent requirements into an unrelated child", () => {
    const parent = {
      requiredFunctions: ["subject"] as const,
      requiredValencyFrames: [] as const,
      requiredFeatures: {},
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

  it("keeps an unconstrained edge empty", () => {
    expect(requirementsForConstituent(
      constituent(),
      EMPTY_SYNTAX_REQUIREMENTS,
    )).toEqual(EMPTY_SYNTAX_REQUIREMENTS);
  });
});
