// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createAnalysisV2,
  type AnalysisV2PreferenceStorage,
} from "../../src/app/analysis-v2-panel.js";
import type { AnalysisV2Model } from "../../src/app/analysis-v2-model.js";

const MODEL: AnalysisV2Model = {
  semantic: {
    keys: [{
      tokenId: "zhuyin:ㄅ",
      symbol: "ㄅ",
      physicalCode: "Digit1",
      physicalKey: "1",
      attempts: 10,
      errors: 2,
      displayedErrorRatio: 0.2,
      errorMetricLabel: "錯誤觀察比例",
      errorDataState: "sufficient",
      timingAvailability: "available",
      timingMs: 100,
      timingSamples: 8,
      bestTimingMs: 80,
      timingDataState: "sufficient",
      excludedSamples: null,
      overallDataState: "sufficient",
      reinforcement: {
        state: "neutral",
        label: "穩定",
        reason: "test",
        expectedTokenBoost: 1,
      },
    }],
    confusions: [{
      id: "confusion",
      expectedTokenId: "zhuyin:ㄅ",
      actualTokenId: "zhuyin:ㄆ",
      expectedSymbol: "ㄅ",
      actualSymbol: "ㄆ",
      expectedPhysicalKey: "1",
      actualPhysicalKey: "q",
      occurrences: 3,
      expectedConfusionTotal: 3,
      expectedErrorShare: 1,
      dataState: "sufficient",
    }],
    keyProgress: {},
    keysWithData: 1,
    repeatedConfusions: 1,
  },
  coordination: {
    coordination: [],
    immediateHands: [{
      id: "hand",
      scope: { fromHand: "left", toHand: "right" },
      observations: 8,
      timingSamples: 6,
      currentTimeToTypeMs: 88,
      bestTimeToTypeMs: 70,
      ready: true,
      history: [{
        endingSample: 5,
        completedRound: 5,
        samples: 5,
        representativeTimingMs: 92,
      }],
      partialTimingSamples: 1,
    }],
    sameHandRevisits: [],
    toneCommits: [],
    observedScopes: 1,
    readyScopes: 1,
    cleanTimingSamples: 6,
  },
  strategy: {
    inputOrderPositions: [{
      scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "first" },
      observations: 4,
    }],
    totalObservations: 4,
    bodySizeBucketsWithData: 1,
  },
};

function memoryStorage(): AnalysisV2PreferenceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

let controller: ReturnType<typeof createAnalysisV2> | null = null;

function open() {
  controller = createAnalysisV2({ getModel: () => MODEL, storage: memoryStorage() });
  controller.open();
  return controller.host;
}

afterEach(() => {
  controller?.destroy();
  controller = null;
  document.body.innerHTML = "";
});

describe("Analysis V2 panel", () => {
  it("uses semantic, coordination, and strategy as the top-level tabs", () => {
    const host = open();
    const tabs = [...host.querySelectorAll('[role="tab"]')].map((node) => node.textContent);
    expect(tabs).toEqual(["語意", "協調", "策略"]);
    expect(host.textContent).not.toContain("轉換總覽");
  });

  it("switches semantic analysis from key correctness to a directional confusion matrix", () => {
    const host = open();
    host.querySelector<HTMLButtonElement>('[data-action="semantic-view"][data-value="confusion"]')?.click();
    expect(host.querySelector(".confusion-matrix")).not.toBeNull();
    expect(host.textContent).toContain("應按 ↓ / 實按 →");
    expect(host.textContent).toContain("3");
  });

  it("states that hand classes are inferred from standard fingering rather than detected hands", () => {
    const host = open();
    host.querySelector<HTMLButtonElement>('[data-action="select-tab"][data-tab="coordination"]')?.click();
    expect(host.textContent).toContain("不是偵測實際使用的手");
    expect(host.textContent).toContain("88 ms");
    expect(host.textContent).toContain("92 ms");
  });

  it("renders canonical position only as a reference against actual accepted order", () => {
    const host = open();
    host.querySelector<HTMLButtonElement>('[data-action="select-tab"][data-tab="strategy"]')?.click();
    expect(host.textContent).toContain("canonical 位置只是注音結構的參考座標");
    expect(host.textContent).toContain("4 個位置觀察");
    expect(host.textContent).toContain("100%");
  });
});
