import { describe, expect, it } from "vitest";
import { buildAnalysisV2Model, type AnalysisV2SemanticModel } from "../../src/app/analysis-v2-model.js";
import { loadAppState } from "../../src/app/load-app-state.js";
import {
  LOCAL_PROGRESS_HISTORY_KEY,
  LOCAL_PROGRESS_KEY,
  type StorageLike,
} from "../../src/app/persistence-transaction.js";
import {
  PREVIOUS_MEASUREMENT_V2_POLICY_VERSION,
  coordinationAggregateKey,
  sameHandRevisitAggregateKey,
} from "../../src/measurement-v2/aggregate.js";
import { serializeProductProgress } from "../../src/product/progress.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../../src/product/session.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";
import {
  EVALUATION_CATALOG,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";

function memoryStorage(): StorageLike {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

const emptySemantic: AnalysisV2SemanticModel = {
  keys: [],
  confusions: [],
  keyProgress: {},
  keysWithData: 0,
  repeatedConfusions: 0,
};

describe("Analysis V2 persisted migration smoke", () => {
  it("loads legacy motor identities through app startup and preserves word-structure history", () => {
    const environment = createProductEnvironment({
      practice: PRACTICE_CATALOG,
      evaluation: EVALUATION_CATALOG,
      syntaxProfiles: SYNTAX_PROFILES,
    });
    const fresh = createFreshProgressForEnvironment(
      environment,
      "analysis-v2-migration-smoke",
      "guided",
      STANDARD_BOPOMOFO_LAYOUT.id,
    );
    const currentWithRounds = {
      ...fresh,
      practiceRoundsCompleted: 2,
      curriculum: { ...fresh.curriculum, round: 2 },
    };
    const persisted = JSON.parse(serializeProductProgress(currentWithRounds)) as Record<string, any>;

    const structureScope = { bodyShape: "initial-final" as const };
    const structureKey = coordinationAggregateKey(structureScope);
    const revisitScope = { hand: "right" as const, oppositeHandIntervened: true };
    const revisitKey = sameHandRevisitAggregateKey(revisitScope);
    persisted.measurements.policyVersion = PREVIOUS_MEASUREMENT_V2_POLICY_VERSION;
    persisted.measurements.motor.coordination = {
      [structureKey]: {
        scope: structureScope,
        observations: 10,
        timingSamples: 10,
        currentTimeToTypeMs: 180,
        bestTimeToTypeMs: 150,
      },
    };
    persisted.measurements.motor.sameHandRevisits = {
      [revisitKey]: {
        scope: revisitScope,
        observations: 10,
        timingSamples: 10,
        currentTimeToTypeMs: 230,
        bestTimeToTypeMs: 190,
      },
    };

    const legacyHistory = {
      schemaVersion: 5,
      mode: "guided",
      layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
      lastCompletedRound: 2,
      keys: {},
      motor: {
        coordination: {
          [structureKey]: {
            scope: structureScope,
            timing: [
              {
                endingSample: 5,
                completedRound: 1,
                samples: 5,
                representativeTimingMs: 205,
              },
              {
                endingSample: 10,
                completedRound: 2,
                samples: 5,
                representativeTimingMs: 180,
              },
            ],
            partialTiming: { samples: [] },
            totalTimingSamples: 10,
          },
        },
        immediateHands: {},
        sameHandRevisits: {
          [revisitKey]: {
            scope: revisitScope,
            timing: [
              {
                endingSample: 5,
                completedRound: 1,
                samples: 5,
                representativeTimingMs: 250,
              },
              {
                endingSample: 10,
                completedRound: 2,
                samples: 5,
                representativeTimingMs: 230,
              },
            ],
            partialTiming: { samples: [] },
            totalTimingSamples: 10,
          },
        },
        toneCommits: {},
      },
    };

    const storage = memoryStorage();
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(persisted));
    storage.setItem(LOCAL_PROGRESS_HISTORY_KEY, JSON.stringify(legacyHistory));

    const boot = loadAppState({
      storage,
      environment,
      mode: "guided",
      layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
      newSeed: () => "should-not-be-used",
    });

    expect(boot.progressLoadStatus).toBe("loaded");
    expect(boot.loadedExistingProgress).toBe(true);
    expect(boot.storageWarning).toBe("");
    expect(boot.progress.measurements.motor.coordination[structureKey]).toMatchObject({
      scope: structureScope,
      timingSamples: 10,
      currentTimeToTypeMs: 180,
    });
    expect(boot.progress.measurements.motor.sameHandRevisits).toEqual({});
    expect(boot.progressHistory.motor.coordination[structureKey]?.timing).toHaveLength(2);
    expect(boot.progressHistory.motor.sameHandRevisits).toEqual({});

    const analysis = buildAnalysisV2Model(
      emptySemantic,
      boot.progress.measurements,
      boot.progressHistory,
    );
    expect(analysis.coordination.coordination).toEqual([
      expect.objectContaining({
        id: structureKey,
        scope: structureScope,
        ready: true,
        currentTimeToTypeMs: 180,
        history: [
          expect.objectContaining({ representativeTimingMs: 205 }),
          expect.objectContaining({ representativeTimingMs: 180 }),
        ],
      }),
    ]);
    expect(analysis.coordination.sameHandRevisits).toEqual([]);
  });
});
