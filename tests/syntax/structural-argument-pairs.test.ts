import { describe, expect, it } from "vitest";
import { createSeededRandom } from "../../src/curriculum/random.js";
import type {
  StructuralDerivationShape, StructuralLexicalSlot, StructuralSyntaxNode,
} from "../../src/syntax/derive.js";
import { FORMAL_GRAMMAR_VERSION } from "../../src/syntax/features.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import { extractStructuralArgumentPairs } from "../../src/syntax/structural-argument-pairs.js";
import type { Upos } from "../../src/syntax/types.js";

function lexical(id: string, upos: Upos = "NOUN"): StructuralLexicalSlot {
  return {
    kind: "lexical-slot", id, constituentKey: "head", occurrenceIndex: 0,
    allowedUpos: [upos], requiredFunctions: [], requiredValencyFrames: [],
    requiredFeatures: {},
  };
}
function node(category: StructuralSyntaxNode["category"],
  rule: string, children: StructuralSyntaxNode["children"]): StructuralSyntaxNode {
  return {
    kind: "syntax-node", id: rule, category, productionRuleId: rule,
    surfaceOrderId: "canonical", children,
  };
}
function nounArgument(category: "Subject" | "Object", id: string): StructuralSyntaxNode {
  return node(category, "argument." + category, [
    node("NounPhrase", "phrase.noun.bare", [
      node("NominalHead", "phrase.nominal-head.noun", [lexical(id)]),
    ]),
  ]);
}
function clause(children: StructuralSyntaxNode["children"],
  rule = "clause.transitive"): StructuralSyntaxNode {
  return node("Clause", rule, children);
}
function shape(root: StructuralSyntaxNode): StructuralDerivationShape {
  return {
    id: "test", grammarVersion: FORMAL_GRAMMAR_VERSION,
    root, productionRulePath: [root.productionRuleId],
    lexicalSlots: [], clauseCount: 1, lexicalSlotCount: 0,
  };
}
const subject = nounArgument("Subject", "s");
const object = nounArgument("Object", "o");
const predicate = node("Predicate", "predicate.verb.lexical", [lexical("v", "VERB")]);

describe("clause-local structural dependency hypotheses", () => {
  it("finds nsubj and obj from explicit SVO constituent ownership, not linear proximity", () => {
    const a = extractStructuralArgumentPairs(shape(clause([subject, predicate, object])));
    const b = extractStructuralArgumentPairs(shape(clause([object, predicate, subject])));
    expect(a).toEqual([
      { headSlotId: "v", dependentSlotId: "s", relation: "nsubj", clauseRuleId: "clause.transitive" },
      { headSlotId: "v", dependentSlotId: "o", relation: "obj", clauseRuleId: "clause.transitive" },
    ]);
    expect(b).toEqual(a);
  });

  it("does not invent an argument omitted from the clause", () => {
    expect(extractStructuralArgumentPairs(shape(clause([predicate, object]))))
      .toEqual([{ headSlotId: "v", dependentSlotId: "o", relation: "obj", clauseRuleId: "clause.transitive" }]);
    expect(extractStructuralArgumentPairs(shape(clause([subject, predicate], "clause.intransitive"))))
      .toEqual([{ headSlotId: "v", dependentSlotId: "s", relation: "nsubj", clauseRuleId: "clause.intransitive" }]);
  });

  it("abstains for ambiguous coordinated heads and clause subjects", () => {
    const manyHeads = node("Subject", "argument.subject.noun", [
      node("NounPhrase", "phrase.noun.coordination", [
        node("NounPhrase", "noun.first", [
          node("NominalHead", "nominal.first", [lexical("one")]),
        ]),
        node("NounPhrase", "noun.second", [
          node("NominalHead", "nominal.second", [lexical("two")]),
        ]),
      ]),
    ]);
    const clausalSubject = node("Subject", "argument.subject.clause", [
      node("ContentClause", "content.clause", [
        node("Clause", "clause.intransitive", [predicate]),
      ]),
    ]);
    expect(extractStructuralArgumentPairs(shape(clause([manyHeads, predicate, object]))))
      .toEqual([{ headSlotId: "v", dependentSlotId: "o", relation: "obj", clauseRuleId: "clause.transitive" }]);
    expect(extractStructuralArgumentPairs(shape(clause([clausalSubject, predicate, object]))))
      .toEqual([{ headSlotId: "v", dependentSlotId: "o", relation: "obj", clauseRuleId: "clause.transitive" }]);
  });

  it("never extrapolates relations from unsupported grammatical constructions", () => {
    expect(extractStructuralArgumentPairs(shape(clause([subject, predicate, object], "clause.topic-comment"))))
      .toEqual([]);
    const ambiguousPredicate = node("Predicate", "predicate.verb.coordination", [
      lexical("v1", "VERB"), lexical("v2", "VERB"),
    ]);
    expect(extractStructuralArgumentPairs(shape(clause([subject, ambiguousPredicate, object]))))
      .toEqual([]);
  });

  it("recovers predicate-argument pairs from real pinned grammar samples", () => {
    let pairsFound = 0;
    for (let seed = 0; seed < 24; seed++) {
      const sampled = sampleStructuralDerivation({
        rootCategory: "Clause", rules: FORMAL_SYNTAX_RULES,
        rootProductionRuleId: "clause.transitive",
        random: createSeededRandom("structural-relation-" + seed),
        maximumAttempts: 24,
      });
      if (sampled === null) continue;
      const pairs = extractStructuralArgumentPairs(sampled);
      for (const pair of pairs) {
        expect(["nsubj", "obj"]).toContain(pair.relation);
        expect(sampled.lexicalSlots.some(slot => slot.id === pair.headSlotId)).toBe(true);
        expect(sampled.lexicalSlots.some(slot => slot.id === pair.dependentSlotId)).toBe(true);
        pairsFound++;
      }
    }
    expect(pairsFound).toBeGreaterThan(0);
  });
});
