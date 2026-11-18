import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { prepareFormalSyntaxLexicon, composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { prepareFormalSyntaxFeasibility } from "../../src/curriculum/formal-syntax-feasibility.js";
import { prepareFormalSyntaxExecution } from "../../src/curriculum/frequency-first-utterance.js";
import { createSentenceConstructionFamilyPlanSample } from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { countStructuralDerivationShapes, prepareStructuralDerivationCounter } from "../../src/syntax/count.js";

const bounds = prepareFormalSyntaxExecution(1).bounds;

describe("catalog-scoped construction feasibility", () => {
  it("detects a formally reachable family with no lexical realization before probability allocation", () => {
    const lexicon = prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES);
    expect(SYNTAX_PROFILES.some(profile => profile.upos === "INTJ")).toBe(false);
    expect(countStructuralDerivationShapes({ rootCategory: "Sentence", rules: FORMAL_SYNTAX_RULES,
      bounds, rootProductionRuleId: "sentence.exclamative" })).not.toBe("0");
    const feasibility = prepareFormalSyntaxFeasibility(lexicon.index, FORMAL_SYNTAX_RULES, bounds, 2);
    expect(feasibility.eligibleRootRuleIds.has("sentence.exclamative")).toBe(false);
    expect(feasibility.eligibleRootRuleIds.has("sentence.declarative")).toBe(true);
    expect(prepareFormalSyntaxFeasibility(lexicon.index, FORMAL_SYNTAX_RULES, bounds, 2)).toBe(feasibility);
    const sample = createSentenceConstructionFamilyPlanSample(
      FORMAL_SYNTAX_RULES.filter(rule => rule.output === "Sentence"), createSeededRandom("available-families"),
      undefined, feasibility.eligibleRootRuleIds,
    );
    expect(sample.plan.some(family => family.family === "exclamative")).toBe(false);
  });

  it("reuses an immutable lexical index across callers instead of recompiling it every round", () => {
    expect(prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES))
      .toBe(prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES));
  });

  it("returns a precise empty inventory diagnostic without attempting an impossible root", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: [], profiles: [], random: createSeededRandom("empty-scope"),
      lexicalSampling: "written-form", minimumLexicalEntries: 2, maximumCandidates: 1, maximumAttempts: 64, bounds,
    });
    expect(result.candidates).toEqual([]);
    expect(result.fallbackReasons).toContain("formal-syntax-no-lexically-feasible-root");
    expect(result.rootAvailability?.every(root => root.potentialShapeCount === "0")).toBe(true);
  });

  it("preserves default structural counts when no lexical constraint is requested", () => {
    const counter = prepareStructuralDerivationCounter({ rootCategory: "Sentence", rules: FORMAL_SYNTAX_RULES, bounds });
    for (const id of ["sentence.declarative", "sentence.exclamative", "sentence.complex"]) {
      expect(counter.count(id)).toBe(countStructuralDerivationShapes({
        rootCategory: "Sentence", rules: FORMAL_SYNTAX_RULES, bounds, rootProductionRuleId: id,
      }));
    }
  });
});
