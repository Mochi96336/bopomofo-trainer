import type { DiagnosticModel } from "../diagnostics/types.js";
import {
  DIAGNOSTIC_PREFERENCES_KEY,
  type DiagnosticPreferenceStorage,
} from "./diagnostic-preferences.js";

const navigationGuardedHosts = new WeakSet<HTMLElement>();

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

function installSemanticTabNavigation(host: HTMLElement): void {
  if (navigationGuardedHosts.has(host)) return;
  navigationGuardedHosts.add(host);

  // The archived analysis controller still knows about its research-only
  // transition tab. Production removes that tab after every render, so its own
  // three-tab arrow-key state machine must not run: otherwise ArrowRight from
  // Key can activate a state whose tab was intentionally removed. Intercept the
  // tablist navigation before the generic bubble handler and route only between
  // the two production-visible semantic tabs. A click goes through the existing
  // controller path, keeping persistence, rendering and focus single-sourced.
  host.addEventListener("keydown", (event) => {
    if (!(event.target instanceof HTMLButtonElement)
      || event.target.getAttribute("role") !== "tab") return;
    const tabs = [...host.querySelectorAll<HTMLButtonElement>(
      '[role="tab"]:not(#diagnostic-analysis-tab-transition)',
    )];
    const currentIndex = tabs.indexOf(event.target);
    if (currentIndex < 0 || tabs.length === 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    tabs[nextIndex]!.click();
  }, { capture: true });
}

export function retireLegacyTransitionAnalysis(host: HTMLElement): void {
  host.querySelector("#diagnostic-analysis-tab-transition")?.remove();
  installSemanticTabNavigation(host);
}
