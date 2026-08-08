import type { DiagnosticModel } from "../diagnostics/types.js";
import {
  DIAGNOSTIC_PREFERENCES_KEY,
  type DiagnosticPreferenceStorage,
} from "./diagnostic-preferences.js";

function normalizePreferenceSource(source: string | null): string | null {
  if (source === null) return null;
  try {
    const parsed = JSON.parse(source) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return source;
    const record = parsed as Record<string, unknown>;
    if (record.activeTab !== "transition") return source;
    return JSON.stringify({ ...record, activeTab: "key" });
  } catch {
    return source;
  }
}

/**
 * Compatibility wrapper for users whose saved diagnostics tab still points at
 * the retired canonical-token transition view. The underlying archived module
 * remains readable, but production sessions reopen on semantic key diagnostics.
 */
export function productionDiagnosticPreferenceStorage(
  storage: DiagnosticPreferenceStorage,
): DiagnosticPreferenceStorage {
  return {
    getItem(key: string): string | null {
      const source = storage.getItem(key);
      return key === DIAGNOSTIC_PREFERENCES_KEY ? normalizePreferenceSource(source) : source;
    },
    setItem(key: string, value: string): void {
      storage.setItem(
        key,
        key === DIAGNOSTIC_PREFERENCES_KEY ? normalizePreferenceSource(value) ?? value : value,
      );
    },
  };
}

export function retireLegacyTransitionSummary(
  section: HTMLElement,
  model: DiagnosticModel,
): void {
  section.classList.add("input-order-v2-semantic-summary");
  const cards = [...section.querySelectorAll<HTMLElement>(".diagnostic-summary-signals > div")];
  cards.find((card) => card.querySelector("span")?.textContent === "轉換")?.remove();
  const summary = section.querySelector<HTMLElement>(".diagnostic-summary-heading p");
  if (summary !== null) {
    summary.textContent = `${model.summary.keysWithData} 鍵有資料 · ${model.summary.repeatedConfusions} 組重複誤按`;
  }
}

export function retireLegacyTransitionAnalysis(host: HTMLElement): void {
  host.querySelector("#diagnostic-analysis-tab-transition")?.remove();
}
