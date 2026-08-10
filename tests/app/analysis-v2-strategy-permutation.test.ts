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

function model(withPermutations = true): AnalysisV2Model {
  return {
    semantic: {
      keys: [],
      confusions: [],
      keyProgress: {},
      keysWithData: 0,
      repeatedConfusions: 0,
    },
    coordination: {
      immediateTokens: [],
      coordination: [],
      immediateHands: [],
      sameHandRevisits: [],
      toneCommits: [],
      observedTokenTransitions: 0,
      readyTokenTransitions: 0,
      observedScopes: 0,
      readyScopes: 0,
      cleanTimingSamples: 0,
    },
    strategy: {
      inputOrderPositions: [
        { scope: { bodySize: "2", canonicalPosition: "first", acceptedPosition: "first" }, observations: 88 },
        { scope: { bodySize: "2", canonicalPosition: "first", acceptedPosition: "last" }, observations: 12 },
        { scope: { bodySize: "2", canonicalPosition: "last", acceptedPosition: "first" }, observations: 13 },
        { scope: { bodySize: "2", canonicalPosition: "last", acceptedPosition: "last" }, observations: 87 },
        { scope: { bodySize: "3", canonicalPosition: "first", acceptedPosition: "first" }, observations: 80 },
        { scope: { bodySize: "3", canonicalPosition: "middle", acceptedPosition: "middle" }, observations: 82 },
        { scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "last" }, observations: 79 },
      ],
      inputOrderPermutations: withPermutations ? [
        { scope: { bodySize: "3", permutation: "first-middle-last" }, observations: 78 },
        { scope: { bodySize: "3", permutation: "middle-first-last" }, observations: 9 },
        { scope: { bodySize: "3", permutation: "first-last-middle" }, observations: 6 },
        { scope: { bodySize: "3", permutation: "middle-last-first" }, observations: 3 },
        { scope: { bodySize: "3", permutation: "last-first-middle" }, observations: 2 },
        { scope: { bodySize: "3", permutation: "last-middle-first" }, observations: 2 },
      ] : [],
      recentInputOrderTrajectories: withPermutations ? [
        { bodySize: "2", permutation: "first-last", elapsedMs: [0, 118] },
        { bodySize: "2", permutation: "last-first", elapsedMs: [0, 146] },
        { bodySize: "2", permutation: "first-last", elapsedMs: [0, 104] },
        { bodySize: "3", permutation: "first-middle-last", elapsedMs: [0, 95, 230] },
        { bodySize: "3", permutation: "middle-first-last", elapsedMs: [0, 120, 280] },
        { bodySize: "3", permutation: "middle-last-first", elapsedMs: [0, 110, 340] },
      ] : [],
      totalObservations: 441,
      bodySizeBucketsWithData: 2,
    },
  };
}

let controller: ReturnType<typeof createAnalysisV2> | null = null;

afterEach(() => {
  controller?.destroy();
  controller = null;
  document.body.innerHTML = "";
});

describe("Analysis V2 Strategy interpretation", () => {
  it("uses recent real-time trajectories as the primary three-part Strategy object", () => {
    controller = createAnalysisV2({ getModel: () => model(), storage: memoryStorage() });
    controller.open("strategy");
    const host = controller.host;

    expect(host.textContent).toContain("換序輸入");
    expect(host.querySelector(".analysis-v2-strategy-readout")?.textContent).toContain("22%");
    expect(host.querySelector(".analysis-v2-strategy-readout")?.textContent)
      .toContain("22 / 100 個三注音字");
    expect(host.querySelector(".strategy-order-table")).toBeNull();
    expect(host.querySelector(".strategy-matrix")).toBeNull();
    expect(host.querySelector(".analysis-v2-strategy-trajectory")).not.toBeNull();
    expect(host.querySelectorAll(".analysis-v2-strategy-trajectory-path")).toHaveLength(3);
    expect(host.querySelector(".analysis-v2-strategy-trajectory")?.textContent).toContain("聲母");
    expect(host.querySelector(".analysis-v2-strategy-trajectory")?.textContent).toContain("介音");
    expect(host.querySelector(".analysis-v2-strategy-trajectory")?.textContent).toContain("韻母");
    expect(host.querySelector(".analysis-v2-strategy-projection")?.textContent).toContain("位置投影");
    expect(host.querySelectorAll(".analysis-v2-strategy-projection-matrix tbody tr")).toHaveLength(3);
    expect(host.querySelector(".analysis-v2-strategy-readout")?.textContent)
      .toContain("介音 → 聲母 → 韻母 9%");
    expect(host.querySelector(".analysis-v2-method")?.textContent)
      .toContain("橫軸是真實相對毫秒");
  });

  it("does not turn one observed complete order into a 100% conclusion", () => {
    const base = model();
    const sparse: AnalysisV2Model = {
      ...base,
      strategy: {
        ...base.strategy,
        inputOrderPermutations: [
          { scope: { bodySize: "3", permutation: "middle-last-first" }, observations: 1 },
        ],
        recentInputOrderTrajectories: [
          { bodySize: "3", permutation: "middle-last-first", elapsedMs: [0, 135, 390] },
        ],
      },
    };
    controller = createAnalysisV2({ getModel: () => sparse, storage: memoryStorage() });
    controller.open("strategy");
    const host = controller.host;

    const readout = host.querySelector(".analysis-v2-strategy-readout");
    expect(readout?.textContent).toContain("仍在累積");
    expect(readout?.textContent).toContain("介音 → 韻母 → 聲母 · 1 次");
    expect(readout?.textContent).not.toContain("100%");
  });

  it("uses the same trajectory frame for two-part strategy and demotes 2×2 to position projection", () => {
    controller = createAnalysisV2({ getModel: () => model(), storage: memoryStorage() });
    controller.open("strategy");
    const host = controller.host;

    host.querySelector<HTMLButtonElement>(
      '[data-action="strategy-size"][data-value="2"]',
    )?.click();

    const readout = host.querySelector(".analysis-v2-strategy-readout");
    expect(readout?.textContent).toContain("換序輸入");
    expect(readout?.textContent).toContain("13%");
    expect(readout?.textContent).toContain("25 / 200 個位置觀察");
    expect(readout?.querySelector("b")?.textContent).toBe("換序輸入");
    expect(host.querySelector(".strategy-matrix")).toBeNull();
    expect(host.querySelector(".analysis-v2-strategy-trajectory")).not.toBeNull();
    expect(host.querySelector(".analysis-v2-strategy-trajectory")?.textContent).toContain("前位");
    expect(host.querySelector(".analysis-v2-strategy-trajectory")?.textContent).toContain("後位");
    expect(host.querySelectorAll(".analysis-v2-strategy-trajectory-path")).toHaveLength(3);
    expect(host.querySelector(".analysis-v2-strategy-projection")?.textContent).toContain("位置投影");
    expect(host.querySelectorAll(".analysis-v2-strategy-projection-matrix tbody tr")).toHaveLength(2);
    expect(host.querySelectorAll(".analysis-v2-strategy-projection-matrix tbody td")).toHaveLength(4);
  });

  it("never reconstructs complete historical order or trajectories from old position marginals", () => {
    controller = createAnalysisV2({ getModel: () => model(false), storage: memoryStorage() });
    controller.open("strategy");
    const host = controller.host;

    expect(host.querySelector(".analysis-v2-strategy-readout")?.textContent)
      .toContain("完整順序開始累積");
    expect(host.querySelector(".analysis-v2-strategy-readout")?.textContent)
      .toContain("舊的位置資料不能可靠還原");
    expect(host.querySelector(".analysis-v2-strategy-readout")?.textContent)
      .toContain("241 個位置觀察仍保留");
    expect(host.querySelectorAll(".analysis-v2-strategy-trajectory-path")).toHaveLength(0);
    expect(host.querySelector(".analysis-v2-strategy-projection")).not.toBeNull();
    expect(host.textContent).not.toContain("換序輸入 0%");
  });
});
