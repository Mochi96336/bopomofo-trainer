import { describe, expect, it } from "vitest";
import {
  diagnosticNetworkVisible,
  openDiagnosticAnalysisState,
  selectDiagnosticAnalysisTab,
  toggleDiagnosticNetwork,
  type DiagnosticAnalysisState,
} from "../../src/app/diagnostic-analysis-state.js";
import {
  DEFAULT_DIAGNOSTIC_PREFERENCES,
} from "../../src/app/diagnostic-preferences.js";

function state(overrides: Partial<DiagnosticAnalysisState> = {}): DiagnosticAnalysisState {
  return {
    preferences: DEFAULT_DIAGNOSTIC_PREFERENCES,
    selection: {
      selectedKey: null,
      selectedRelationId: null,
    },
    ...overrides,
  };
}

describe("diagnostic analysis state", () => {
  it("uses the saved overview choice for key and transition, but always closes it for confusion", () => {
    expect(openDiagnosticAnalysisState(DEFAULT_DIAGNOSTIC_PREFERENCES, "key").preferences.networkOverlay)
      .toBe(true);

    const savedOff = {
      ...DEFAULT_DIAGNOSTIC_PREFERENCES,
      networkOverlay: false,
    };
    expect(openDiagnosticAnalysisState(savedOff, "key").preferences.networkOverlay)
      .toBe(false);
    expect(openDiagnosticAnalysisState(savedOff, "transition").preferences.networkOverlay)
      .toBe(false);

    const savedOn = {
      ...DEFAULT_DIAGNOSTIC_PREFERENCES,
      networkOverlay: true,
    };
    expect(openDiagnosticAnalysisState(savedOn, "confusion").preferences.networkOverlay)
      .toBe(false);
  });

  it("really closes the overview when confusion becomes active, even while a key hides it", () => {
    const current = state({
      preferences: {
        ...DEFAULT_DIAGNOSTIC_PREFERENCES,
        activeTab: "transition",
        networkOverlay: true,
      },
      selection: {
        selectedKey: "zhuyin:ㄌ",
        selectedRelationId: "transition:one",
      },
    });

    const next = selectDiagnosticAnalysisTab(current, "confusion");

    expect(next.preferences).toMatchObject({
      activeTab: "confusion",
      networkOverlay: false,
    });
    expect(next.selection).toEqual({
      selectedKey: "zhuyin:ㄌ",
      selectedRelationId: null,
    });
  });

  it("keeps the chosen network state when moving between key and transition", () => {
    const current = state({
      preferences: {
        ...DEFAULT_DIAGNOSTIC_PREFERENCES,
        activeTab: "key",
        networkOverlay: false,
      },
    });

    expect(selectDiagnosticAnalysisTab(current, "transition").preferences)
      .toMatchObject({ activeTab: "transition", networkOverlay: false });
  });

  it("enabling the transition overview from confusion returns to transition", () => {
    const current = state({
      preferences: {
        ...DEFAULT_DIAGNOSTIC_PREFERENCES,
        activeTab: "confusion",
        networkOverlay: false,
      },
      selection: {
        selectedKey: "zhuyin:ㄌ",
        selectedRelationId: "confusion:one",
      },
    });

    const next = toggleDiagnosticNetwork(current);

    expect(next.preferences).toMatchObject({
      activeTab: "transition",
      networkOverlay: true,
    });
    expect(next.selection).toEqual({
      selectedKey: null,
      selectedRelationId: null,
    });
    expect(diagnosticNetworkVisible(next)).toBe(true);
  });

  it("turns an active transition overview off without changing its tab", () => {
    const current = state({
      preferences: {
        ...DEFAULT_DIAGNOSTIC_PREFERENCES,
        activeTab: "transition",
        networkOverlay: true,
      },
    });

    const next = toggleDiagnosticNetwork(current);

    expect(next.preferences).toMatchObject({
      activeTab: "transition",
      networkOverlay: false,
    });
    expect(next.selection).toBe(current.selection);
  });

  it("treats confusion and active selections as network-suppressed states", () => {
    expect(diagnosticNetworkVisible(state({
      preferences: {
        ...DEFAULT_DIAGNOSTIC_PREFERENCES,
        activeTab: "confusion",
        networkOverlay: true,
      },
    }))).toBe(false);

    expect(diagnosticNetworkVisible(state({
      selection: {
        selectedKey: "zhuyin:ㄌ",
        selectedRelationId: null,
      },
    }))).toBe(false);
  });
});
