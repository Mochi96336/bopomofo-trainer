// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createDiagnosticAnalysis } from "../../src/app/diagnostic-panel.js";
import type { DiagnosticPreferenceStorage } from "../../src/app/diagnostic-preferences.js";
import { installMatchMedia } from "./app-harness.js";
import type {
  DiagnosticModel,
  KeyDiagnostic,
} from "../../src/diagnostics/types.js";

/**
 * The analysis panel driven as a panel rather than read as source.
 *
 * `createDiagnosticAnalysis` already took its model and its storage as
 * arguments and holds no module state, so nothing here needed restructuring to
 * become testable -- the only thing missing was a DOM to build it over. The
 * model is written out literally because this is the consumer of a model, not
 * its producer; building one through `buildDiagnosticModel` would put a
 * measurement pipeline between the test and what it is asserting.
 */

function keyDiagnostic(
  tokenId: string,
  symbol: string,
  physicalKey: string,
  overrides: Partial<KeyDiagnostic> = {},
): KeyDiagnostic {
  return {
    tokenId,
    symbol,
    physicalCode: `Key${physicalKey.toUpperCase()}`,
    physicalKey,
    attempts: 12,
    errors: 3,
    displayedErrorRatio: 0.25,
    errorMetricLabel: "錯誤觀察比例",
    errorDataState: "sufficient",
    timingAvailability: "available",
    timingMs: 480,
    timingSamples: 8,
    bestTimingMs: 320,
    timingDataState: "sufficient",
    excludedSamples: {
      syllableStart: 1,
      incorrect: 3,
      recovery: 0,
      interactionNoise: 0,
    },
    overallDataState: "sufficient",
    reinforcement: {
      state: "reinforced",
      label: "加強中",
      reason: "近期錯誤偏高",
      expectedTokenBoost: 1.4,
    },
    ...overrides,
  };
}

const MODEL: DiagnosticModel = {
  summary: { keysWithData: 2, repeatedConfusions: 1, slowerTransitions: 0 },
  keys: [
    keyDiagnostic("zhuyin:ㄓ", "ㄓ", "5"),
    keyDiagnostic("zhuyin:ㄗ", "ㄗ", "y", {
      displayedErrorRatio: 0.5,
      timingMs: 900,
    }),
  ],
  transitions: [],
  confusions: [{
    id: "confusion:1",
    expectedTokenId: "zhuyin:ㄓ",
    actualTokenId: "zhuyin:ㄗ",
    expectedSymbol: "ㄓ",
    actualSymbol: "ㄗ",
    expectedPhysicalKey: "5",
    actualPhysicalKey: "y",
    occurrences: 4,
    expectedConfusionTotal: 5,
    expectedErrorShare: 0.8,
    dataState: "sufficient",
  }],
  // Absent history is a state the chart already handles; supplying none keeps
  // this fixture about the panel rather than about progress series.
  keyProgress: {},
};

function memoryPreferences(): DiagnosticPreferenceStorage {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
  };
}

let controller: ReturnType<typeof createDiagnosticAnalysis> | null = null;

function open(): HTMLElement {
  installMatchMedia();
  controller = createDiagnosticAnalysis({
    getModel: () => MODEL,
    storage: memoryPreferences(),
  });
  controller.open();
  const host = document.querySelector<HTMLElement>("#diagnostic-analysis");
  if (host === null) throw new Error("analysis host did not mount");
  return host;
}

afterEach(() => {
  controller?.destroy();
  controller = null;
  document.body.innerHTML = "";
});

describe("diagnostic analysis panel", () => {
  it("renders the keys it was given", () => {
    const host = open();
    expect(host.hidden).toBe(false);
    expect(host.textContent).toContain("ㄓ");
    expect(host.textContent).toContain("ㄗ");
  });

  /**
   * Every control press replaces the panel's markup wholesale, which destroys
   * the element that was pressed. Sorting is the case that proves the identity
   * is restored rather than reassigned: unlike the tabs, nothing focuses it
   * afterwards, so if the identity were not captured before the rebuild and
   * matched after it, focus would fall to the body.
   */
  it("keeps focus on a control that rebuilt the panel under itself", () => {
    const host = open();
    const sort = host.querySelector<HTMLButtonElement>(
      '[data-action="key-sort"][data-value="timing"]',
    );
    if (sort === null) throw new Error("expected a sort control");
    sort.focus();
    expect(document.activeElement).toBe(sort);

    sort.click();

    const rebuilt = host.querySelector<HTMLButtonElement>(
      '[data-action="key-sort"][data-value="timing"]',
    );
    expect(rebuilt).not.toBe(sort);
    // Sorting is a radio group: one alternative is in effect at a time, and
    // choosing one releases the other.
    expect(rebuilt?.getAttribute("aria-checked")).toBe("true");
    expect(document.activeElement).toBe(rebuilt);
  });

  it("selects a key and shows it in the inspector", () => {
    const host = open();
    const key = host.querySelector<HTMLElement>('[data-action="select-key"]');
    if (key === null) throw new Error("expected a selectable key");
    key.click();
    expect(host.querySelector(".diagnostic-inspector-detail")?.textContent?.trim())
      .not.toBe("");
  });

  it("closes on its own close control", () => {
    const host = open();
    host.querySelector<HTMLButtonElement>('[data-action="close-analysis"]')?.click();
    expect(host.hidden === true || host.classList.contains("closing")).toBe(true);
  });

  it("leaves no host behind once destroyed", () => {
    open();
    controller?.destroy();
    controller = null;
    expect(document.querySelector("#diagnostic-analysis")).toBeNull();
  });
});
