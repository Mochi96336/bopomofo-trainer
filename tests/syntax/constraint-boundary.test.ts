import { describe, expect, it } from "vitest";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import type { ProductionRule } from "../../src/syntax/types.js";
import { validateGrammar } from "../../src/syntax/validate.js";

const presenceConstrainedRule: ProductionRule = {
  id: "sentence.presence-constrained",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Sentence",
  constituents: [{
    key: "head",
    category: "Lexeme",
    minimum: 1,
    maximum: 1,
    recursive: false,
    allowedUpos: ["NOUN"],
    requiredFunctions: [],
    requiredValencyFrames: [],
    requiredFeatures: {},
  }],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["head"] }],
  constraints: [{
    kind: "requires-constituent",
    ifPresentKey: "head",
    targetKey: "head",
  }],
  positiveFixtureIds: ["sentence.presence-constrained:positive"],
  negativeFixtureIds: ["sentence.presence-constrained:negative"],
};

const featureConstrainedRule: ProductionRule = {
  ...presenceConstrainedRule,
  id: "sentence.feature-constrained",
  constraints: [{
    kind: "feature-equals",
    constituentKey: "head",
    feature: "polarity",
    value: "negative",
  }],
  positiveFixtureIds: ["sentence.feature-constrained:positive"],
  negativeFixtureIds: ["sentence.feature-constrained:negative"],
};

describe("formal production constraint boundary", () => {
  it("accepts executable structural presence constraints", () => {
    expect(validateGrammar([presenceConstrainedRule]).errors).toEqual([]);
  });

  it("keeps feature constraints fail-closed until their executor exists", () => {
    expect(validateGrammar([featureConstrainedRule]).errors).toContainEqual(
      expect.objectContaining({
        code: "invalid-constraint",
        path: "rules.sentence.feature-constrained.constraints[0]",
      }),
    );
  });
});
