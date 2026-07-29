import type { TokenId } from "../core/model.js";
import type {
  DiagnosticPreferences,
  DiagnosticTab,
} from "./diagnostic-preferences.js";

export interface DiagnosticAnalysisSelection {
  readonly selectedKey: TokenId | null;
  readonly selectedRelationId: string | null;
}

export interface DiagnosticAnalysisState {
  readonly preferences: DiagnosticPreferences;
  readonly selection: DiagnosticAnalysisSelection;
}

function emptySelection(): DiagnosticAnalysisSelection {
  return {
    selectedKey: null,
    selectedRelationId: null,
  };
}

/**
 * Creates one canonical state whenever analysis opens. The transition network
 * remains the default overview for key and transition views, but confusion is
 * always entered as its own per-tab relationship view.
 */
export function openDiagnosticAnalysisState(
  loadedPreferences: DiagnosticPreferences,
  initialTab?: DiagnosticTab,
): DiagnosticAnalysisState {
  const activeTab = initialTab ?? loadedPreferences.activeTab;
  return {
    preferences: {
      ...loadedPreferences,
      activeTab,
      networkOverlay: activeTab !== "confusion",
    },
    selection: emptySelection(),
  };
}

/**
 * Tabs own their view-mode invariants. A selected key is intentionally kept as
 * the optional cross-view relationship filter, while a relation selection is
 * local to the tab that produced it.
 */
export function selectDiagnosticAnalysisTab(
  current: DiagnosticAnalysisState,
  tab: DiagnosticTab,
): DiagnosticAnalysisState {
  return {
    preferences: {
      ...current.preferences,
      activeTab: tab,
      networkOverlay: tab === "confusion"
        ? false
        : current.preferences.networkOverlay,
    },
    selection: {
      ...current.selection,
      selectedRelationId: null,
    },
  };
}

export function diagnosticNetworkVisible(
  current: DiagnosticAnalysisState,
): boolean {
  return current.preferences.activeTab !== "confusion"
    && current.preferences.networkOverlay
    && current.selection.selectedKey === null
    && current.selection.selectedRelationId === null;
}

/**
 * The network is a transition overview, so enabling it from confusion moves to
 * the transition tab. Showing the network also clears selections that would
 * otherwise immediately suppress it.
 */
export function toggleDiagnosticNetwork(
  current: DiagnosticAnalysisState,
): DiagnosticAnalysisState {
  const makeVisible = !diagnosticNetworkVisible(current);
  return {
    preferences: {
      ...current.preferences,
      activeTab: makeVisible && current.preferences.activeTab === "confusion"
        ? "transition"
        : current.preferences.activeTab,
      networkOverlay: makeVisible,
    },
    selection: makeVisible ? emptySelection() : current.selection,
  };
}
