// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createAnalysisV2,
  type AnalysisV2PreferenceStorage,
} from "../../src/app/analysis-v2-panel.js";
import type { AnalysisV2Model } from "../../src/app/analysis-v2-model.js";
import {
  mountAnalysisV2SpeedPreview,
  type AnalysisV2SpeedPreviewController,
} from "../../src/app/analysis-v2-speed-preview.js";

const FAST_ID = '["immediate-token","zhuyin:ㄅ","zhuyin:ㄆ"]';
const SLOW_ID = '["immediate-token","zhuyin:ㄇ","zhuyin:ㄈ"]';

function history(values: readonly number[]) {
  return values.map((representativeTimingMs, index) => ({
    endingSample: (index + 1) * 5,
    completedRound: index + 1,
    samples: 5,
    representativeTimingMs,
  }));
}

const MODEL = {
  coordination: {
    immediateTokens: [
      {
        id: FAST_ID,
        scope: { fromToken: "zhuyin:ㄅ", toToken: "zhuyin:ㄆ" },
        observations: 8,
        timingSamples: 6,
        currentTimeToTypeMs: 120,
        bestTimeToTypeMs: 96,
        ready: true,
        history: history([297, 290, 297, 283, 287]),
        partialTimingSamples: 0,
      },
      {
        id: SLOW_ID,
        scope: { fromToken: "zhuyin:ㄇ", toToken: "zhuyin:ㄈ" },
        observations: 11,
        timingSamples: 9,
        currentTimeToTypeMs: 240,
        bestTimeToTypeMs: 180,
        ready: true,
        history: history([277, 249, 247, 254, 256]),
        partialTimingSamples: 0,
      },
    ],
  },
} as unknown as AnalysisV2Model;

function memoryStorage(): AnalysisV2PreferenceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

function speedPath(host: HTMLElement, id: string): SVGPathElement {
  const path = [...host.querySelectorAll<SVGPathElement>(".analysis-v2-speed-path")]
    .find((candidate) => candidate.dataset.speedId === id);
  if (path === undefined) throw new Error(`missing speed path ${id}`);
  return path;
}

function speedHit(host: HTMLElement, id: string): SVGPathElement {
  const path = [...host.querySelectorAll<SVGPathElement>(".analysis-v2-speed-hit")]
    .find((candidate) => candidate.dataset.speedId === id);
  if (path === undefined) throw new Error(`missing speed hit ${id}`);
  return path;
}

function readout(host: HTMLElement): string {
  return host.querySelector(".analysis-v2-speed-readout")?.textContent ?? "";
}

function pointer(
  target: Element,
  type: "pointerover" | "pointerout",
  relatedTarget: EventTarget | null = null,
): void {
  target.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    relatedTarget,
  }));
}

let controller: ReturnType<typeof createAnalysisV2> | null = null;
let preview: AnalysisV2SpeedPreviewController | null = null;

afterEach(() => {
  preview?.destroy();
  preview = null;
  controller?.destroy();
  controller = null;
  document.body.innerHTML = "";
});

describe("Analysis V2 speed hover preview", () => {
  function open(): HTMLElement {
    controller = createAnalysisV2({ getModel: () => MODEL, storage: memoryStorage() });
    preview = mountAnalysisV2SpeedPreview(controller.host, () => MODEL);
    controller.open();
    return controller.host;
  }

  it("renders the baseline pair and its history synchronously", () => {
    const host = open();

    expect(readout(host)).toContain("ㄇ → ㄈ");
    expect(readout(host)).toContain("240 ms");
    expect(readout(host)).toContain("近期完成點 277 → 249 → 247 → 254 → 256 毫秒");
    expect(speedPath(host, SLOW_ID).classList.contains("is-accent")).toBe(true);
  });

  it("previews the relation under the pointer without pinning it", () => {
    const host = open();
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;

    pointer(speedHit(host, FAST_ID), "pointerover");

    expect(readout(host)).toContain("ㄅ → ㄆ");
    expect(readout(host)).toContain("120 ms");
    expect(readout(host)).toContain("6 個乾淨樣本");
    expect(readout(host)).toContain("近期完成點 297 → 290 → 297 → 283 → 287 毫秒");
    expect(readout(host)).not.toContain("277 → 249 → 247 → 254 → 256");
    expect(speedPath(host, FAST_ID).classList.contains("is-accent")).toBe(true);
    expect(host.querySelectorAll(".analysis-v2-speed-path.is-accent")).toHaveLength(1);
    expect(speedPath(host, FAST_ID).getAttribute("aria-pressed")).toBe("false");

    pointer(speedHit(host, FAST_ID), "pointerout", board);

    expect(readout(host)).toContain("ㄇ → ㄈ");
    expect(readout(host)).toContain("240 ms");
    expect(readout(host)).toContain("近期完成點 277 → 249 → 247 → 254 → 256 毫秒");
    expect(speedPath(host, SLOW_ID).classList.contains("is-accent")).toBe(true);
  });

  it("keeps click as the pinned baseline while other hover remains temporary", () => {
    const host = open();
    pointer(speedHit(host, FAST_ID), "pointerover");
    speedPath(host, FAST_ID).dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(readout(host)).toContain("ㄅ → ㄆ");
    expect(readout(host)).toContain("近期完成點 297 → 290 → 297 → 283 → 287 毫秒");
    expect(speedPath(host, FAST_ID).getAttribute("aria-pressed")).toBe("true");
    expect(speedPath(host, FAST_ID).classList.contains("is-accent")).toBe(true);

    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    pointer(speedHit(host, SLOW_ID), "pointerover");
    expect(readout(host)).toContain("ㄇ → ㄈ");
    expect(readout(host)).toContain("近期完成點 277 → 249 → 247 → 254 → 256 毫秒");
    expect(speedPath(host, SLOW_ID).classList.contains("is-accent")).toBe(true);
    expect(speedPath(host, FAST_ID).getAttribute("aria-pressed")).toBe("true");

    pointer(speedHit(host, SLOW_ID), "pointerout", board);
    expect(readout(host)).toContain("ㄅ → ㄆ");
    expect(readout(host)).toContain("近期完成點 297 → 290 → 297 → 283 → 287 毫秒");
    expect(speedPath(host, FAST_ID).classList.contains("is-accent")).toBe(true);
    expect(host.querySelectorAll(".analysis-v2-speed-path.is-accent")).toHaveLength(1);
  });
});
