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
  parseProgressHistory,
  serializeProgressHistory,
} from "../../src/progress-history/serialize.js";
import type { ProgressHistory } from "../../src/progress-history/types.js";
import {
  appendRoundToProgressHistory,
  createEmptyProgressHistory,
} from "../../src/progress-history/update.js";
import { PRODUCT_CATALOGS } from "../product/fixtures.js";

const environment = createProductEnvironment(PRODUCT_CATALOGS);
const validTokens = new Set(Object.keys(environment.practiceSupport.byToken));

type State = ReturnType<typeof createProductState>;

function typeRoundCorrectly(state: State, startMs: number): State {
  let current = state;
  let timestamp = startMs;
  while (current.summary === null) {
    const token = inspectionNextToken(current.session);
    if (token === null) throw new Error("incomplete session has no acceptable token");
    timestamp += 120;
    const input: PracticeInput = {
      timestampMs: timestamp,
      physicalCode: "Test",
      actualToken: token,
      repeat: false,
      composing: false,
      modifierOnly: false,
    };
    current = applyProductInput(environment, current, input, "2026-07-25T00:00:00.000Z");
  }
  return current;
}

function playRounds(count: number): { state: State; history: ProgressHistory } {
  const progress = createFreshProgressForEnvironment(
    environment,
    "history-seed",
    "guided",
    "standard",
  );
  let state = createProductState(environment, progress, 0);
  let history = createEmptyProgressHistory("guided", "standard");

  for (let round = 1; round <= count; round += 1) {
    state = typeRoundCorrectly(state, round * 10_000);
    history = appendRoundToProgressHistory({
      history,
      exercise: state.round.exercise,
      traces: state.session.traces,
      completedRound: state.progress.practiceRoundsCompleted,
    });
    if (round < count) state = startNextProductRound(environment, state, round * 10_000 + 5_000);
  }
  return { state, history };
}

describe("progress history across the product round loop", () => {
  it("accumulates bounded history from real completed rounds", () => {
    const { state, history } = playRounds(6);

    expect(history.lastCompletedRound).toBe(state.progress.practiceRoundsCompleted);
    expect(history.lastCompletedRound).toBe(6);
    expect(Object.keys(history.keys).length).toBeGreaterThan(0);
    for (const entry of Object.values(history.keys)) {
      expect(validTokens.has(entry.tokenId)).toBe(true);
      expect(entry.totalTimingSamples).toBeLessThanOrEqual(entry.totalObservations);
    }
  });

  it("agrees with the cumulative v2 binding aggregate on observation counts", () => {
    const { state, history } = playRounds(6);

    for (const aggregate of Object.values(state.progress.measurements.semantic.bindings)) {
      const entry = history.keys[aggregate.scope.tokenId];
      expect(entry).toBeDefined();
      expect(entry!.totalObservations).toBe(aggregate.attempts);
      expect(entry!.totalTimingSamples).toBe(aggregate.timingSamples);
    }
  });

  it("ignores a completed round that has already been folded in", () => {
    const { state, history } = playRounds(3);
    const replayed = appendRoundToProgressHistory({
      history,
      exercise: state.round.exercise,
      traces: state.session.traces,
      completedRound: state.progress.practiceRoundsCompleted,
    });
    expect(replayed).toBe(history);
  });

  it("continues an open bucket across a reload", () => {
    const { history } = playRounds(3);
    const reloaded = parseProgressHistory(
      serializeProgressHistory(history),
      "guided",
      "standard",
      validTokens,
    );

    expect(reloaded).toEqual(history);
    for (const [tokenId, entry] of Object.entries(history.keys)) {
      expect(reloaded!.keys[tokenId]!.partialCorrectness).toEqual(entry.partialCorrectness);
      expect(reloaded!.keys[tokenId]!.partialTiming).toEqual(entry.partialTiming);
    }
  });

  it("is unaffected by inspecting a different prompt without completing it", () => {
    const { state, history } = playRounds(2);
    const preview = createProductState(
      environment,
      { ...state.progress, seed: `${state.progress.seed}:inspection:1` },
      99_000,
    );

    expect(preview.summary).toBeNull();
    expect(history.lastCompletedRound).toBe(2);
  });

  it("starts over when progress is reset", () => {
    const { history } = playRounds(3);
    expect(history.lastCompletedRound).toBe(3);

    const afterReset = createEmptyProgressHistory("guided", "standard");
    expect(afterReset.keys).toEqual({});
    expect(afterReset.lastCompletedRound).toBe(0);
  });
});
