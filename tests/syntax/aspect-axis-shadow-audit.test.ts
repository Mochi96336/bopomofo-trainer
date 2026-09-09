import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  buildLexicalProfileIndex,
  compatibleProfilesForSlot,
} from "../../src/syntax/realize.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import type { ProductionRule } from "../../src/syntax/types.js";

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

const SAMPLE_COUNT = 8192;
const index = buildLexicalProfileIndex(PRACTICE_CATALOG, SYNTAX_PROFILES);
const SHADOW_WITHOUT_CLAUSE_ASPECT = FORMAL_SYNTAX_RULES
  .filter((rule) => rule.id !== "clause.aspect");

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function rootClauseRule(path: readonly string[]): string {
  return path.find((ruleId) => ruleId.startsWith("clause.")) ?? "<none>";
}

function sample(rules: readonly ProductionRule[], seed: string) {
  return sampleStructuralDerivation({
    rootCategory: "Sentence",
    rules,
    random: createSeededRandom(seed),
    rootProductionRuleId: "sentence.declarative",
    maximumAttempts: 1,
    bounds: PRODUCT_BOUNDS,
    isLexicalSlotReachable: (slot) => {
      if (slot.allowedUpos.length === 1 && slot.allowedUpos[0] === "PUNCT") return true;
      return compatibleProfilesForSlot(slot, index).length > 0;
    },
  });
}

function totalVariation(
  left: ReadonlyMap<string, number>,
  right: ReadonlyMap<string, number>,
  denominator: number,
): number {
  const keys = new Set([...left.keys(), ...right.keys()]);
  let distance = 0;
  for (const key of keys) {
    distance += Math.abs((left.get(key) ?? 0) - (right.get(key) ?? 0));
  }
  return distance / (2 * denominator);
}

describe("Clause V2 aspect-axis retirement shadow audit", () => {
  it("isolates the structural effect of removing clause.aspect over 8192 reachable declarative seeds", () => {
    let currentSuccess = 0;
    let shadowSuccess = 0;
    let currentAspectExposure = 0;
    let shadowAspectExposure = 0;
    let currentClauseAspect = 0;
    let currentDuplicateAspectOwnership = 0;
    let changedRootClause = 0;
    let changedPath = 0;
    const currentRoots = new Map<string, number>();
    const shadowRoots = new Map<string, number>();

    for (let round = 0; round < SAMPLE_COUNT; round += 1) {
      const seed = `aspect-axis-retirement-shadow:${round}`;
      const current = sample(FORMAL_SYNTAX_RULES, seed);
      const shadow = sample(SHADOW_WITHOUT_CLAUSE_ASPECT, seed);

      if (current !== null) {
        currentSuccess += 1;
        const aspectSlots = current.lexicalSlots.filter((slot) =>
          slot.requiredFeatures.aspect === "marked");
        if (aspectSlots.length > 0) currentAspectExposure += 1;
        const ownsClauseAspect = current.productionRulePath.includes("clause.aspect");
        if (ownsClauseAspect) currentClauseAspect += 1;
        if (ownsClauseAspect && aspectSlots.length > 1) currentDuplicateAspectOwnership += 1;
        increment(currentRoots, rootClauseRule(current.productionRulePath));
      }

      if (shadow !== null) {
        shadowSuccess += 1;
        if (shadow.lexicalSlots.some((slot) => slot.requiredFeatures.aspect === "marked")) {
          shadowAspectExposure += 1;
        }
        increment(shadowRoots, rootClauseRule(shadow.productionRulePath));
      }

      if (current !== null && shadow !== null) {
        if (rootClauseRule(current.productionRulePath) !== rootClauseRule(shadow.productionRulePath)) {
          changedRootClause += 1;
        }
        if (current.productionRulePath.join("\u0000") !== shadow.productionRulePath.join("\u0000")) {
          changedPath += 1;
        }
      }
    }

    const rootTv = totalVariation(currentRoots, shadowRoots, SAMPLE_COUNT);
    const diagnostic = {
      sampleCount: SAMPLE_COUNT,
      currentSuccess,
      shadowSuccess,
      currentAspectExposure,
      shadowAspectExposure,
      currentClauseAspect,
      currentDuplicateAspectOwnership,
      changedRootClause,
      changedPath,
      rootTv,
      currentRoots: Object.fromEntries([...currentRoots].sort()),
      shadowRoots: Object.fromEntries([...shadowRoots].sort()),
    };
    console.log(`aspect-axis-shadow-audit ${JSON.stringify(diagnostic)}`);

    expect(currentSuccess, JSON.stringify(diagnostic)).toBe(SAMPLE_COUNT);
    expect(shadowSuccess, JSON.stringify(diagnostic)).toBe(SAMPLE_COUNT);
    expect(currentClauseAspect, JSON.stringify(diagnostic)).toBeGreaterThan(0);
    expect(currentDuplicateAspectOwnership, JSON.stringify(diagnostic)).toBeGreaterThan(0);
    // #248's stable nested-Clause candidate ordering should confine root-rule
    // changes exactly to seeds whose current successful root is clause.aspect.
    expect(changedRootClause, JSON.stringify(diagnostic)).toBe(currentClauseAspect);
    expect(rootTv, JSON.stringify(diagnostic)).toBeLessThan(0.10);
  });
});
