import { describe, expect, it } from "vitest";
import { buildAnalysisV2SpeedPaths } from "../../src/app/analysis-v2-speed-network.js";
import type { AnalysisV2MotorCell } from "../../src/app/analysis-v2-model.js";
import type { ImmediateTokenAggregateScope } from "../../src/measurement-v2/aggregate.js";

function cell(
  id: string,
  fromToken: string,
  toToken: string,
  timingMs: number | null,
  timingSamples: number,
): AnalysisV2MotorCell<ImmediateTokenAggregateScope> {
  return {
    id,
    scope: { fromToken, toToken },
    observations: Math.max(1, timingSamples),
    timingSamples,
    currentTimeToTypeMs: timingMs,
    bestTimeToTypeMs: timingMs,
    ready: timingMs !== null && timingSamples >= 5,
    history: [],
    partialTimingSamples: 0,
  };
}

describe("Analysis V2 observed speed network", () => {
  it("draws only edges with an accepted clean timing sample", () => {
    const paths = buildAnalysisV2SpeedPaths([
      cell("timed", "zhuyin:ㄩ", "zhuyin:ㄒ", 120, 5),
      cell("coverage-only", "zhuyin:ㄒ", "zhuyin:ㄩ", null, 0),
    ]);
    expect(paths).toHaveLength(1);
    expect(paths[0]?.id).toBe("timed");
    expect(paths[0]?.label).toContain("ㄩ 到 ㄒ");
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

  it("maps relative slowness only within exact observed transition timing", () => {
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
    expect(paths.find((path) => path.id === "slow")?.includesTone).toBe(true);
  });
});
