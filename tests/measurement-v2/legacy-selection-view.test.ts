import { describe, expect, it } from "vitest";
import { legacySelectionMeasurementView } from "../../src/measurement-v2/legacy-selection-view.js";
import { createEmptyMeasurementSummaryV2 } from "../../src/measurement-v2/aggregate.js";

describe("legacy selection measurement view", () => {
  it("never manufactures motor transitions from canonical adjacency", () => {
    const view = legacySelectionMeasurementView(createEmptyMeasurementSummaryV2());
    expect(view.transitions).toEqual({});
    expect(view.transitionObservationCount).toBe(0);
  });
});
