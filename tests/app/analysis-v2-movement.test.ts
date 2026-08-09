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
      id: "right-continuous",
      scope: { hand: "right", oppositeHandIntervened: false },
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
    ],
    toneCommits: [],
    observedTokenTransitions: 0,
    readyTokenTransitions: 0,
    observedScopes: 3,
    readyScopes: 3,
    cleanTimingSamples: 30,
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
  it("shows only observed revisit scopes and ranks word structures slow-to-fast with sparklines", () => {
    controller = createAnalysisV2({ getModel: () => model, storage: storage() });
    controller.open();
    const host = controller.host;
    host.querySelector<HTMLButtonElement>(
      '[data-action="coordination-view"][data-value="movement"]',
    )?.click();

    const families = [...host.querySelectorAll<HTMLElement>(".analysis-v2-movement-family")];
    const revisit = families[1]!;
    const structure = families[2]!;

    const revisitLabels = [...revisit.querySelectorAll<HTMLElement>(".analysis-v2-movement-stat > span:first-child")]
      .map((node) => node.textContent?.trim());
    expect(revisitLabels).toEqual(["右 · 連續"]);
    expect(revisit.textContent).not.toContain("左 ·");
    expect(revisit.textContent).not.toContain("隔左側");

    const structureLabels = [...structure.querySelectorAll<HTMLElement>(".analysis-v2-movement-stat > span:first-child")]
      .map((node) => node.textContent?.trim());
    expect(structureLabels).toEqual(["聲母＋介音＋韻母", "聲母＋韻母"]);
    expect(structure.textContent).toContain("240 ms");
    expect(structure.textContent).toContain("170 ms");
    expect(structure.querySelectorAll(".analysis-v2-motor-sparkline")).toHaveLength(2);
  });
});
