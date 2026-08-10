import { describe, expect, it } from "vitest";
import type { ImmediateTokenAggregateScope } from "../../src/measurement-v2/aggregate.js";
import type { AnalysisV2MotorCell } from "../../src/app/analysis-v2-model.js";
import {
  ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES,
  buildAnalysisV2SpeedPaths,
  exactTransitionHistoryLabel,
} from "../../src/app/analysis-v2-speed-network.js";

function cell(
  id: string,
  fromToken: ImmediateTokenAggregateScope["fromToken"],
  toToken: ImmediateTokenAggregateScope["toToken"],
  currentTimeToTypeMs: number | null,
  timingSamples: number,
  history: AnalysisV2MotorCell<ImmediateTokenAggregateScope>["history"] = [],
  partialTimingSamples = 0,
): AnalysisV2MotorCell<ImmediateTokenAggregateScope> {
  return {
    id,
    scope: { fromToken, toToken },
    observations: timingSamples,
    timingSamples,
    currentTimeToTypeMs,
    ready: timingSamples >= 5 && currentTimeToTypeMs !== null,
    history,
    partialTimingSamples,
  };
}

describe("Analysis V2 observed speed network", () => {
  it("draws only exact edges that reached the clean timing support threshold", () => {
    const paths = buildAnalysisV2SpeedPaths([
      cell("ready", "zhuyin:ㄅ", "zhuyin:ㄆ", 123, 5),
      cell("sampling", "zhuyin:ㄩ", "zhuyin:ㄒ", 234, 4),
      cell("untimed", "zhuyin:ㄝ", "tone:2", null, 8),
    ]);
    expect(paths.map((path) => path.id)).toEqual(["ready"]);
  });

  it("describes completed exact-transition history without converting it into a claim", () => {
    const path = buildAnalysisV2SpeedPaths([
      cell("history", "zhuyin:ㄅ", "zhuyin:ㄆ", 123, 8, [
        { representativeTimingMs: 180 },
        { representativeTimingMs: 160 },
        { representativeTimingMs: 123 },
      ]),
    ])[0]!;
    expect(path.label).toContain("近期完成點 180 → 160 → 123 毫秒");
    expect(path.label).not.toMatch(/進步|退步|改善/u);
  });

  it("reports an open exact-transition history bucket without fabricating a point", () => {
    expect(exactTransitionHistoryLabel(
      cell("partial", "zhuyin:ㄅ", "zhuyin:ㄆ", 123, 8, [], 3),
    )).toBe("近期歷史累積中，3 個尚未成點樣本");
  });

  it("keeps actual direction instead of normalizing a pair to canonical order", () => {
    const forward = buildAnalysisV2SpeedPaths([
      cell("actual-forward", "zhuyin:ㄩ", "zhuyin:ㄒ", 100, 5),
    ])[0]!;
    const reverse = buildAnalysisV2SpeedPaths([
      cell("actual-reverse", "zhuyin:ㄒ", "zhuyin:ㄩ", 100, 5),
    ])[0]!;
    expect(forward.label).toContain("ㄩ 到 ㄒ");
    expect(reverse.label).toContain("ㄒ 到 ㄩ");
    expect(forward.path).not.toBe(reverse.path);
  });

  it("maps relative slowness and red intensity only within the visible exact-transition family", () => {
    const paths = buildAnalysisV2SpeedPaths([
      cell("fast", "zhuyin:ㄅ", "zhuyin:ㄆ", 80, 8),
      cell("middle", "zhuyin:ㄩ", "zhuyin:ㄒ", 120, 5),
      cell("slow", "zhuyin:ㄝ", "tone:2", 200, 6),
    ]);
    expect(paths.map((path) => [path.id, path.slowness])).toEqual([
      ["fast", 0],
      ["middle", 0.5],
      ["slow", 1],
    ]);
    expect(paths.map((path) => Number(path.opacity.toFixed(2)))).toEqual([0.42, 0.57, 0.72]);
    expect(paths.find((path) => path.id === "slow")?.includesTone).toBe(true);
  });

  it("caps dense graphs by support before assigning relative speed ranks", () => {
    const paths = buildAnalysisV2SpeedPaths([
      cell("low-support", "zhuyin:ㄅ", "zhuyin:ㄆ", 70, 5),
      cell("high-support", "zhuyin:ㄩ", "zhuyin:ㄒ", 140, 12),
      cell("middle-support", "zhuyin:ㄝ", "tone:2", 110, 8),
    ], 2);
    expect(paths.map((path) => path.id).sort()).toEqual([
      "high-support",
      "middle-support",
    ]);
    expect(ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES).toBeGreaterThan(2);
  });

  it("never routes a top-row curve above the SVG viewBox", () => {
    const path = buildAnalysisV2SpeedPaths([
      cell("top-row", "zhuyin:ㄅ", "zhuyin:ㄆ", 100, 5),
    ])[0]!.path;
    const controlYs = [...path.matchAll(/C [\d.-]+ ([\d.-]+), [\d.-]+ ([\d.-]+),/gu)]
      .flatMap((match) => [Number(match[1]), Number(match[2])]);
    expect(controlYs.every((value) => value >= 0)).toBe(true);
  });
});