import { describe, expect, it } from "vitest";
import {
  HANDSHAPE_MEASUREMENT_V2_POLICY_VERSION,
  LEGACY_MEASUREMENT_V2_POLICY_VERSION,
  PREVIOUS_MEASUREMENT_V2_POLICY_VERSION,
  createEmptyMeasurementSummaryV2,
} from "../../src/measurement-v2/aggregate.js";
import { parseMeasurementSummaryV2 } from "../../src/measurement-v2/serialize.js";

const TOKENS = new Set(["zhuyin:ㄐ", "zhuyin:ㄧ", "zhuyin:ㄚ", "tone:1"]);

function withFutureStrategyEvidence(policyVersion: string): Record<string, unknown> {
  const legacy = structuredClone(createEmptyMeasurementSummaryV2()) as unknown as Record<string, unknown>;
  legacy.policyVersion = policyVersion;
  legacy.strategy = {
    inputOrderPositions: {},
    inputOrderPermutations: {
      '["input-order-permutation","3","middle-last-first"]': {
        scope: { bodySize: "3", permutation: "middle-last-first" },
        observations: 12,
      },
    },
    recentInputOrderTrajectories: [
      {
        bodySize: "3",
        permutation: "middle-last-first",
        elapsedMs: [0, 80, 190],
      },
    ],
  };
  return legacy;
}

describe("legacy Strategy evidence migration", () => {
  for (const policyVersion of [
    LEGACY_MEASUREMENT_V2_POLICY_VERSION,
    HANDSHAPE_MEASUREMENT_V2_POLICY_VERSION,
    PREVIOUS_MEASUREMENT_V2_POLICY_VERSION,
  ]) {
    it(`does not promote future Strategy channels from ${policyVersion}`, () => {
      const migrated = parseMeasurementSummaryV2(
        withFutureStrategyEvidence(policyVersion),
        "guided",
        "zhuyin-standard",
        TOKENS,
      );

      expect(migrated).not.toBeNull();
      expect(migrated?.strategy.inputOrderPermutations).toEqual({});
      expect(migrated?.strategy.recentInputOrderTrajectories).toEqual([]);
    });
  }

  it("still preserves those channels under the current policy", () => {
    const current = withFutureStrategyEvidence(createEmptyMeasurementSummaryV2().policyVersion);
    const parsed = parseMeasurementSummaryV2(current, "guided", "zhuyin-standard", TOKENS);

    expect(Object.keys(parsed?.strategy.inputOrderPermutations ?? {})).toHaveLength(1);
    expect(parsed?.strategy.recentInputOrderTrajectories).toEqual([
      {
        bodySize: "3",
        permutation: "middle-last-first",
        elapsedMs: [0, 80, 190],
      },
    ]);
  });
});
