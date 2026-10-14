import { describe, expect, it } from "vitest";
import { createCatalogSupportIndex } from "../../src/curriculum/support.js";
import { FREQUENCY_FIRST_UTTERANCE_POLICY } from "../../src/curriculum/frequency-first-utterance.js";
import {
  confusionAggregateKey,
  createEmptyMeasurementSummaryV2,
} from "../../src/measurement-v2/aggregate.js";
import {
  createFreshProductProgress,
  parseProductProgress,
  serializeProductProgress,
} from "../../src/product/progress.js";
import {
  PRODUCT_MEASUREMENT_EPOCH,
  PRODUCT_PROGRESS_SCHEMA_VERSION,
} from "../../src/product/types.js";
import { PRACTICE } from "./fixtures.js";
import { legacyProgressDraft } from "./legacy-progress-fixture.js";

const support = createCatalogSupportIndex(PRACTICE);

function createProgress() {
  return createFreshProductProgress(
    "seed",
    "guided",
    "standard",
    FREQUENCY_FIRST_UTTERANCE_POLICY,
  );
}

function parse(source: string, layoutId = "standard") {
  return parseProductProgress(
    source,
    support,
    "guided",
    layoutId,
    FREQUENCY_FIRST_UTTERANCE_POLICY,
  );
}

function summary() {
  return {
    kind: "practice" as const,
    exerciseId: "practice-1",
    completedAt: "2026-08-01T00:00:00.000Z",
    entryIds: [PRACTICE[0]!.id],
    utteranceId: "utterance:practice-1",
    templateId: null,
    focusTokenId: null,
    focusEvidence: null,
    attempts: 9,
    errors: 2,
    timingSamples: 6,
  };
}

describe("product progress codec", () => {
  it("round-trips schema 8 with current selection recency", () => {
    const progress = createProgress();
    const parsed = parse(serializeProductProgress(progress));
    expect(parsed).toEqual(progress);
    expect(parsed!.schemaVersion).toBe(PRODUCT_PROGRESS_SCHEMA_VERSION);
    expect(parsed!.measurementEpoch).toBe(PRODUCT_MEASUREMENT_EPOCH);
    expect(parsed!.selection).toEqual({
      policyVersion: "frequency-first-utterance-v1",
      recentEntryIds: [],
      recentUtteranceIds: [],
      recentTemplateIds: [],
    });
  });

  it("reloads progress when a confusion actual token is mapped but outside catalog support", () => {
    expect(support.byToken["zhuyin:ㄦ"]).toBeUndefined();
    const progress = createProgress();
    const confusion = {
      mode: "guided" as const,
      layoutId: "standard",
      expectedToken: "zhuyin:ㄅ",
      actualToken: "zhuyin:ㄦ",
      occurrences: 1,
    };
    const withConfusion = {
      ...progress,
      measurements: {
        ...progress.measurements,
        semantic: {
          ...progress.measurements.semantic,
          confusions: {
            [confusionAggregateKey(
              confusion.mode,
              confusion.layoutId,
              confusion.expectedToken,
              confusion.actualToken,
            )]: confusion,
          },
        },
      },
    };

    expect(parse(serializeProductProgress(withConfusion))).toEqual(withConfusion);
  });

  it("migrates schema 7 by moving recent entries out of the legacy curriculum envelope", () => {
    const current = {
      ...createProgress(),
      selection: {
        ...createProgress().selection,
        recentEntryIds: [PRACTICE[0]!.id],
        recentUtteranceIds: ["utterance:practice-1"],
      },
      practiceRoundsCompleted: 1,
      recentSummaries: [summary()],
    };
    const legacy = legacyProgressDraft(current, 7);

    const migrated = parse(JSON.stringify(legacy));
    expect(migrated).not.toBeNull();
    expect(migrated!.schemaVersion).toBe(PRODUCT_PROGRESS_SCHEMA_VERSION);
    expect(migrated!.measurements).toEqual(current.measurements);
    expect(migrated!.selection.recentEntryIds).toEqual([PRACTICE[0]!.id]);
    expect(migrated!.selection.recentUtteranceIds).toEqual(["utterance:practice-1"]);
    expect(migrated!.recentSummaries).toEqual(current.recentSummaries);
    expect("curriculum" in migrated!).toBe(false);
    expect("curriculumPolicyVersion" in migrated!).toBe(false);
  });

  it("migrates schema 6 identity/selection but starts a complete fresh measurement epoch", () => {
    const current = {
      ...createProgress(),
      selection: {
        ...createProgress().selection,
        recentEntryIds: [PRACTICE[0]!.id],
        recentUtteranceIds: ["legacy-round"],
      },
      practiceRoundsCompleted: 1,
      recentSummaries: [summary()],
    };
    const legacy = legacyProgressDraft(current, 6);
    legacy.measurements = {
      policyVersion: "phase-3-v2",
      traceCount: 99,
      bindingObservationCount: 99,
      confusionObservationCount: 20,
      transitionObservationCount: 50,
      bindings: { legacy: { anything: true } },
      confusions: { legacy: { anything: true } },
      transitions: { legacy: { anything: true } },
    };

    const migrated = parse(JSON.stringify(legacy));
    expect(migrated).not.toBeNull();
    expect(migrated!.schemaVersion).toBe(PRODUCT_PROGRESS_SCHEMA_VERSION);
    expect(migrated!.measurementEpoch).toBe(PRODUCT_MEASUREMENT_EPOCH);
    expect(migrated!.measurements).toEqual(createEmptyMeasurementSummaryV2());
    expect(migrated!.recentSummaries).toEqual([]);
    expect(migrated!.practiceRoundsCompleted).toBe(1);
    expect(migrated!.seed).toBe("seed");
    expect(migrated!.selection.recentEntryIds).toEqual([PRACTICE[0]!.id]);
  });

  it("rejects every older progress schema without a safe migration", () => {
    const progress = createProgress();
    for (const schemaVersion of [1, 2, 3, 4, 5]) {
      const obsolete = JSON.parse(serializeProductProgress(progress)) as Record<string, unknown>;
      obsolete.schemaVersion = schemaVersion;
      expect(parse(JSON.stringify(obsolete))).toBeNull();
    }
  });

  it("rejects malformed, stale, and wrong-scope state", () => {
    const progress = createProgress();
    expect(parse("not-json")).toBeNull();
    expect(parse(serializeProductProgress(progress), "other-layout")).toBeNull();

    const stale = JSON.parse(serializeProductProgress(progress)) as Record<string, unknown>;
    stale.schemaVersion = 99;
    expect(parse(JSON.stringify(stale))).toBeNull();

    const staleEpoch = JSON.parse(serializeProductProgress(progress)) as Record<string, unknown>;
    staleEpoch.measurementEpoch = "other-epoch";
    expect(parse(JSON.stringify(staleEpoch))).toBeNull();

    const missingRecentEntries = JSON.parse(serializeProductProgress(progress)) as {
      selection: Record<string, unknown>;
    };
    delete missingRecentEntries.selection.recentEntryIds;
    expect(parse(JSON.stringify(missingRecentEntries))).toBeNull();

    const staleSelection = JSON.parse(serializeProductProgress(progress)) as {
      selection: Record<string, unknown>;
    };
    staleSelection.selection.policyVersion = "frequency-first-utterance-v0";
    expect(parse(JSON.stringify(staleSelection))).toBeNull();

    const malformedLegacy = legacyProgressDraft(progress, 7);
    delete malformedLegacy.curriculum.recentEntryIds;
    expect(parse(JSON.stringify(malformedLegacy))).toBeNull();
  });
});
