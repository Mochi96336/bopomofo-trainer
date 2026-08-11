import { describe, expect, it } from "vitest";
import {
  collectStructuralCompatibilityEdges,
} from "../../src/syntax/compatibility-edges.js";
import { CAUSATIVE_FINITE_CCOMP_VIEW } from "../../src/syntax/causative-construction-view.js";
import {
  rulesForFormalSyntaxConstructionView,
} from "../../src/syntax/construction-view.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";

const STABLE_RANDOM = { next: () => 0 };

function rules(...ids: readonly string[]) {
  const keep = new Set(ids);
  return FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id));
}

describe("structural lexical compatibility edges", () => {
  it("derives nsubj and obj from a transitive Clause without gating lexical roles", () => {
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: [{
        parentRuleId: "sentence.declarative",
        constituentKey: "clause",
        childRuleId: "clause.transitive",
      }],
      rules: rules(
        "sentence.declarative",
        "clause.transitive",
        "argument.subject.noun",
        "argument.object.noun",
        "phrase.noun.bare",
        "phrase.nominal-head.noun",
        "predicate.verb.lexical",
      ),
      random: STABLE_RANDOM,
      maximumAttempts: 1,
    });

    expect(shape).not.toBeNull();
    const slots = shape?.lexicalSlots ?? [];
    expect(slots).toHaveLength(3);
    expect(collectStructuralCompatibilityEdges(shape!)).toEqual([
      {
        headSlotId: slots[1]!.id,
        dependentSlotId: slots[0]!.id,
        relation: "nsubj",
      },
      {
        headSlotId: slots[1]!.id,
        dependentSlotId: slots[2]!.id,
        relation: "obj",
      },
    ]);
  });

  it("connects a finite ccomp matrix predicate to the embedded predicate and subject", () => {
    const baseRules = rules(
      "sentence.declarative",
      "clause.object-content",
      "content.clause",
      "clause.intransitive",
      "argument.subject.noun",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
      "predicate.verb.lexical",
    );
    const viewRules = rulesForFormalSyntaxConstructionView(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      baseRules,
    );
    const shape = sampleStructuralDerivation({
      rootCategory: "Sentence",
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: [
        {
          parentRuleId: "sentence.declarative",
          constituentKey: "clause",
          childRuleId: "clause.object-content",
        },
        {
          parentRuleId: "content.clause",
          constituentKey: "clause",
          childRuleId: "clause.intransitive",
        },
      ],
      rules: viewRules,
      random: STABLE_RANDOM,
      maximumAttempts: 1,
      bounds: {
        maximumPhraseDepth: 3,
        maximumClauseNesting: 2,
        maximumClausesPerSentence: 2,
        maximumCoordinationItems: 2,
        maximumConsecutiveModifiers: 2,
        maximumComplementsPerPredicate: 1,
        maximumLexicalEntriesPerUtterance: 6,
      },
    });

    expect(shape).not.toBeNull();
    const slots = shape?.lexicalSlots ?? [];
    expect(slots).toHaveLength(3);
    expect(slots[0]?.requiredFeatures.voice).toBe("causative");
    expect(collectStructuralCompatibilityEdges(shape!)).toEqual([
      {
        headSlotId: slots[0]!.id,
        dependentSlotId: slots[2]!.id,
        relation: "ccomp",
      },
      {
        headSlotId: slots[2]!.id,
        dependentSlotId: slots[1]!.id,
        relation: "nsubj",
      },
    ]);
  });
});
