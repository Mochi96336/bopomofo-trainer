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
    keyProgress: {},
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
    observedTokenTransitions: 1,
    readyTokenTransitions: 1,
    observedScopes: 1,
    readyScopes: 1,
    cleanTimingSamples: 6,
  },
  strategy: {
    inputOrderPositions: [
      {
        scope: { bodySize: "2", canonicalPosition: "first", acceptedPosition: "last" },
        observations: 2,
      },
      {
        scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "first" },
        observations: 4,
      },
    ],
    totalObservations: 6,
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

afterEach(() => {
  controller?.destroy();
  controller = null;
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Analysis V2 panel", () => {
  it("uses semantic, coordination, and strategy as a complete tab/tabpanel contract", () => {
    const host = open();
    const tabs = [...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs.map((node) => node.textContent)).toEqual(["語意", "協調", "策略"]);
    expect(host.textContent).not.toContain("轉換總覽");

    const panels = [...host.querySelectorAll<HTMLElement>('[role="tabpanel"]')];
    expect(panels.map((panel) => panel.id)).toEqual([
      "analysis-v2-panel-semantic",
      "analysis-v2-panel-coordination",
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

  it("keeps keyboard focus and main scroll position when semantic detail rerenders", () => {
    const host = open();
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
    expect(host.textContent).toContain("時間資料");
    expect(host.textContent).toContain("可比較 · 8 個乾淨樣本");
  });

  it("renders only ready observed speed lines as accessible selectable relations without direction markers", () => {
    const host = open();
    host.querySelector<HTMLButtonElement>(
      '[data-action="select-tab"][data-tab="coordination"]',
    )?.click();
    const path = host.querySelector<SVGPathElement>(".analysis-v2-speed-path");
    const svg = host.querySelector<SVGSVGElement>(".analysis-v2-speed-svg");
    expect(path).not.toBeNull();
    expect(path?.getAttribute("marker-end")).toBeNull();
    expect(path?.querySelector("title")?.textContent)
      .toContain("ㄅ 到 ㄆ，120 毫秒，6 個乾淨樣本");
    expect(path?.getAttribute("role")).toBe("button");
    expect(path?.getAttribute("tabindex")).toBe("0");
    expect(path?.getAttribute("aria-label")).toContain("ㄅ 到 ㄆ");
    expect(svg?.getAttribute("aria-hidden")).toBeNull();
    expect(svg?.getAttribute("aria-label")).toContain("實際鍵間軌跡");
    expect(host.querySelector(".analysis-v2-speed-details")).toBeNull();
    expect(host.querySelector(".analysis-v2-method")?.textContent)
      .toContain("每一條至少 5 個時間樣本");
  });

  it("states that hand classes are inferred from standard fingering rather than detected hands", () => {
    const host = open();
    host.querySelector<HTMLButtonElement>(
      '[data-action="select-tab"][data-tab="coordination"]',
    )?.click();
    const handEvidence = host.querySelector<HTMLDetailsElement>(".analysis-v2-evidence-group");
    expect(handEvidence?.textContent).toContain("依標準指法的鍵位分工推定");
    expect(handEvidence?.textContent).toContain("不代表偵測到你實際使用哪隻手");
    expect(handEvidence?.textContent).toContain("88 ms");
    expect(handEvidence?.textContent).toContain("92 ms");
  });

  it("renders one strategy scale at a time and never invents a middle position for two components", () => {
    const host = open();
    host.querySelector<HTMLButtonElement>(
      '[data-action="select-tab"][data-tab="strategy"]',
    )?.click();
    expect(host.querySelectorAll(".strategy-matrix")).toHaveLength(1);
    expect(host.querySelector(".analysis-v2-method")?.textContent)
      .toContain("結構位置只是一組參考座標");

    host.querySelector<HTMLButtonElement>(
      '[data-action="strategy-size"][data-value="2"]',
    )?.click();
    const matrix = host.querySelector<HTMLTableElement>(".strategy-matrix");
    expect(host.querySelectorAll(".strategy-matrix")).toHaveLength(1);
    expect(matrix?.textContent).not.toContain("中");
    expect(matrix?.querySelectorAll("thead th")).toHaveLength(3);
    expect(host.querySelector(".analysis-v2-method")?.textContent)
      .toContain("2 成分只有前／後");
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
