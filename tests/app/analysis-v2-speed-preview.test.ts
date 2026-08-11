// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  mountAnalysisV2SpeedPreview,
  type AnalysisV2SpeedPreviewController,
} from "../../src/app/analysis-v2-speed-preview.js";
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
    immediateTokens: [
      {
        id: "one",
        scope: { fromToken: "zhuyin:ㄅ", toToken: "zhuyin:ㄆ" },
        observations: 5,
        timingSamples: 5,
        currentTimeToTypeMs: 120,
        bestTimeToTypeMs: 100,
        ready: true,
        history: [],
        partialTimingSamples: 0,
      },
      {
        id: "two",
        scope: { fromToken: "zhuyin:ㄇ", toToken: "zhuyin:ㄈ" },
        observations: 5,
        timingSamples: 5,
        currentTimeToTypeMs: 180,
        bestTimeToTypeMs: 150,
        ready: true,
        history: [],
        partialTimingSamples: 0,
      },
    ],
    coordination: [],
    immediateHands: [],
    sameHandRevisits: [],
    toneCommits: [],
    observedTokenTransitions: 2,
    readyTokenTransitions: 2,
    observedScopes: 2,
    readyScopes: 2,
    cleanTimingSamples: 10,
  },
  strategy: {
    inputOrderPositions: [],
    inputOrderPermutations: [],
    totalObservations: 0,
    bodySizeBucketsWithData: 0,
  },
};

function boardMarkup(readout = "baseline"): string {
  return `<div class="analysis-v2-speed-board">
    <div data-speed-token="zhuyin:ㄅ"></div>
    <div data-speed-token="zhuyin:ㄆ"></div>
    <div data-speed-token="zhuyin:ㄇ"></div>
    <div data-speed-token="zhuyin:ㄈ"></div>
    <svg>
      <path class="analysis-v2-speed-path is-accent" data-speed-id="one" data-from-token="zhuyin:ㄅ" data-to-token="zhuyin:ㄆ"></path>
      <path class="analysis-v2-speed-hit" data-speed-id="one" data-from-token="zhuyin:ㄅ" data-to-token="zhuyin:ㄆ"></path>
      <path class="analysis-v2-speed-path" data-speed-id="two" data-from-token="zhuyin:ㄇ" data-to-token="zhuyin:ㄈ"></path>
      <path class="analysis-v2-speed-hit" data-speed-id="two" data-from-token="zhuyin:ㄇ" data-to-token="zhuyin:ㄈ"></path>
    </svg>
  </div>
  <div class="analysis-v2-speed-readout">${readout}</div>`;
}

let controller: AnalysisV2SpeedPreviewController | null = null;

afterEach(() => {
  controller?.destroy();
  controller = null;
  document.body.innerHTML = "";
});

describe("Analysis V2 speed preview lifecycle", () => {
  it("temporarily overrides a pin, then restores the pinned focus/readout", () => {
    const host = document.createElement("div");
    host.innerHTML = boardMarkup();
    document.body.append(host);
    controller = mountAnalysisV2SpeedPreview(host, () => MODEL);
    controller.syncPinned("two");

    const one = host.querySelector<SVGPathElement>('.analysis-v2-speed-path[data-speed-id="one"]')!;
    const two = host.querySelector<SVGPathElement>('.analysis-v2-speed-path[data-speed-id="two"]')!;
    expect(two.classList.contains("is-focused")).toBe(true);
    expect(one.classList.contains("is-muted")).toBe(true);

    one.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(one.classList.contains("is-focused")).toBe(true);
    expect(two.classList.contains("is-muted")).toBe(true);
    expect(host.querySelector(".analysis-v2-speed-readout")?.textContent).toContain("ㄅ → ㄆ");
    expect(host.querySelector(".analysis-v2-speed-readout")?.textContent).toContain("暫時預覽");

    one.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: host }));
    expect(host.querySelector(".analysis-v2-speed-readout")?.textContent).toBe("baseline");
    expect(two.classList.contains("is-focused")).toBe(true);
    expect(one.classList.contains("is-muted")).toBe(true);
  });

  it("does not restore a stale board after rerender", () => {
    const host = document.createElement("div");
    host.innerHTML = boardMarkup("old baseline");
    document.body.append(host);
    controller = mountAnalysisV2SpeedPreview(host, () => MODEL);

    const oldOne = host.querySelector<SVGPathElement>('.analysis-v2-speed-path[data-speed-id="one"]')!;
    oldOne.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    expect(host.querySelector(".analysis-v2-speed-readout")?.textContent).toContain("暫時預覽");

    host.innerHTML = boardMarkup("new baseline");
    controller.syncPinned("two");
    oldOne.dispatchEvent(new FocusEvent("focusout", { bubbles: true, relatedTarget: host }));

    expect(host.querySelector(".analysis-v2-speed-readout")?.textContent).toBe("new baseline");
    expect(host.querySelector<SVGPathElement>('.analysis-v2-speed-path[data-speed-id="two"]')
      ?.classList.contains("is-focused")).toBe(true);
  });

  it("removes delegated listeners on destroy", () => {
    const host = document.createElement("div");
    host.innerHTML = boardMarkup();
    document.body.append(host);
    controller = mountAnalysisV2SpeedPreview(host, () => MODEL);
    const one = host.querySelector<SVGPathElement>('.analysis-v2-speed-path[data-speed-id="one"]')!;

    controller.destroy();
    controller = null;
    one.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));

    expect(host.querySelector(".analysis-v2-speed-readout")?.textContent).toBe("baseline");
    expect(one.classList.contains("is-focused")).toBe(false);
  });
});
