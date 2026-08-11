// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
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
      errorDataState: "sufficient",
      timingAvailability: "available",
      timingMs: 100,
      timingSamples: 8,
      timingDataState: "sufficient",
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
      dataState: "preliminary",
    }],
    keyProgress: {
      "zhuyin:ㄅ": {
        tokenId: "zhuyin:ㄅ",
        correctness: {
          metric: "correctness",
          metricLabel: "錯誤觀察比例",
          unit: "percent",
          state: "charted",
          points: [
            { index: 0, value: 0.3, sampleCount: 8, completedRound: 1 },
            { index: 1, value: 0.2, sampleCount: 8, completedRound: 2 },
          ],
          chartDomain: { minimum: 0, maximum: 1 },
          trend: { state: "improving", previousValue: 0.3, recentValue: 0.2, delta: -0.1, label: "改善" },
          earliestValue: 0.3,
          latestValue: 0.2,
          partialSampleCount: 0,
          bucketSize: 8,
          accessibleSummary: "錯誤觀察比例由 30% 到 20%",
        },
        timing: {
          metric: "timing",
          metricLabel: "鍵間時間",
          unit: "milliseconds",
          state: "charted",
          points: [
            { index: 0, value: 130, sampleCount: 5, completedRound: 1 },
            { index: 1, value: 100, sampleCount: 5, completedRound: 2 },
          ],
          chartDomain: { minimum: 90, maximum: 140 },
          trend: { state: "improving", previousValue: 130, recentValue: 100, delta: -30, label: "改善" },
          earliestValue: 130,
          latestValue: 100,
          partialSampleCount: 0,
          bucketSize: 5,
          accessibleSummary: "鍵間時間由 130 ms 到 100 ms",
        },
      },
    },
    keysWithData: 1,
    repeatedConfusions: 1,
  },
  coordination: {
    immediateTokens: [{
      id: '["immediate-token","zhuyin:ㄅ","zhuyin:ㄆ"]',
      scope: { fromToken: "zhuyin:ㄅ", toToken: "zhuyin:ㄆ" },
      observations: 7,
      timingSamples: 6,
      currentTimeToTypeMs: 120,
      bestTimeToTypeMs: 90,
      ready: true,
      history: [],
      partialTimingSamples: 0,
    }],
    coordination: [],
    immediateHands: [{
      id: "hand",
      scope: { fromHand: "left", toHand: "right" },
      observations: 10,
      timingSamples: 10,
      currentTimeToTypeMs: 88,
      bestTimeToTypeMs: 70,
      ready: true,
      history: [
        { endingSample: 5, completedRound: 1, samples: 5, representativeTimingMs: 96 },
        { endingSample: 10, completedRound: 2, samples: 5, representativeTimingMs: 88 },
      ],
      partialTimingSamples: 0,
    }],
    sameHandRevisits: [],
    toneCommits: [],
    observedTokenTransitions: 1,
    readyTokenTransitions: 1,
    observedScopes: 1,
    readyScopes: 1,
    cleanTimingSamples: 10,
  },
  strategy: {
    inputOrderPositions: [
      {
        scope: { bodySize: "2", canonicalPosition: "first", acceptedPosition: "last" },
        observations: 2,
      },
      {
        scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "first" },
        observations: 8,
      },
    ],
    totalObservations: 10,
    bodySizeBucketsWithData: 2,
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

function selectTab(host: HTMLElement, tab: "coordination" | "semantic" | "strategy"): void {
  host.querySelector<HTMLButtonElement>(`[data-action="select-tab"][data-tab="${tab}"]`)?.click();
}

afterEach(() => {
  controller?.destroy();
  controller = null;
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Analysis V2 panel", () => {
  it("enters through Coordination and owns the final tab/tabpanel contract natively", () => {
    const host = open();
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(host.querySelector("#analysis-v2-title")?.textContent).toBe("分析");
    expect(tabs.map((node) => node.textContent)).toEqual(["協調", "語意", "策略"]);

    const panels = [...host.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    expect(panels.map((panel) => panel.id)).toEqual([
      "analysis-v2-panel-coordination",
      "analysis-v2-panel-semantic",
      "analysis-v2-panel-strategy",
    ]);
    for (const tab of tabs) {
      const controlled = host.querySelector<HTMLElement>(`#${tab.getAttribute("aria-controls")}`);
      expect(controlled).not.toBeNull();
      expect(controlled?.getAttribute("aria-labelledby")).toBe(tab.id);
    }
    expect(panels[0]?.hidden).toBe(false);
    expect(panels[1]?.hidden).toBe(true);
    expect(panels[2]?.hidden).toBe(true);
    expect(host.querySelector(".analysis-v2-close")?.getAttribute("aria-label")).toContain("Esc");
  });

  it("keeps directional confusion on the keyboard and reveals sparse destinations on selection", () => {
    const host = open();
    selectTab(host, "semantic");
    const confusion = host.querySelector<HTMLButtonElement>(
      '[data-action="semantic-view"][data-value="confusion"]',
    );
    confusion?.focus();
    confusion?.click();
    const replacement = host.querySelector<HTMLButtonElement>(
      '[data-action="semantic-view"][data-value="confusion"]',
    );
    expect(host.querySelectorAll(".analysis-v2-keyboard")).toHaveLength(1);
    expect(host.querySelector(".analysis-v2-confusion-table")).toBeNull();
    expect(document.activeElement).toBe(replacement);

    host.querySelector<HTMLButtonElement>(
      '[data-action="select-key"][data-token="zhuyin:ㄅ"]',
    )?.click();
    expect(host.querySelectorAll(".analysis-v2-confusion-list li")).toHaveLength(1);
    expect(host.querySelector(".analysis-v2-confusion-list")?.textContent).toContain("ㄆ");
    expect(host.querySelector(".analysis-v2-confusion-list")?.textContent).toContain("初步");
  });

  it("keeps semantic focus/scroll and renders compact persisted key history directly", () => {
    const host = open();
    selectTab(host, "semantic");
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    main.scrollTop = 120;
    const key = host.querySelector<HTMLButtonElement>(
      '[data-action="select-key"][data-token="zhuyin:ㄅ"]',
    );
    key?.focus();
    key?.click();
    const replacement = host.querySelector<HTMLButtonElement>(
      '[data-action="select-key"][data-token="zhuyin:ㄅ"]',
    );
    expect(replacement?.getAttribute("aria-pressed")).toBe("true");
    expect(document.activeElement).toBe(replacement);
    expect(host.querySelector<HTMLElement>(".analysis-v2-main")?.scrollTop).toBe(120);
    expect(host.textContent).toContain("錯誤資料");
    expect(host.textContent).toContain("可比較 · 10 次");
    expect(host.textContent).toContain("有效鍵間時間");
    expect(host.textContent).toContain("100 ms · 可比較 · 8 個乾淨樣本");
    expect(host.textContent).not.toContain("時間資料");
    expect(host.textContent).toContain("近期錯誤觀察");
    expect(host.textContent).toContain("近期鍵間時間");
    expect(host.querySelectorAll(".analysis-v2-trends svg")).toHaveLength(2);
  });

  it("renders one red relation tied to one aligned lower readout while all ready observed paths stay selectable", () => {
    const host = open();
    const path = host.querySelector<SVGPathElement>(".analysis-v2-speed-path");
    const svg = host.querySelector<SVGSVGElement>(".analysis-v2-speed-svg");
    const readout = host.querySelector(".analysis-v2-speed-readout");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("marker-end")).toBeNull();
    expect(path?.querySelector("title")?.textContent)
      .toContain("ㄅ 到 ㄆ，120 毫秒，6 個乾淨樣本");
    expect(path?.getAttribute("role")).toBe("button");
    expect(path?.getAttribute("tabindex")).toBe("0");
    expect(svg?.getAttribute("aria-label")).toContain("實際鍵間軌跡");
    expect(host.querySelectorAll(".analysis-v2-speed-path.is-accent")).toHaveLength(1);
    expect(readout?.textContent).toContain("1 條可比較");
    expect(readout?.textContent).toContain("線粗代表樣本支持");
    expect(host.querySelector(".analysis-v2-speed-caption")).toBeNull();
    expect(host.querySelector(".analysis-v2-method")?.textContent)
      .toContain("每一條至少 5 個時間樣本");
  });

  it("keeps four compact Movement families with explanatory diagrams and only real history lines", () => {
    const host = open();
    expect(host.querySelector(".analysis-v2-speed-board")).not.toBeNull();
    expect(host.querySelector(".analysis-v2-movement-view")).toBeNull();

    host.querySelector<HTMLButtonElement>(
      '[data-action="coordination-view"][data-value="movement"]',
    )?.click();

    const families = [...host.querySelectorAll<HTMLElement>(".analysis-v2-movement-family")];
    expect(families.map((family) => family.querySelector("header strong")?.textContent)).toEqual([
      "手別轉換",
      "同側回返",
      "字內結構",
      "聲調收尾",
    ]);
    expect(host.querySelector(".analysis-v2-speed-board")).toBeNull();
    expect(host.querySelectorAll(".analysis-v2-movement-view table")).toHaveLength(0);
    expect(host.querySelectorAll(".analysis-v2-movement-diagram")).toHaveLength(4);
    expect(host.querySelector(".analysis-v2-word-structure")?.textContent).toContain("聲母介音韻母");
    expect(host.querySelector(".analysis-v2-word-structure")?.textContent).toContain("例：家");
    expect(host.querySelectorAll(".analysis-v2-motor-sparkline")).toHaveLength(1);
    expect(host.querySelector(".analysis-v2-movement-view")?.textContent).toContain("88 ms");
    expect(host.querySelector(".analysis-v2-movement-view")?.textContent)
      .toContain("不代表偵測到實際使用哪隻手");
    expect(host.querySelector(".analysis-v2-movement-view")?.textContent).not.toContain("2 · 左");
  });

  it("renders only 2/3 strategy scales and never invents a middle position for two components", () => {
    const host = open();
    selectTab(host, "strategy");
    const sizeButtons = [...host.querySelectorAll<HTMLButtonElement>('[data-action="strategy-size"]')];
    expect(sizeButtons.map((button) => button.textContent)).toEqual(["2 個注音", "3 個注音"]);
    expect(host.textContent).not.toContain("4+");

    host.querySelector<HTMLButtonElement>(
      '[data-action="strategy-size"][data-value="2"]',
    )?.click();
    const matrix = host.querySelector<HTMLTableElement>(".strategy-matrix");
    expect(host.querySelectorAll(".strategy-matrix")).toHaveLength(1);
    expect(matrix?.textContent).not.toContain("中");
    expect(matrix?.querySelectorAll("thead th")).toHaveLength(3);
    expect(host.querySelector(".analysis-v2-method")?.textContent)
      .toContain("1 個注音沒有順序差異");
  });

  it("cannot finish a stale open frame after the analysis has already closed", () => {
    let scheduled: FrameRequestCallback = () => undefined;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      scheduled = callback;
      return 17;
    });
    const cancel = vi.spyOn(window, "cancelAnimationFrame");
    const returnTarget = document.createElement("button");
    document.body.append(returnTarget);

    controller = createAnalysisV2({
      getModel: () => MODEL,
      storage: memoryStorage(),
      onClose: () => returnTarget.focus(),
    });
    controller.open();
    controller.close();

    expect(cancel).toHaveBeenCalledWith(17);
    expect(document.activeElement).toBe(returnTarget);
    scheduled(0);
    expect(controller.host.hidden).toBe(true);
    expect(controller.host.classList.contains("open")).toBe(false);
    expect(document.activeElement).toBe(returnTarget);
  });
});
