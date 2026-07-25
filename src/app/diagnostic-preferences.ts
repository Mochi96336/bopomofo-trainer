import type {
  KeyDiagnosticSort,
} from "../diagnostics/selectors.js";

export type DiagnosticTab = "key" | "transition" | "confusion";

export interface DiagnosticPreferences {
  readonly expanded: boolean;
  readonly activeTab: DiagnosticTab;
  readonly keySort: KeyDiagnosticSort;
  readonly networkOverlay: boolean;
}

export interface DiagnosticPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DIAGNOSTIC_PREFERENCES_KEY = "bopomofo-trainer.diagnostics.v1";

export const DEFAULT_DIAGNOSTIC_PREFERENCES: DiagnosticPreferences = {
  expanded: true,
  activeTab: "key",
  keySort: "error-ratio",
  networkOverlay: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTab(value: unknown): value is DiagnosticTab {
  return value === "key" || value === "transition" || value === "confusion";
}

function isKeySort(value: unknown): value is KeyDiagnosticSort {
  return value === "error-ratio" || value === "timing";
}

export function parseDiagnosticPreferences(source: string): DiagnosticPreferences | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return null;
  }
  if (
    !isRecord(parsed)
    || typeof parsed.expanded !== "boolean"
    || !isTab(parsed.activeTab)
    || !isKeySort(parsed.keySort)
    || typeof parsed.networkOverlay !== "boolean"
  ) return null;
  return {
    expanded: parsed.expanded,
    activeTab: parsed.activeTab,
    keySort: parsed.keySort,
    networkOverlay: parsed.networkOverlay,
  };
}

export function loadDiagnosticPreferences(
  storage: DiagnosticPreferenceStorage,
): DiagnosticPreferences {
  const source = storage.getItem(DIAGNOSTIC_PREFERENCES_KEY);
  if (source === null) return DEFAULT_DIAGNOSTIC_PREFERENCES;
  return parseDiagnosticPreferences(source) ?? DEFAULT_DIAGNOSTIC_PREFERENCES;
}

export function saveDiagnosticPreferences(
  storage: DiagnosticPreferenceStorage,
  preferences: DiagnosticPreferences,
): void {
  storage.setItem(DIAGNOSTIC_PREFERENCES_KEY, JSON.stringify(preferences));
}
