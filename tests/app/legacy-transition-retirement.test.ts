import { describe, expect, it } from "vitest";
import type { DiagnosticModel } from "../../src/diagnostics/types.js";
import {
  productionDiagnosticPreferenceStorage,
  retireLegacyTransitionAnalysis,
  retireLegacyTransitionSummary,
} from "../../src/app/legacy-transition-retirement.js";
import { DIAGNOSTIC_PREFERENCES_KEY } from "../../src/app/diagnostic-preferences.js";

function memoryStorage(initial: string | null) {
  let value = initial;
  return {
    storage: {
      getItem(key: string) {
        return key === DIAGNOSTIC_PREFERENCES_KEY ? value : null;
      },
      setItem(key: string, next: string) {
        if (key === DIAGNOSTIC_PREFERENCES_KEY) value = next;
      },
    },
    value: () => value,
  };
}

describe("legacy transition retirement", () => {
  it("maps a saved transition tab back to key diagnostics", () => {
    const source = JSON.stringify({
      expanded: true,
      activeTab: "transition",
      keySort: "timing",
      networkOverlay: true,
    });
    const memory = memoryStorage(source);
    const storage = productionDiagnosticPreferenceStorage(memory.storage);
    expect(JSON.parse(storage.getItem(DIAGNOSTIC_PREFERENCES_KEY)!)).toMatchObject({
      activeTab: "key",
    });
    storage.setItem(DIAGNOSTIC_PREFERENCES_KEY, source);
    expect(JSON.parse(memory.value()!)).toMatchObject({ activeTab: "key" });
  });

  it("removes the transition summary card and analysis tab without touching archived model data", () => {
    const section = document.createElement("section");
    section.innerHTML = `<div class="diagnostic-summary-heading"><p>old</p></div>
      <div class="diagnostic-summary-signals">
        <div><span>按鍵</span></div>
        <div><span>轉換</span></div>
        <div><span>誤按</span></div>
      </div>`;
    const model = {
      summary: { keysWithData: 7, repeatedConfusions: 2, slowerTransitions: 9 },
      transitions: [{ id: "archived-row" }],
    } as unknown as DiagnosticModel;
    retireLegacyTransitionSummary(section, model);
    expect([...section.querySelectorAll(".diagnostic-summary-signals span")].map((node) => node.textContent))
      .toEqual(["按鍵", "誤按"]);
    expect(section.querySelector(".diagnostic-summary-heading p")?.textContent)
      .toBe("7 鍵有資料 · 2 組重複誤按");
    expect(model.transitions).toHaveLength(1);

    const host = document.createElement("section");
    host.innerHTML = `<button id="diagnostic-analysis-tab-key"></button>
      <button id="diagnostic-analysis-tab-transition"></button>
      <button id="diagnostic-analysis-tab-confusion"></button>`;
    retireLegacyTransitionAnalysis(host);
    expect(host.querySelector("#diagnostic-analysis-tab-transition")).toBeNull();
  });
});
