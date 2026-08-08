import { describe, expect, it } from "vitest";
import type { PracticeInput } from "../../src/practice/interaction-input.js";
import { inspectionNextToken } from "../../src/app/practice-session-view.js";
import {
  applyProductInput,
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
  startNextProductRound,
} from "../../src/product/session.js";
import {
  parseProductProgress,
  serializeProductProgress,
} from "../../src/product/progress.js";
import {
  EVALUATION,
  PRACTICE,
  PRODUCT_CATALOGS,
  SYNTAX_PROFILES,
} from "./fixtures.js";

const environment = createProductEnvironment(PRODUCT_CATALOGS);

function complete(state: ReturnType<typeof createProductState>) {
  let current = state;
  let timestamp = 100;
  while (current.summary === null) {
    const token = inspectionNextToken(current.session);
    if (token === null) throw new Error("incomplete product session has no acceptable token");
    timestamp += 50;
    const input: PracticeInput = {
      timestampMs: timestamp,
      physicalCode: "Test",
      actualToken: token,
      repeat: false,
      composing: false,
      modifierOnly: false,
    };
    current = applyProductInput(
      environment,
      current,
      input,
      "2026-07-20T00:00:00.000Z",
    );
  }
  return current;
}

function bindingObservationCount(state: ReturnType<typeof createProductState>): number {
  return Object.values(state.progress.measurements.semantic.bindings)
    .reduce((total, aggregate) => total + aggregate.attempts, 0);
}

describe("frequency-first grammatical product session loop", () => {
  it("requires unique disjoint syntax-profiled catalogs and allows no evaluation entries", () => {
    expect(() => createProductEnvironment({
      ...PRODUCT_CATALOGS,
      practice: PRACTICE,
      evaluation: [PRACTICE[0]!, ...EVALUATION],
    })).toThrow(/disjoint/);
    expect(() => createProductEnvironment({
      ...PRODUCT_CATALOGS,
      practice: [PRACTICE[0]!, PRACTICE[0]!, ...PRACTICE.slice(1)],
      evaluation: EVALUATION,
    })).toThrow(/duplicate/);
    expect(() => createProductEnvironment({
      practice: PRACTICE,
      evaluation: EVALUATION,
      syntaxProfiles: [],
    })).toThrow(/missing syntax profiles/);

    const practiceIds = new Set(PRACTICE.map((entry) => entry.id));
    const practiceOnly = createProductEnvironment({
      practice: PRACTICE,
      evaluation: [],
      syntaxProfiles: SYNTAX_PROFILES.filter((profile) => practiceIds.has(profile.entryId)),
    });
    expect(practiceOnly.catalogs.evaluation).toEqual([]);
  });

  it("builds one complete grammar-valid utterance instead of six unrelated entries", () => {
    const progress = createFreshProgressForEnvironment(
      environment,
      "grammar-seed",
      "guided",
      "standard",
    );
    const state = createProductState(environment, progress, 0);
    expect(state.round.selection.utterance.id).toBeTruthy();
    expect(state.round.exercise.entries.map((entry) => entry.id)).toEqual(
      state.round.selection.utterance.entries.map((entry) => entry.id),
    );
    expect(state.round.exercise.entries.length).toBeGreaterThan(1);
    expect(state.round.selection.utterance.kind).toBe("formal-syntax");
    expect(state.round.selection.score.transitionBoost).toBe(1);
    expect(state.round.selection.score.transitionTrace).toEqual([]);
  });

  it("reports interaction accuracy without counting browser noise", () => {
    const progress = createFreshProgressForEnvironment(
      environment,
      "accuracy-seed",
      "guided",
      "standard",
    );
    const initial = createProductState(environment, progress, 0);
    const targetCount = initial.session.plan.totalSlots;
    const view = initial.session.plan.syllables[0]!;
    const expected = view.bodySlots[0]!.tokenId;
    const wrongToken = view.bodySlots.length > 1
      ? "zhuyin:ㄦ"
      : "tone:2";

    let current = applyProductInput(environment, initial, {
      timestampMs: 10,
      physicalCode: "WrongMappedKey",
      actualToken: wrongToken,
      repeat: false,
      composing: false,
      modifierOnly: false,
    }, "2026-07-20T00:00:00.000Z");
    current = applyProductInput(environment, current, {
      timestampMs: 20,
      physicalCode: "ArrowLeft",
      actualToken: null,
      repeat: false,
      composing: false,
      modifierOnly: false,
    }, "2026-07-20T00:00:00.000Z");
    current = applyProductInput(environment, current, {
      timestampMs: 30,
      physicalCode: "HeldKey",
      actualToken: expected,
      repeat: true,
      composing: false,
      modifierOnly: false,
    }, "2026-07-20T00:00:00.000Z");

    const completed = complete(current);
    expect(completed.summary).not.toBeNull();
    expect(completed.summary!.attempts).toBe(targetCount + 1);
    expect(completed.summary!.errors).toBe(1);
    expect(bindingObservationCount(completed)).toBeLessThan(completed.summary!.attempts);
  });

  it("updates practice measurements and curriculum exactly once", () => {
    const progress = createFreshProgressForEnvironment(
      environment,
      "seed",
      "guided",
      "standard",
    );
    const completed = complete(createProductState(environment, progress, 0));
    expect(completed.round.kind).toBe("practice");
    expect(completed.progress.practiceRoundsCompleted).toBe(1);
    expect(completed.progress.curriculum.round).toBe(1);
    expect(bindingObservationCount(completed)).toBeGreaterThan(0);

    const unchanged = applyProductInput(environment, completed, {
      timestampMs: 999,
      physicalCode: "Test",
      actualToken: "tone:1",
      repeat: false,
      composing: false,
      modifierOnly: false,
    }, "2026-07-20T00:00:01.000Z");
    expect(unchanged).toBe(completed);
  });

  it("restores the same next utterance and template after serialization", () => {
    const fresh = createFreshProgressForEnvironment(environment, "seed", "guided", "standard");
    const completed = complete(createProductState(environment, fresh, 0));
    const next = startNextProductRound(environment, completed, 500);
    const restored = parseProductProgress(
      serializeProductProgress(completed.progress),
      environment.practiceSupport,
      "guided",
      "standard",
      environment.curriculumPolicy.version,
      environment.utterancePolicy,
    )!;
    const reloaded = createProductState(environment, restored, 700);
    expect(reloaded.round.selection.utterance.id).toBe(next.round.selection.utterance.id);
    expect(reloaded.round.selection.utterance.templateId)
      .toBe(next.round.selection.utterance.templateId);
    expect(reloaded.round.exercise.entries.map((item) => item.id)).toEqual(
      next.round.exercise.entries.map((item) => item.id),
    );
  });

  it("continues normal practice after the former five-round evaluation boundary", () => {
    const fresh = createFreshProgressForEnvironment(environment, "seed", "guided", "standard");
    const progress = {
      ...fresh,
      practiceRoundsCompleted: 5,
      curriculum: { ...fresh.curriculum, round: 5 },
    };
    const state = createProductState(environment, progress, 0);
    expect(state.round.kind).toBe("practice");
    expect(state.round.exercise.id).toBe("practice-6");

    const beforeMeasurements = bindingObservationCount(state);
    const completed = complete(state);
    expect(completed.progress.practiceRoundsCompleted).toBe(6);
    expect(completed.progress.curriculum.round).toBe(6);
    expect(bindingObservationCount(completed)).toBeGreaterThan(beforeMeasurements);
  });
});
