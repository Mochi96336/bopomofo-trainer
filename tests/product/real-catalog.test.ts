import { describe, expect, it } from "vitest";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
} from "../../src/product/session.js";
import {
  COMMONNESS_TIER_THRESHOLDS,
  EVALUATION_CATALOG,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import {
  catalogEntryCommonnessTier,
  COMMONNESS_TIERS,
} from "../../src/commonness/tiers.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";

describe("frequency-first product real catalog integration", () => {
  it("packages the complete runtime catalog as practice and never schedules evaluation", () => {
    expect(PRACTICE_CATALOG.length).toBeGreaterThan(0);
    expect(EVALUATION_CATALOG).toEqual([]);

    const environment = createProductEnvironment({
      practice: PRACTICE_CATALOG,
      evaluation: EVALUATION_CATALOG,
      syntaxProfiles: SYNTAX_PROFILES,
    });
    const progress = createFreshProgressForEnvironment(
      environment,
      "integration",
      "guided",
      STANDARD_BOPOMOFO_LAYOUT.id,
    );
    const state = createProductState(environment, progress, 0);
    expect(state.round.kind).toBe("practice");
    expect(state.round.exercise.entries).toEqual(state.round.selection.utterance.entries);
    expect(state.round.exercise.entries.length).toBeGreaterThan(1);
    expect(state.round.exercise.entries.every((entry) => entry.commonnessBase !== undefined)).toBe(true);
    expect(state.round.selection.utterance.kind).toBe("formal-syntax");
    expect(state.round.selection.utterance.syntaxDerivationId).toBeTruthy();

    const formerBoundaryProgress = {
      ...progress,
      practiceRoundsCompleted: 5,
      curriculum: { ...progress.curriculum, round: 5 },
    };
    const nextState = createProductState(environment, formerBoundaryProgress, 1);
    expect(nextState.round.kind).toBe("practice");
    expect(nextState.round.exercise.id).toBe("practice-6");
    expect(nextState.round.selection.utterance.kind).toBe("formal-syntax");
    expect(nextState.round.exercise.entries.length).toBeGreaterThan(0);
  });

  // Narrowing by rarity is what a learner does with the level switches, and the
  // narrowest setting is the one a fresh learner practises with. Every level on
  // its own has to remain a complete practice pool: one that can still teach
  // every key, and one the sentence generator can still build from.
  it.each([...COMMONNESS_TIERS])("practises the whole keyboard at level %i alone", (tier) => {
    const whole = {
      practice: PRACTICE_CATALOG,
      evaluation: EVALUATION_CATALOG,
      syntaxProfiles: SYNTAX_PROFILES,
    };
    const narrowed = catalogsForCommonnessTiers(whole, COMMONNESS_TIER_THRESHOLDS, [tier]);
    expect(narrowed.practice.length).toBeGreaterThan(0);
    expect(narrowed.practice.length).toBeLessThan(PRACTICE_CATALOG.length);

    const environment = createProductEnvironment(narrowed);
    expect(Object.keys(environment.practiceSupport.byToken).sort()).toEqual(
      Object.keys(createProductEnvironment(whole).practiceSupport.byToken).sort(),
    );

    const progress = createFreshProgressForEnvironment(
      environment,
      `level-${tier}`,
      "guided",
      STANDARD_BOPOMOFO_LAYOUT.id,
    );
    const state = createProductState(environment, progress, 0);
    expect(state.round.selection.utterance.kind).toBe("formal-syntax");
    expect(state.round.exercise.entries.length).toBeGreaterThan(1);
    expect(
      state.round.exercise.entries.every((entry) =>
        catalogEntryCommonnessTier(entry, COMMONNESS_TIER_THRESHOLDS) === tier),
    ).toBe(true);
  });
});
