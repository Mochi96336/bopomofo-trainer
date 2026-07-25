import { describe, expect, it } from "vitest";
import type {
  ConfusionDiagnostic,
  TransitionDiagnostic,
} from "../../src/diagnostics/types.js";
import {
  buildDiagnosticNetworkPaths,
  buildDiagnosticRelationshipPaths,
  diagnosticKeyboardPoints,
} from "../../src/app/diagnostic-relationship-layout.js";

const transition: TransitionDiagnostic = {
  id: "transition:zhuyin:ㄓ→zhuyin:ㄨ",
  fromTokenId: "zhuyin:ㄓ",
  toTokenId: "zhuyin:ㄨ",
  fromSymbol: "ㄓ",
  toSymbol: "ㄨ",
  fromPhysicalKey: "5",
  toPhysicalKey: "J",
  timingMs: 481,
  bestTimingMs: 332,
  timingSamples: 8,
  dataState: "sufficient",
  includesTone: false,
};

const confusion: ConfusionDiagnostic = {
  id: "confusion:zhuyin:ㄢ→zhuyin:ㄤ",
  expectedTokenId: "zhuyin:ㄢ",
  actualTokenId: "zhuyin:ㄤ",
  expectedSymbol: "ㄢ",
  actualSymbol: "ㄤ",
  expectedPhysicalKey: "0",
  actualPhysicalKey: ";",
  occurrences: 4,
  expectedConfusionTotal: 5,
  expectedErrorShare: 0.8,
  dataState: "preliminary",
};

describe("diagnostic relationship layout", () => {
  it("projects every mapped token into the shared 60-column keyboard space", () => {
    const points = diagnosticKeyboardPoints();
    expect(points.get("zhuyin:ㄅ")).toEqual({ x: 6, y: 0.5 });
    expect(points.get("zhuyin:ㄢ")).toEqual({ x: 42, y: 0.5 });
    expect(points.get("zhuyin:ㄨ")).toEqual({ x: 33, y: 2.5 });
    expect(points.get("tone:1")).toEqual({ x: 30, y: 4.5 });
  });

  it("builds deterministic directional paths and preserves selection", () => {
    const [path] = buildDiagnosticRelationshipPaths("transition", [transition], transition.id);
    expect(path).toMatchObject({
      id: transition.id,
      selected: true,
      includesTone: false,
      width: 2,
    });
    expect(path?.path.startsWith("M ")).toBe(true);

    const reverse = {
      ...transition,
      id: "transition:zhuyin:ㄨ→zhuyin:ㄓ",
      fromTokenId: transition.toTokenId,
      toTokenId: transition.fromTokenId,
      fromSymbol: transition.toSymbol,
      toSymbol: transition.fromSymbol,
    } satisfies TransitionDiagnostic;
    expect(buildDiagnosticRelationshipPaths("transition", [reverse], null)[0]?.path)
      .not.toBe(path?.path);
  });

  it("keeps confusion routing separate and marks tone relations", () => {
    const [confusionPath] = buildDiagnosticRelationshipPaths("confusion", [confusion], null);
    expect(confusionPath?.label).toContain("應按 ㄢ");
    expect(confusionPath?.includesTone).toBe(false);

    const toneTransition = {
      ...transition,
      id: "transition:zhuyin:ㄢ→tone:4",
      fromTokenId: "zhuyin:ㄢ",
      toTokenId: "tone:4",
      fromSymbol: "ㄢ",
      toSymbol: "ˋ",
      toPhysicalKey: "4",
      includesTone: true,
    } satisfies TransitionDiagnostic;
    expect(buildDiagnosticRelationshipPaths("transition", [toneTransition], null)[0]?.includesTone)
      .toBe(true);
  });

  it("derives severity from error share for confusions and timing bands for transitions", () => {
    const [transitionPath] = buildDiagnosticRelationshipPaths("transition", [transition], null);
    expect(transitionPath?.severity).toBe(1);

    const [confusionPath] = buildDiagnosticRelationshipPaths("confusion", [confusion], null);
    expect(confusionPath?.severity).toBe(0.8);

    const fastTransition = { ...transition, timingMs: 200 } satisfies TransitionDiagnostic;
    expect(buildDiagnosticRelationshipPaths("transition", [fastTransition], null)[0]?.severity)
      .toBe(0);
  });

  it("builds an unranked, unfiltered network of transitions only, never confusions", () => {
    const paths = buildDiagnosticNetworkPaths({
      transitions: [transition],
    });
    const real = paths.filter((path) => !path.potential);
    expect(real.map((path) => path.id)).toEqual([transition.id]);
    for (const path of paths) {
      expect(path.selected).toBe(false);
      expect(path.id.startsWith("confusion:")).toBe(false);
    }
    const network = real.find((path) => path.id === transition.id);
    expect(network?.width).toBeCloseTo(1.1 + 1 * 1.4);
    expect(network?.opacity).toBeCloseTo(0.2 + 1 * 0.55);
  });

  it("fills unmeasured grammatically-possible transitions with a faint potential mesh", () => {
    const paths = buildDiagnosticNetworkPaths({
      transitions: [transition],
    });
    const potential = paths.filter((path) => path.potential);
    expect(potential.length).toBeGreaterThan(100);
    for (const path of potential) {
      expect(path.id.startsWith("potential:")).toBe(true);
      expect(path.severity).toBe(0);
      expect(path.selected).toBe(false);
      expect(path.path.startsWith("M ")).toBe(true);
    }
    // A common legal initial-then-final pair with no measurement shows up...
    expect(potential.some((path) => path.id === "potential:zhuyin:ㄅ:zhuyin:ㄚ")).toBe(true);
    // ...but the measured transition is not duplicated, even though ㄓ then
    // ㄨ is itself a grammatically legal pair (聲母ㄓ + 韻母ㄨ).
    expect(potential.some((path) => path.id.includes("zhuyin:ㄓ") && path.id.includes("zhuyin:ㄨ"))).toBe(false);
    // Confusions have no "possible" universe of their own, so the measured
    // ㄢ→ㄤ confusion never collides with (or gets treated as) a potential
    // transition entry.
    expect(potential.some((path) => path.id.includes("zhuyin:ㄢ") && path.id.includes("zhuyin:ㄤ"))).toBe(false);
  });
});
