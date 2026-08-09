// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createAnalysisV2,
  type AnalysisV2PreferenceStorage,
} from "../../src/app/analysis-v2-panel.js";
import type { AnalysisV2Model } from "../../src/app/analysis-v2-model.js";

function memoryStorage(): AnalysisV2PreferenceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

function motorCell<Scope>(
  id: string,
  scope: Scope,
  timingSamples: number,
  currentTimeToTypeMs: number | null,
) {
  return {
    id,
    scope,
    observations: timingSamples,
    timingSamples,
    currentTimeToTypeMs,
    bestTimeToTypeMs: currentTimeToTypeMs,
    ready: timingSamples >= 5 && currentTimeToTypeMs !== null,
    history: [],
    partialTimingSamples: 0,
  };
}

function model(): AnalysisV2Model {
  return {
    semantic: {
      keys: [],
      confusions: [],
      keyProgress: {},
      keysWithData: 0,
      repeatedConfusions: 0,
    },
    coordination: {
      immediateTokens: [
        motorCell(
          '["immediate-token","zhuyin:ㄅ","zhuyin:ㄆ"]',
          { fromToken: "zhuyin:ㄅ", toToken: "zhuyin:ㄆ" },
          6,
          120,
        ),
        motorCell(
          '["immediate-token","zhuyin:ㄇ","tone:2"]',
          { fromToken: "zhuyin:ㄇ", toToken: "tone:2" },
          7,
          160,
        ),
      ],
      coordination: [],
      immediateHands: [],
      sameHandRevisits: [],
      toneCommits: [],
      observedTokenTransitions: 2,
      readyTokenTransitions: 2,
      observedScopes: 0,
      readyScopes: 0,
      cleanTimingSamples: 0,
    },
    strategy: {
      inputOrderPositions: [],
      totalObservations: 0,
      bodySizeBucketsWithData: 0,
    },
  };
}

let controller: ReturnType<typeof createAnalysisV2> | null = null;

function open(source: AnalysisV2Model): HTMLElement {
  controller = createAnalysisV2({ getModel: () => source, storage: memoryStorage() });
  controller.open();
  return controller.host;
}

function selectTab(host: HTMLElement, tab: "coordination" | "semantic" | "strategy"): void {
  host.querySelector<HTMLButtonElement>(`[data-action="select-tab"][data-tab="${tab}"]`)?.click();
}

afterEach(() => {
  controller?.destroy();
  controller = null;
  document.body.innerHTML = "";
});

describe("Analysis V2 evidence honesty", () => {
  it("ranks confusion lead keys by attributable error count, not destination concentration", () => {
    const source = model();
    source.semantic = {
      ...source.semantic,
      keys: [
        {
          tokenId: "zhuyin:ㄅ",
          symbol: "ㄅ",
          physicalCode: "Digit1",
          physicalKey: "1",
          attempts: 20,
          errors: 8,
          displayedErrorRatio: 0.4,
          errorDataState: "sufficient",
          timingAvailability: "available",
          timingMs: 100,
          timingSamples: 10,
          timingDataState: "sufficient",
        },
        {
          tokenId: "zhuyin:ㄆ",
          symbol: "ㄆ",
          physicalCode: "KeyQ",
          physicalKey: "Q",
          attempts: 20,
          errors: 9,
          displayedErrorRatio: 0.45,
          errorDataState: "sufficient",
          timingAvailability: "available",
          timingMs: 100,
          timingSamples: 10,
          timingDataState: "sufficient",
        },
      ],
      confusions: [
        {
          id: "b-to-p",
          expectedTokenId: "zhuyin:ㄅ",
          actualTokenId: "zhuyin:ㄆ",
          expectedSymbol: "ㄅ",
          actualSymbol: "ㄆ",
          expectedPhysicalKey: "1",
          actualPhysicalKey: "Q",
          occurrences: 5,
          expectedConfusionTotal: 8,
          expectedErrorShare: 5 / 8,
          dataState: "sufficient",
        },
        {
          id: "p-to-b",
          expectedTokenId: "zhuyin:ㄆ",
          actualTokenId: "zhuyin:ㄅ",
          expectedSymbol: "ㄆ",
          actualSymbol: "ㄅ",
          expectedPhysicalKey: "Q",
          actualPhysicalKey: "1",
          occurrences: 6,
          expectedConfusionTotal: 9,
          expectedErrorShare: 6 / 9,
          dataState: "sufficient",
        },
      ],
      repeatedConfusions: 2,
    };
    const host = open(source);
    selectTab(host, "semantic");
    host.querySelector<HTMLButtonElement>(
      '[data-action="semantic-view"][data-value="confusion"]',
    )?.click();

    expect(host.querySelector(".analysis-v2-semantic-symbols")?.textContent?.trim().startsWith("ㄆ"))
      .toBe(true);
  });

  it("does not promote a one-observation strategy deviation to a 100% hero", () => {
    const source = model();
    source.strategy = {
      inputOrderPositions: [{
        scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "first" },
        observations: 1,
      }],
      totalObservations: 1,
      bodySizeBucketsWithData: 1,
    };
    const host = open(source);
    selectTab(host, "strategy");

    expect(host.querySelector(".analysis-v2-strategy-readout")?.textContent).toContain("仍在累積");
    expect(host.querySelector(".analysis-v2-strategy-readout")?.textContent).not.toContain("100%");
  });

  it("promotes a strategy deviation only after its canonical row has enough support", () => {
    const source = model();
    source.strategy = {
      inputOrderPositions: [
        {
          scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "last" },
          observations: 6,
        },
        {
          scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "first" },
          observations: 4,
        },
      ],
      totalObservations: 10,
      bodySizeBucketsWithData: 1,
    };
    const host = open(source);
    selectTab(host, "strategy");

    const lead = host.querySelector(".analysis-v2-strategy-readout");
    expect(lead?.textContent).toContain("後 → 前");
    expect(lead?.textContent).toContain("40%");
    expect(lead?.textContent).toContain("4 / 10");
  });

  it("keeps visible-family scope explicit in the single lower readout without copy above the keyboard", () => {
    const host = open(model());
    const readout = host.querySelector(".analysis-v2-speed-readout");
    expect(readout?.textContent)
      .toContain("僅在畫面中的同類實際鍵間轉換中比較");
    expect(readout?.textContent).toContain("2 條可比較");
    expect(readout?.textContent).toContain("線粗代表樣本支持");
    expect(host.querySelector(".analysis-v2-speed-caption")).toBeNull();
    expect(host.querySelectorAll(".analysis-v2-speed-hit")).toHaveLength(2);
    expect(host.querySelectorAll(".analysis-v2-speed-path")).toHaveLength(2);
    expect(host.querySelector(".analysis-v2-speed-hit")?.getAttribute("aria-hidden")).toBe("true");
  });
});
