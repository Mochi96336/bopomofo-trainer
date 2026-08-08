import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import {
  createFormalSyntaxFamilyRuleOrderer,
  createSentenceConstructionFamilyPlan,
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
} from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { sentenceConstructionClassification } from "../../src/curriculum/formal-syntax-taxonomy.js";
import type { StructuralLexicalSlot } from "../../src/syntax/derive.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  buildLexicalProfileIndex,
  compatibleProfilesForSlot,
} from "../../src/syntax/realize.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";

function isPracticeLexicalSlot(slot: StructuralLexicalSlot): boolean {
  return slot.formalLiteral === undefined
    && !(slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT");
}

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

describe("formal syntax effective product distribution", () => {
  it("keeps A-not-A bounded after real-catalog reachability and family-local search", () => {
    const index = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
    const sentenceRules = FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence");
    const familyRuleOrderer = createFormalSyntaxFamilyRuleOrderer();
    const lowerCategoryOrderer = (input: Parameters<typeof familyRuleOrderer>[0]) =>
      input.category === "Sentence" ? null : familyRuleOrderer(input);
    const sampleCount = 64;
    const initialFamilyCounts = new Map<string, number>();
    const familyCounts = new Map<string, number>();
    const transitionCounts = new Map<string, number>();
    let questions = 0;
    let totalAttempts = 0;

    for (let round = 0; round < sampleCount; round += 1) {
      const random = createSeededRandom(`formal-family-distribution:${round}`);
      const rootPlan = createSentenceConstructionFamilyPlan(sentenceRules, random);
      const initialFamily = rootPlan[0]!.family;
      increment(initialFamilyCounts, initialFamily);
      let familyIndex = 0;
      let attemptsInFamily = 0;
      let acceptedRootRuleId: string | null = null;

      for (let attempt = 0; attempt < 64 && acceptedRootRuleId === null; attempt += 1) {
        const family = rootPlan[familyIndex];
        if (family === undefined) break;
        totalAttempts += 1;
        const shape = sampleStructuralDerivation({
          rootCategory: "Sentence",
          rules: FORMAL_SYNTAX_RULES,
          random,
          maximumAttempts: 1,
          ruleOrderer: lowerCategoryOrderer,
          rootProductionRuleIds: family.productionRuleIds,
          isLexicalSlotReachable: (slot) => {
            if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") return true;
            return compatibleProfilesForSlot(slot, index).length > 0;
          },
          bounds: {
            maximumPhraseDepth: 3,
            maximumClauseNesting: 1,
            maximumClausesPerSentence: 2,
            maximumCoordinationItems: 2,
            maximumConsecutiveModifiers: 2,
            maximumComplementsPerPredicate: 1,
            maximumLexicalEntriesPerUtterance: 6,
          },
        });
        if (shape !== null && shape.lexicalSlots.filter(isPracticeLexicalSlot).length >= 2) {
          acceptedRootRuleId = shape.root.productionRuleId;
          expect(sentenceConstructionClassification(acceptedRootRuleId)?.family).toBe(family.family);
          break;
        }
        attemptsInFamily += 1;
        if (attemptsInFamily >= PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.maximumRootFamilyAttempts) {
          familyIndex += 1;
          attemptsInFamily = 0;
        }
      }

      expect(acceptedRootRuleId).not.toBeNull();
      const classification = sentenceConstructionClassification(acceptedRootRuleId!);
      expect(classification).not.toBeNull();
      increment(familyCounts, classification!.family);
      increment(transitionCounts, `${initialFamily}->${classification!.family}`);
      if (classification!.kind === "question") questions += 1;
    }

    const counts = Object.fromEntries([...familyCounts.entries()].sort());
    const initialCounts = Object.fromEntries([...initialFamilyCounts.entries()].sort());
    const transitions = Object.fromEntries([...transitionCounts.entries()].sort());
    const aNotA = familyCounts.get("question.a-not-a") ?? 0;
    const aNotAShare = aNotA / sampleCount;
    const questionShare = questions / sampleCount;
    const diagnostic = JSON.stringify({
      sampleCount,
      totalAttempts,
      averageAttempts: totalAttempts / sampleCount,
      aNotAShare,
      questionShare,
      initialCounts,
      counts,
      transitions,
    });
    expect(aNotAShare, diagnostic).toBeLessThan(0.12);
    expect(questionShare, diagnostic).toBeLessThan(0.40);
  });
});
