import { describe, expect, it } from "vitest";
import { createCatalogSupportIndex } from "../../src/curriculum/support.js";
import { FREQUENCY_FIRST_UTTERANCE_POLICY } from "../../src/curriculum/frequency-first-utterance.js";
import { createEmptyMeasurementSummaryV2 } from "../../src/measurement-v2/aggregate.js";
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

const support = createCatalogSupportIndex(PRACTICE);

function createProgress() {
  return createFreshProductProgress(
    support,
    "seed",
    "guided",
    "standard",
    "phase-4-v1",
    FREQUENCY_FIRST_UTTERANCE_POLICY,
  );
}

function parse(source: string, layoutId = "standard") {
  return parseProductProgress(
    source,
    support,
    "guided",
    layoutId,
    "phase-4-v1",
    FREQUENCY_FIRST_UTTERANCE_POLICY,
  );
}

describe("product progress codec", () => {
  it("round-trips schema 7 with an explicit measurement epoch", () => {
    const progress = createProgress();
    const parsed = parse(serializeProductProgress(progress));
    expect(parsed).toEqual(progress);
    expect(parsed!.schemaVersion).toBe(PRODUCT_PROGRESS_SCHEMA_VERSION);
    expect(parsed!.measurementEpoch).toBe(PRODUCT_MEASUREMENT_EPOCH);
    expect(parsed!.selection).toEqual({
      policyVersion: "frequency-first-utterance-v1",
      recentUtteranceIds: [],
      recentTemplateIds: [],
    });
  });

  it("migrates schema 6 identity/history but starts a fresh measurement epoch", () => {
    const current = JSON.parse(serializeProductProgress(createProgress())) as Record<string, unknown>;
    current.schemaVersion = 6;
    delete current.measurementEpoch;
    current.measurements = {
      policyVersion: "phase-3-v2",
      traceCount: 99,
      bindingObservationCount: 99,
      confusionObservationCount: 20,
      transitionObservationCount: 50,
      bindings: { legacy: { anything: true } },
      confusions: { legacy: { anything: true } },
      transitions: { legacy: { anything: true } },
    };

    const migrated = parse(JSON.stringify(current));
    expect(migrated).not.toBeNull();
    expect(migrated!.schemaVersion).toBe(PRODUCT_PROGRESS_SCHEMA_VERSION);
    expect(migrated!.measurementEpoch).toBe(PRODUCT_MEASUREMENT_EPOCH);
    expect(migrated!.measurements).toEqual(createEmptyMeasurementSummaryV2());
    expect(migrated!.seed).toBe("seed");
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

    const stalePolicy = JSON.parse(serializeProductProgress(progress)) as Record<string, unknown>;
    stalePolicy.curriculumPolicyVersion = "phase-4-v0";
    expect(parse(JSON.stringify(stalePolicy))).toBeNull();

    const staleSelection = JSON.parse(serializeProductProgress(progress)) as {
      selection: Record<string, unknown>;
    };
    staleSelection.selection.policyVersion = "frequency-first-utterance-v0";
    expect(parse(JSON.stringify(staleSelection))).toBeNull();
  });
});
