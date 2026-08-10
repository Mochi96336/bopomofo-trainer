// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createAnalysisV2,
  type AnalysisV2PreferenceStorage,
} from "../../src/app/analysis-v2-panel.js";
import type { AnalysisV2Model } from "../../src/app/analysis-v2-model.js";

function storage(): AnalysisV2PreferenceStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
  };
}

const model: AnalysisV2Model = {
  semantic: {
    keys: [],
    confusions: [],
    keyProgress: {},
    keysWithData: 0,
    repeatedConfusions: 0,
  },
  coordination: {
    immediateTokens: [],
    immediateHands: [],
    sameHandRevisits: [{
      id: "right-return",
      scope: { hand: "right", oppositeHandIntervened: true },
      observations: 10,
      timingSamples: 10,
      currentTimeToTypeMs: 205,
      bestTimeToTypeMs: 180,
      ready: true,
      history: [
        { endingSample: 5, completedRound: 1, samples: 5, representativeTimingMs: 225 },
        { endingSample: 10, completedRound: 2, samples: 5, representativeTimingMs: 205 },
      ],
      partialTimingSamples: 0,
    }],
    coordination: [
      {
        id: "structure-three",
        scope: { bodyShape: "initial-medial-final" },
        observations: 10,
        timingSamples: 10,
        currentTimeToTypeMs: 240,
        bestTimeToTypeMs: 205,
        ready: true,
        history: [
          { endingSample: 5, completedRound: 1, samples: 5, representativeTimingMs: 260 },
          { endingSample: 10, completedRound: 2, samples: 5, representativeTimingMs: 240 },
        ],
        partialTimingSamples: 0,
      },
      {
        id: "structure-initial-final",
        scope: { bodyShape: "initial-final" },
        observations: 10,
        timingSamples: 10,
        currentTimeToTypeMs: 170,
        bestTimeToTypeMs: 150,
        ready: true,
        history: [
          { endingSample: 5, completedRound: 1, samples: 5, representativeTimingMs: 185 },
          { endingSample: 10, completedRound: 2, samples: 5, representativeTimingMs: 170 },
        ],
        partialTimingSamples: 0,
      },
      {
        id: "structure-sampling",
        scope: { bodyShape: "initial-medial" },
        observations: 3,
        timingSamples: 3,
        currentTimeToTypeMs: null,
        bestTimeToTypeMs: 420,
        ready: false,
        history: [],
        partialTimingSamples: 3,
      },
    ],
    toneCommits: [],
    observedTokenTransitions: 0,
    readyTokenTransitions: 0,
    observedScopes: 4,
    readyScopes: 3,
    cleanTimingSamples: 33,
  },
  strategy: {
    inputOrderPositions: [],
    totalObservations: 0,
    bodySizeBucketsWithData: 0,
  },
};

let controller: ReturnType<typeof createAnalysisV2> | null = null;

afterEach(() => {
  controller?.destroy();
  controller = null;
  document.body.innerHTML = "";
});

describe("Analysis V2 Movement ranking", () => {
  it("shows only observed return scopes and keeps sampling structures below ranked rows", () => {
    controller = createAnalysisV2({ getModel: () => model, storage: storage() });
    controller.open();
    const host = controller.host;
    host.querySelector<HTMLButtonElement>(
      '[data-action="coordination-view"][data-value="movement"]',
    )?.click();

    const families = [...host.querySelectorAll<HTMLElement>(".analysis-v2-movement-family")];
    const revisit = families[1]!;
    const structure = families[2]!;

    expect(revisit.querySelector("header strong")?.textContent).toBe("同側回返");
    const revisitLabels = [...revisit.querySelectorAll<HTMLElement>(".analysis-v2-movement-stat > span:first-child")]
      .map((node) => node.textContent?.trim());
    expect(revisitLabels).toEqual(["右 · 隔左側"]);
    expect(revisit.textContent).not.toContain("左 · 隔右側");
    expect(revisit.textContent).not.toContain("連續");

    const structureRows = [...structure.querySelectorAll<HTMLElement>(".analysis-v2-movement-stat")];
    const structureLabels = structureRows
      .map((row) => row.querySelector("span:first-child")?.textContent?.trim());
    expect(structureLabels).toEqual([
      "聲母＋介音＋韻母",
      "聲母＋韻母",
      "聲母＋介音",
    ]);
    expect(structureRows[0]?.textContent).toContain("240 ms");
    expect(structureRows[1]?.textContent).toContain("170 ms");
    expect(structureRows[0]?.querySelector(".analysis-v2-movement-reading small")?.textContent)
      .toBe("· 10 個樣本");
    expect(structureRows[1]?.querySelector(".analysis-v2-movement-reading small")?.textContent)
      .toBe("· 10 個樣本");
    expect(structureRows[0]?.getAttribute("aria-label")).toContain("10 個乾淨樣本，10 次觀察");
    expect(structureRows[0]?.textContent).not.toContain("次觀察");
    expect(structureRows[2]?.classList.contains("sampling")).toBe(true);
    expect(structureRows[2]?.textContent).toContain("樣本中");
    expect(structureRows[2]?.querySelector("strong")?.textContent).toBe("—");
    expect(structureRows[2]?.querySelector(".analysis-v2-movement-reading small")?.textContent)
      .toBe("· 樣本中 · 3 個樣本");
    expect(structure.querySelectorAll(".analysis-v2-motor-sparkline")).toHaveLength(2);
    expect(host.querySelector(".analysis-v2-movement-intro")?.textContent)
      .toContain("只有累積至少 5 個乾淨時間樣本的列才參與家族內慢→快排列");
  });
});
