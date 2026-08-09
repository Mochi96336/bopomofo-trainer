// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createAnalysisV2,
  type AnalysisV2PreferenceStorage,
} from "../../src/app/analysis-v2-panel.js";
import type { AnalysisV2Model } from "../../src/app/analysis-v2-model.js";
import { mountAnalysisV2Presentation } from "../../src/app/analysis-v2-presentation.js";

function storage(): AnalysisV2PreferenceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

const MODEL: AnalysisV2Model = {
  semantic: {
    keys: [{
      tokenId: "zhuyin:ㄅ",
      symbol: "ㄅ",
      physicalCode: "Digit1",
      physicalKey: "1",
      attempts: 16,
      errors: 5,
      displayedErrorRatio: 5 / 16,
      errorDataState: "sufficient",
      timingAvailability: "available",
      timingMs: 118,
      timingSamples: 12,
      timingDataState: "sufficient",
    }],
    confusions: [],
    keyProgress: {
      "zhuyin:ㄅ": {
        tokenId: "zhuyin:ㄅ",
        correctness: {
          metric: "correctness",
          metricLabel: "錯誤觀察比例",
          unit: "percent",
          state: "charted",
          points: [
            { index: 0, value: 0.42, sampleCount: 8, completedRound: 1 },
            { index: 1, value: 0.31, sampleCount: 8, completedRound: 2 },
          ],
          chartDomain: { minimum: 0, maximum: 1 },
          trend: {
            state: "improving",
            previousValue: 0.42,
            recentValue: 0.31,
            delta: -0.11,
            label: "改善",
          },
          earliestValue: 0.42,
          latestValue: 0.31,
          partialSampleCount: 0,
          bucketSize: 8,
          accessibleSummary: "錯誤觀察比例由 42% 到 31%",
        },
        timing: {
          metric: "timing",
          metricLabel: "鍵間時間",
          unit: "milliseconds",
          state: "charted",
          points: [
            { index: 0, value: 148, sampleCount: 5, completedRound: 1 },
            { index: 1, value: 118, sampleCount: 5, completedRound: 2 },
          ],
          chartDomain: { minimum: 100, maximum: 160 },
          trend: {
            state: "improving",
            previousValue: 148,
            recentValue: 118,
            delta: -30,
            label: "改善",
          },
          earliestValue: 148,
          latestValue: 118,
          partialSampleCount: 2,
          bucketSize: 5,
          accessibleSummary: "鍵間時間由 148 ms 到 118 ms",
        },
      },
    },
    keysWithData: 1,
    repeatedConfusions: 0,
  },
  coordination: {
    immediateTokens: [],
    coordination: [],
    immediateHands: [{
      id: "left-right",
      scope: { fromHand: "left", toHand: "right" },
      observations: 10,
      timingSamples: 10,
      currentTimeToTypeMs: 126,
      bestTimeToTypeMs: 120,
      ready: true,
      history: [
        { endingSample: 5, completedRound: 1, samples: 5, representativeTimingMs: 151 },
        { endingSample: 10, completedRound: 2, samples: 5, representativeTimingMs: 126 },
      ],
      partialTimingSamples: 0,
    }],
    sameHandRevisits: [],
    toneCommits: [],
    observedTokenTransitions: 0,
    readyTokenTransitions: 0,
    observedScopes: 1,
    readyScopes: 1,
    cleanTimingSamples: 10,
  },
  strategy: {
    inputOrderPositions: [],
    totalObservations: 0,
    bodySizeBucketsWithData: 0,
  },
};

let controller: ReturnType<typeof createAnalysisV2> | null = null;
let presentation: ReturnType<typeof mountAnalysisV2Presentation> | null = null;

afterEach(() => {
  presentation?.destroy();
  controller?.destroy();
  presentation = null;
  controller = null;
  document.body.innerHTML = "";
});

describe("Analysis V2 presentation refinements", () => {
  it("renames and orders the surface around Coordination first", () => {
    controller = createAnalysisV2({ getModel: () => MODEL, storage: storage() });
    presentation = mountAnalysisV2Presentation(controller.host, () => MODEL);
    controller.open("coordination");
    presentation.refresh();

    expect(controller.host.querySelector("#analysis-v2-title")?.textContent).toBe("分析");
    expect([...controller.host.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent))
      .toEqual(["協調", "語意", "策略"]);
  });

  it("restores bounded key history as neutral inspector sparklines", () => {
    controller = createAnalysisV2({ getModel: () => MODEL, storage: storage() });
    presentation = mountAnalysisV2Presentation(controller.host, () => MODEL);
    controller.open("semantic");
    presentation.refresh();

    controller.host.querySelector<HTMLButtonElement>(
      '[data-action="select-key"][data-token="zhuyin:ㄅ"]',
    )?.click();
    presentation.refresh();

    const trends = controller.host.querySelector(".analysis-v2-trends");
    expect(trends).not.toBeNull();
    expect(trends?.querySelectorAll("svg")).toHaveLength(2);
    expect(trends?.textContent).toContain("錯誤觀察");
    expect(trends?.textContent).toContain("鍵間時間");
  });

  it("turns persisted low-dimensional motor history into compact table sparklines", () => {
    controller = createAnalysisV2({ getModel: () => MODEL, storage: storage() });
    presentation = mountAnalysisV2Presentation(controller.host, () => MODEL);
    controller.open("coordination");
    controller.host.querySelector<HTMLDetailsElement>(".analysis-v2-evidence-group")!.open = true;
    presentation.refresh();

    const sparkline = controller.host.querySelector(".analysis-v2-motor-sparkline");
    expect(sparkline).not.toBeNull();
    expect(sparkline?.getAttribute("aria-label")).toContain("151 ms");
    expect(sparkline?.querySelector("svg path")).not.toBeNull();
  });
});
