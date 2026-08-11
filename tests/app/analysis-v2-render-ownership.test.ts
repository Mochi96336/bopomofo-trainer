// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  analysisV2MovementLineArtMarkup,
  type AnalysisV2MovementFamilyId,
} from "../../src/app/analysis-v2-movement-line-art.js";
import { renderAnalysisV2Coordination } from "../../src/app/analysis-v2-coordination-renderer.js";
import type { AnalysisV2Model } from "../../src/app/analysis-v2-model.js";

const EMPTY_MODEL: AnalysisV2Model = {
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
    inputOrderPositions: [],
    inputOrderPermutations: [],
    totalObservations: 0,
    bodySizeBucketsWithData: 0,
  },
};

const LABELS: Readonly<Record<AnalysisV2MovementFamilyId, string>> = {
  "hand-switch": "鍵盤左右手切換示意",
  "same-side-revisit": "同側回返示意：離開一側後經另一側回到原側",
  "word-structure": "聲母、介音、韻母的字內結構示意",
  "tone-commit": "完成字內注音後按下聲調鍵示意",
};

function parse(markup: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = markup;
  return host;
}

describe("Analysis V2 render ownership", () => {
  it("renders Movement line art by explicit family identity in any requested order", () => {
    const order: readonly AnalysisV2MovementFamilyId[] = [
      "tone-commit",
      "hand-switch",
      "word-structure",
      "same-side-revisit",
    ];
    const host = parse(order.map(analysisV2MovementLineArtMarkup).join(""));
    const diagrams = [...host.querySelectorAll<HTMLElement>("[data-movement-line-art]")];

    expect(diagrams.map((diagram) => diagram.dataset.movementLineArt)).toEqual(order);
    for (const diagram of diagrams) {
      const id = diagram.dataset.movementLineArt as AnalysisV2MovementFamilyId;
      expect(diagram.getAttribute("role")).toBe("img");
      expect(diagram.getAttribute("aria-label")).toBe(LABELS[id]);
      expect(diagram.querySelector("svg")).not.toBeNull();
    }
  });

  it("Coordination owns complete Movement markup synchronously", () => {
    const host = parse(renderAnalysisV2Coordination(EMPTY_MODEL, null, "movement"));
    const families = [...host.querySelectorAll<HTMLElement>(".analysis-v2-movement-family")];

    expect(families).toHaveLength(4);
    expect(families.map((family) => family.dataset.movementFamily)).toEqual([
      "hand-switch",
      "same-side-revisit",
      "word-structure",
      "tone-commit",
    ]);
    for (const family of families) {
      const id = family.dataset.movementFamily;
      const diagram = family.querySelector<HTMLElement>("[data-movement-line-art]");
      expect(diagram?.dataset.movementLineArt).toBe(id);
      expect(diagram?.querySelector("svg")).not.toBeNull();
    }
  });
});
