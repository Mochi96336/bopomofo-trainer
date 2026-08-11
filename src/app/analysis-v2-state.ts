export type AnalysisV2Tab = "coordination" | "semantic" | "strategy";
export type AnalysisV2SemanticView = "correctness" | "confusion";
export type AnalysisV2CoordinationView = "paths" | "movement";

export interface AnalysisV2Preferences {
  readonly activeTab: AnalysisV2Tab;
  readonly semanticView: AnalysisV2SemanticView;
}

export interface AnalysisV2PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const PREFERENCES_KEY = "bopomofo-trainer.analysis-v2.v1";

export const ANALYSIS_V2_TABS: readonly AnalysisV2Tab[] = [
  "coordination",
  "semantic",
  "strategy",
];

const DEFAULT_PREFERENCES: AnalysisV2Preferences = {
  activeTab: "coordination",
  semanticView: "correctness",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAnalysisV2Tab(value: unknown): value is AnalysisV2Tab {
  return value === "coordination" || value === "semantic" || value === "strategy";
}

export function isAnalysisV2SemanticView(value: unknown): value is AnalysisV2SemanticView {
  return value === "correctness" || value === "confusion";
}

export function isAnalysisV2CoordinationView(value: unknown): value is AnalysisV2CoordinationView {
  return value === "paths" || value === "movement";
}

export function loadAnalysisV2Preferences(
  storage: AnalysisV2PreferenceStorage,
): AnalysisV2Preferences {
  try {
    const source = storage.getItem(PREFERENCES_KEY);
    if (source === null) return DEFAULT_PREFERENCES;
    const value = JSON.parse(source) as unknown;
    if (!isRecord(value) || !isAnalysisV2SemanticView(value.semanticView)) {
      return DEFAULT_PREFERENCES;
    }
    return {
      activeTab: isAnalysisV2Tab(value.activeTab) ? value.activeTab : "coordination",
      semanticView: value.semanticView,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveAnalysisV2Preferences(
  storage: AnalysisV2PreferenceStorage,
  value: AnalysisV2Preferences,
): void {
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    // Preferences remain session-only when storage is unavailable.
  }
}
