import { describe, expect, it } from "vitest";
import { bindingScopeKey, confusionScopeKey } from "../../src/measurement/aggregate.js";
import {
  bindingAggregateKey,
  confusionAggregateKey,
  createEmptyMeasurementSummaryV2,
  type MeasurementSummaryV2,
} from "../../src/measurement-v2/aggregate.js";
import { legacySelectionMeasurementView } from "../../src/measurement-v2/legacy-selection-view.js";

describe("legacy selection measurement view", () => {
  it("never manufactures motor transitions from canonical adjacency", () => {
    const view = legacySelectionMeasurementView(createEmptyMeasurementSummaryV2());
    expect(view.transitions).toEqual({});
    expect(view.transitionObservationCount).toBe(0);
  });

  it("rekeys v2 semantic aggregates to the legacy lookup identity", () => {
    const bindingScope = {
      mode: "guided" as const,
      layoutId: "zhuyin-standard",
      tokenId: "zhuyin:ㄒ",
    };
    const confusion = {
      mode: "guided" as const,
      layoutId: "zhuyin-standard",
      expectedToken: "zhuyin:ㄒ",
      actualToken: "zhuyin:ㄐ",
      occurrences: 2,
    };
    const summary: MeasurementSummaryV2 = {
      ...createEmptyMeasurementSummaryV2(),
      semantic: {
        ...createEmptyMeasurementSummaryV2().semantic,
        bindings: {
          [bindingAggregateKey(bindingScope)]: {
            scope: bindingScope,
            attempts: 5,
            errors: 1,
            timingSamples: 3,
            currentTimeToTypeMs: 120,
            bestTimeToTypeMs: 100,
          },
        },
        confusions: {
          [confusionAggregateKey(
            confusion.mode,
            confusion.layoutId,
            confusion.expectedToken,
            confusion.actualToken,
          )]: confusion,
        },
      },
    };

    const view = legacySelectionMeasurementView(summary);
    expect(view.bindings[bindingScopeKey(bindingScope)]).toMatchObject({ attempts: 5, errors: 1 });
    expect(view.confusions[confusionScopeKey(confusion)]).toMatchObject({ occurrences: 2 });
    expect(Object.keys(view.bindings)).not.toContain(bindingAggregateKey(bindingScope));
  });
});
