// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAnalysisV2,
  type AnalysisV2PreferenceStorage,
} from "../../src/app/analysis-v2-panel.js";
import type { AnalysisV2Model } from "../../src/app/analysis-v2-model.js";

const MODEL: AnalysisV2Model = {
  semantic: {
    keys: [],
    confusions: [],
    keyProgress: {},
    keysWithData: 0,
    repeatedConfusions: 0,
  },
  coordination: {
    immediateTokens: [{
      id: '["immediate-token","zhuyin:ㄅ","zhuyin:ㄆ"]',
      scope: { fromToken: "zhuyin:ㄅ", toToken: "zhuyin:ㄆ" },
      observations: 6,
      timingSamples: 6,
      currentTimeToTypeMs: 120,
      bestTimeToTypeMs: 100,
      ready: true,
      history: [],
      partialTimingSamples: 0,
    }],
    coordination: [],
    immediateHands: [],
    sameHandRevisits: [],
    toneCommits: [],
    observedTokenTransitions: 1,
    readyTokenTransitions: 1,
    observedScopes: 1,
    readyScopes: 1,
    cleanTimingSamples: 6,
  },
  strategy: {
    inputOrderPositions: [],
    inputOrderPermutations: [],
    totalObservations: 0,
    bodySizeBucketsWithData: 0,
  },
};

function storage(): AnalysisV2PreferenceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

let controller: ReturnType<typeof createAnalysisV2> | null = null;

afterEach(() => {
  controller?.destroy();
  controller = null;
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("Analysis V2 controller lifecycle", () => {
  it("preserves scroll and restores speed-path focus across pin rerender", () => {
    controller = createAnalysisV2({ getModel: () => MODEL, storage: storage() });
    controller.open();
    const host = controller.host;
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    main.scrollTop = 96;
    const path = host.querySelector<SVGPathElement>(".analysis-v2-speed-path")!;
    path.focus();
    path.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    const replacement = host.querySelector<SVGPathElement>(".analysis-v2-speed-path")!;
    expect(replacement.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector<HTMLElement>(".analysis-v2-main")?.scrollTop).toBe(96);
    expect(document.activeElement).toBe(replacement);
  });

  it("removes the global Escape handler when destroyed", () => {
    const onClose = vi.fn();
    controller = createAnalysisV2({ getModel: () => MODEL, storage: storage(), onClose });
    controller.open();
    const host = controller.host;

    controller.destroy();
    controller = null;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    expect(host.isConnected).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });
});
