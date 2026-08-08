import { describe, expect, it } from "vitest";
import type { InputLayout } from "../../src/core/model.js";
import { FREQUENCY_FIRST_UTTERANCE_POLICY } from "../../src/curriculum/frequency-first-utterance.js";
import type { CatalogSupportIndex, CurriculumProfile } from "../../src/curriculum/types.js";
import { buildDiagnosticModel } from "../../src/diagnostics/build-model.js";
import { bindingScopeKey } from "../../src/measurement/aggregate.js";
import type { BindingAggregate, MeasurementSummary } from "../../src/measurement/types.js";

const layout: InputLayout = {
  id: "test-layout",
  name: "Test",
  bindings: { KeyA: "zhuyin:A" },
};
const scope = { mode: "guided" as const, layoutId: layout.id, tokenId: "zhuyin:A" };
const binding: BindingAggregate = {
  scope,
  attempts: 4,
  errors: 1,
  timingSamples: 2,
  currentTimeToTypeMs: 300,
  bestTimeToTypeMs: 250,
  // A compatibility projection has to satisfy the legacy shape, but these zero
  // values do not mean V2 observed zero exclusions.
  timingExclusions: { syllableStart: 0, incorrect: 1, recovery: 0, interactionNoise: 0 },
};
const measurements: MeasurementSummary = {
  policyVersion: "compatibility-view",
  traceCount: 4,
  bindingObservationCount: 4,
  confusionObservationCount: 0,
  transitionObservationCount: 0,
  bindings: { [bindingScopeKey(scope)]: binding },
  confusions: {},
  transitions: {},
};
const support: CatalogSupportIndex = {
  byToken: {
    "zhuyin:A": {
      tokenId: "zhuyin:A",
      entryIds: ["entry"],
      entryCount: 1,
      bindingEntryIds: ["entry"],
      bindingEntryCount: 1,
      motorEntryIds: ["entry"],
      motorEntryCount: 1,
      commonEntryCount: 1,
      commonBindingEntryCount: 1,
      commonMotorEntryCount: 1,
      commonnessTierCounts: { 1: 1, 2: 0, 3: 0, 4: 0 },
    },
  },
  entriesById: {},
};
const curriculum: CurriculumProfile = {
  mode: "guided",
  layoutId: layout.id,
  round: 0,
  bindings: {
    "zhuyin:A": { scope, aggregate: binding, lastFocusedRound: null },
  },
  recentEntryIds: [],
  recentTokenIds: [],
};

describe("diagnostic timing exclusion availability", () => {
  it("preserves real legacy breakdowns by default", () => {
    const model = buildDiagnosticModel({
      measurements,
      curriculum,
      support,
      layout,
      selectionPolicy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    });
    expect(model.keys[0]?.excludedSamples).toEqual(binding.timingExclusions);
  });

  it("uses null instead of fake zero counts when the source cannot preserve causes", () => {
    const model = buildDiagnosticModel({
      measurements,
      curriculum,
      support,
      layout,
      selectionPolicy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      timingExclusionsAvailable: false,
    });
    expect(model.keys[0]?.excludedSamples).toBeNull();
  });
});
