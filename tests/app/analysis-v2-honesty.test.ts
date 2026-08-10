// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createAnalysisV2,
  type AnalysisV2PreferenceStorage,
} from "../../src/app/analysis-v2-panel.js";
import type { AnalysisV2Model, AnalysisV2MotorCell } from "../../src/app/analysis-v2-model.js";
import type { ImmediateTokenAggregateScope } from "../../src/measurement-v2/aggregate.js";
import type { ConfusionDiagnostic, KeyDiagnostic } from "../../src/diagnostics/types.js";
import type { TokenId } from "../../src/core/model.js";

function key(tokenId: TokenId, symbol: string): KeyDiagnostic {
  return {
    tokenId,
    symbol,
    physicalCode: "KeyA",
    physicalKey: "A",
    attempts: 10,
    errors: 1,
    displayedErrorRatio: 0.1,
    errorDataState: "sufficient",
    timingAvailability: "available",
    timingMs: 120,
    timingSamples: 5,
    timingDataState: "sufficient",
  };
}

function confusion(
  id: string,
  expectedTokenId: TokenId,
  expectedSymbol: string,
  actualTokenId: TokenId,
  actualSymbol: string,
  occurrences: number,
  total: number,
): ConfusionDiagnostic {
  return {
    id,
    expectedTokenId,
    actualTokenId,
    expectedSymbol,
    actualSymbol,
    expectedPhysicalKey: "A",
    actualPhysicalKey: "S",
    occurrences,
    expectedConfusionTotal: total,
    expectedErrorShare: occurrences / total,
    dataState: occurrences >= 5 ? "sufficient" : occurrences >= 3 ? "preliminary" : "insufficient",
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

function model(overrides: Partial<AnalysisV2Model> = {}): AnalysisV2Model {
  const base: AnalysisV2Model = {
    semantic: {
      keys: [
        key("zhuyin:ㄅ", "ㄅ"),
        key("zhuyin:ㄆ", "ㄆ"),
        key("zhuyin:ㄇ", "ㄇ"),
        key("zhuyin:ㄈ", "ㄈ"),
      ],
      confusions: [],
      keyProgress: {},
      keysWithData: 4,
      repeatedConfusions: 0,
    },
    coordination: {
      immediateTokens: [
        edge("e1", "zhuyin:ㄅ", "zhuyin:ㄆ", 100),
        edge("e2", "zhuyin:ㄇ", "zhuyin:ㄈ", 180),
      ],
      coordination: [],
      immediateHands: [],
      sameHandRevisits: [],
      toneCommits: [],
      observedTokenTransitions: 2,
      readyTokenTransitions: 2,
      observedScopes: 2,
      readyScopes: 2,
      cleanTimingSamples: 12,
    },
    strategy: {
      inputOrderPositions: [],
      inputOrderPermutations: [],
      totalObservations: 0,
      bodySizeBucketsWithData: 0,
    },
  };
  return { ...base, ...overrides };
}

function memoryStorage(): AnalysisV2PreferenceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
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
    const source = model({
      semantic: {
        keys: [
          key("zhuyin:ㄅ", "ㄅ"),
          key("zhuyin:ㄆ", "ㄆ"),
          key("zhuyin:ㄇ", "ㄇ"),
          key("zhuyin:ㄈ", "ㄈ"),
        ],
        confusions: [
          // ㄅ has a perfectly concentrated destination, but only 5 attributable errors.
          confusion("c1", "zhuyin:ㄅ", "ㄅ", "zhuyin:ㄇ", "ㄇ", 5, 5),
          // ㄆ has many more attributable errors, split across destinations.
          confusion("c2", "zhuyin:ㄆ", "ㄆ", "zhuyin:ㄇ", "ㄇ", 12, 20),
          confusion("c3", "zhuyin:ㄆ", "ㄆ", "zhuyin:ㄈ", "ㄈ", 8, 20),
        ],
        keyProgress: {},
        keysWithData: 4,
        repeatedConfusions: 3,
      },
    });
    const host = open(source);
    selectTab(host, "semantic");
    host.querySelector<HTMLButtonElement>(
      '[data-action="semantic-view"][data-value="confusion"]',
    )?.click();

    const lead = host.querySelector(".analysis-v2-semantic-symbols");
    expect(lead?.textContent?.trim().startsWith("ㄆ")).toBe(true);
    expect(host.querySelector(".analysis-v2-semantic-readout")?.textContent)
      .toContain("較常發生誤按的按鍵");
    const p = host.querySelector<HTMLElement>('[data-token="zhuyin:ㄆ"]')!;
    const b = host.querySelector<HTMLElement>('[data-token="zhuyin:ㄅ"]')!;
    expect(p.classList.contains("has-data")).toBe(true);
    expect(Number.parseFloat(p.style.getPropertyValue("--analysis-strength")))
      .toBeGreaterThan(Number.parseFloat(b.style.getPropertyValue("--analysis-strength")));
  });

  it("does not promote one completed reordered word to a 100% hero", () => {
    const source = model({
      strategy: {
        inputOrderPositions: [],
        inputOrderPermutations: [{
          scope: { bodySize: "3", permutation: "last-first-middle" },
          observations: 1,
        }],
        totalObservations: 0,
        bodySizeBucketsWithData: 1,
      },
    });
    const host = open(source);
    selectTab(host, "strategy");

    const lead = host.querySelector(".analysis-v2-strategy-readout");
    expect(lead?.textContent).toContain("仍在累積");
    expect(lead?.textContent).not.toContain("換序輸入100%");
  });

  it("promotes whole-word reordering only after enough completed three-part words", () => {
    const source = model({
      strategy: {
        inputOrderPositions: [],
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
        totalObservations: 0,
        bodySizeBucketsWithData: 1,
      },
    });
    const host = open(source);
    selectTab(host, "strategy");

    const lead = host.querySelector(".analysis-v2-strategy-readout");
    expect(lead?.textContent).toContain("換序輸入");
    expect(lead?.textContent).toContain("40%");
    expect(lead?.textContent).toContain("4 / 10 個三注音字");
    expect(lead?.textContent).toContain("韻母 → 聲母 → 介音 40%");
  });

  it("keeps visible-family scope explicit in the single lower readout without adding copy above the keyboard", () => {
    const host = open(model());
    const readout = host.querySelector(".analysis-v2-speed-readout");
    expect(readout?.textContent)
      .toContain("僅在畫面中的同類實際鍵間轉換中比較");
    expect(readout?.textContent).toContain("2 條可比較");
    expect(readout?.textContent).toContain("線粗＝樣本支持；越深紅＝相對越慢");
    expect(host.querySelector(".analysis-v2-speed-caption")).toBeNull();
    expect(host.querySelectorAll(".analysis-v2-speed-hit")).toHaveLength(2);
    expect(host.querySelectorAll(".analysis-v2-speed-path")).toHaveLength(2);
    expect(host.querySelector(".analysis-v2-speed-hit")?.getAttribute("aria-hidden")).toBe("true");
  });
});
