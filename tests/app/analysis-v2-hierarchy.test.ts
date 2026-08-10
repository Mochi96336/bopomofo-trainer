// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createAnalysisV2,
  type AnalysisV2PreferenceStorage,
} from "../../src/app/analysis-v2-panel.js";
import type { AnalysisV2Model, AnalysisV2MotorCell } from "../../src/app/analysis-v2-model.js";
import type { ImmediateTokenAggregateScope } from "../../src/measurement-v2/aggregate.js";
import type { TokenId } from "../../src/core/model.js";

function key(
  tokenId: TokenId,
  symbol: string,
  ratio: number,
  state: "sufficient" | "preliminary",
  attempts: number,
): AnalysisV2Model["semantic"]["keys"][number] {
  return {
    tokenId,
    symbol,
    physicalCode: "KeyA",
    physicalKey: "A",
    attempts,
    errors: Math.round(ratio * attempts),
    displayedErrorRatio: ratio,
    errorDataState: state,
    timingAvailability: "available",
    timingMs: 120,
    timingSamples: 8,
    timingDataState: "sufficient",
  };
}

function edge(
  id: string,
  fromToken: TokenId,
  toToken: TokenId,
  time: number,
): AnalysisV2MotorCell<ImmediateTokenAggregateScope> {
  return {
    id,
    scope: { fromToken, toToken },
    observations: 7,
    timingSamples: 6,
    currentTimeToTypeMs: time,
    bestTimeToTypeMs: time - 15,
    ready: true,
    history: [],
    partialTimingSamples: 0,
  };
}

const MODEL: AnalysisV2Model = {
  semantic: {
    keys: [
      key("zhuyin:ㄅ", "ㄅ", 0.6, "sufficient", 12),
      key("zhuyin:ㄆ", "ㄆ", 0.5, "sufficient", 12),
      key("zhuyin:ㄇ", "ㄇ", 0.4, "sufficient", 11),
      key("zhuyin:ㄈ", "ㄈ", 0.3, "sufficient", 10),
      key("zhuyin:ㄉ", "ㄉ", 0.2, "sufficient", 10),
      key("zhuyin:ㄊ", "ㄊ", 0.9, "preliminary", 6),
    ],
    confusions: [],
    keyProgress: {},
    keysWithData: 6,
    repeatedConfusions: 0,
  },
  coordination: {
    immediateTokens: [
      edge("e1", "zhuyin:ㄅ", "zhuyin:ㄆ", 100),
      edge("e2", "zhuyin:ㄇ", "zhuyin:ㄈ", 120),
      edge("e3", "zhuyin:ㄉ", "zhuyin:ㄊ", 140),
      edge("e4", "zhuyin:ㄋ", "zhuyin:ㄌ", 160),
      edge("e5", "zhuyin:ㄍ", "zhuyin:ㄎ", 180),
    ],
    coordination: [],
    immediateHands: [],
    sameHandRevisits: [],
    toneCommits: [],
    observedTokenTransitions: 5,
    readyTokenTransitions: 5,
    observedScopes: 5,
    readyScopes: 5,
    cleanTimingSamples: 30,
  },
  strategy: {
    inputOrderPositions: [
      {
        scope: { bodySize: "3", canonicalPosition: "first", acceptedPosition: "first" },
        observations: 6,
      },
      {
        scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "last" },
        observations: 6,
      },
      {
        scope: { bodySize: "3", canonicalPosition: "last", acceptedPosition: "first" },
        observations: 4,
      },
    ],
    inputOrderPermutations: [
      {
        scope: { bodySize: "3", permutation: "first-middle-last" },
        observations: 6,
      },
      {
        scope: { bodySize: "3", permutation: "last-first-middle" },
        observations: 4,
      },
    ],
    totalObservations: 16,
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

function open(): HTMLElement {
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
  document.body.innerHTML = "";
});

describe("Analysis V2 visual hierarchy", () => {
  it("keeps a bounded three-key Semantic summary while grading every observed key", () => {
    const host = open();
    selectTab(host, "semantic");

    expect(host.querySelectorAll(".analysis-v2-key.is-salient")).toHaveLength(0);
    const graded = [...host.querySelectorAll<HTMLElement>(".analysis-v2-key.has-data")];
    expect(graded).toHaveLength(6);
    expect(graded.every((node) => Number.parseFloat(
      node.style.getPropertyValue("--analysis-strength"),
    ) > 0)).toBe(true);
    const b = host.querySelector<HTMLElement>('[data-token="zhuyin:ㄅ"]')!;
    const f = host.querySelector<HTMLElement>('[data-token="zhuyin:ㄈ"]')!;
    expect(Number.parseFloat(b.style.getPropertyValue("--analysis-strength")))
      .toBeGreaterThan(Number.parseFloat(f.style.getPropertyValue("--analysis-strength")));

    const lead = host.querySelector(".analysis-v2-semantic-readout");
    expect(lead?.textContent).toContain("ㄅ");
    expect(lead?.textContent).toContain("ㄆ");
    expect(lead?.textContent).toContain("ㄇ");
    expect(lead?.textContent).not.toContain("ㄈ");
    expect(lead?.textContent).not.toContain("ㄊ");
  });

  it("pins the selected relation in the hero without opening a metadata panel", () => {
    const host = open();
    const readout = host.querySelector(".analysis-v2-speed-readout");
    expect(readout?.textContent).toContain("ㄍ → ㄎ");
    expect(readout?.textContent).toContain("180 ms");
    expect(host.querySelectorAll(".analysis-v2-speed-path.is-slow")).toHaveLength(3);
    expect(host.querySelectorAll(".analysis-v2-speed-path.is-accent")).toHaveLength(1);
    expect(host.querySelector(".analysis-v2-speed-stage")?.classList.contains("has-selection"))
      .toBe(false);
    expect(host.querySelector(".analysis-v2-speed-inspector")).toBeNull();

    host.querySelector<SVGPathElement>('[data-speed-id="e1"]')?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );
    expect(host.querySelector(".analysis-v2-speed-stage")?.classList.contains("has-selection"))
      .toBe(true);
    expect(host.querySelector(".analysis-v2-speed-inspector")).toBeNull();
    expect(host.querySelector(".analysis-v2-speed-readout")?.textContent).toContain("100 ms");
    expect(host.querySelectorAll(".analysis-v2-speed-path.is-accent")).toHaveLength(1);
    expect(host.querySelector<SVGPathElement>(".analysis-v2-speed-path.is-accent")?.dataset.speedId)
      .toBe("e1");
  });

  it("gives Strategy one whole-word reorder anchor instead of promoting a matrix cell", () => {
    const host = open();
    selectTab(host, "strategy");
    const lead = host.querySelector(".analysis-v2-strategy-readout");
    expect(lead?.textContent).toContain("換序輸入");
    expect(lead?.textContent).toContain("40%");
    expect(lead?.textContent).toContain("4 / 10 個三注音字");
    expect(lead?.textContent).toContain("韻母 → 聲母 → 介音 40%");
    expect(host.querySelectorAll(".analysis-v2-strategy-trajectory")).toHaveLength(1);
    expect(host.querySelector(".strategy-order-table")).toBeNull();
    expect(host.querySelector(".strategy-matrix")).toBeNull();
  });
});
