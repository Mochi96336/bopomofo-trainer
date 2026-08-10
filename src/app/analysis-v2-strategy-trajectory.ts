import {
  STRATEGY_TRAJECTORY_LIMIT,
  type CoordinationBodySizeBucket,
  type InputOrderTrajectorySample,
} from "../measurement-v2/aggregate.js";
import type {
  ThreePartInputOrderPermutation,
  TwoPartInputOrderPermutation,
} from "../measurement-v2/types.js";
import { escapeHtml } from "./html.js";

const VIEW_WIDTH = 720;
const VIEW_HEIGHT = 200;
// Only reserve enough room for rail labels. Position projection now belongs to
// the shared lower reading rail and no longer consumes trajectory plot width.
const PLOT_LEFT = 82;
const PLOT_RIGHT = 18;
const AXIS_Y = 177;
const MIN_DOMAIN_MS = 400;
const MAX_DOMAIN_MS = 2000;
const THREE_PART_ROLE_Y = {
  first: 34,
  middle: 91,
  last: 148,
} as const;
const TWO_PART_ROLE_Y = {
  first: 55,
  last: 127,
} as const;

type StructuralPosition = "first" | "middle" | "last";

function positionsForThreePartPermutation(
  permutation: ThreePartInputOrderPermutation,
): readonly [StructuralPosition, StructuralPosition, StructuralPosition] {
  switch (permutation) {
    case "first-middle-last": return ["first", "middle", "last"];
    case "middle-first-last": return ["middle", "first", "last"];
    case "first-last-middle": return ["first", "last", "middle"];
    case "middle-last-first": return ["middle", "last", "first"];
    case "last-first-middle": return ["last", "first", "middle"];
    case "last-middle-first": return ["last", "middle", "first"];
  }
}

function positionsForTwoPartPermutation(
  permutation: TwoPartInputOrderPermutation,
): readonly ["first" | "last", "first" | "last"] {
  return permutation === "first-last" ? ["first", "last"] : ["last", "first"];
}

function threePartRoleLabel(position: StructuralPosition): string {
  if (position === "first") return "聲母";
  if (position === "middle") return "介音";
  return "韻母";
}

function roleLabel(bodySize: CoordinationBodySizeBucket, position: StructuralPosition): string {
  if (bodySize === "2") return position === "first" ? "前位" : "後位";
  return threePartRoleLabel(position);
}

export function strategyPermutationStructureLabel(
  permutation: ThreePartInputOrderPermutation,
): string {
  return positionsForThreePartPermutation(permutation).map(threePartRoleLabel).join(" → ");
}

function sampleOrderLabel(sample: InputOrderTrajectorySample): string {
  if (sample.bodySize === "2") {
    return positionsForTwoPartPermutation(sample.permutation)
      .map((position) => roleLabel("2", position))
      .join(" → ");
  }
  return strategyPermutationStructureLabel(sample.permutation);
}

function finalElapsedMs(sample: InputOrderTrajectorySample): number {
  return sample.elapsedMs[sample.elapsedMs.length - 1] ?? 0;
}

function trajectoryDomain(samples: readonly InputOrderTrajectorySample[]): {
  readonly maximumMs: number;
  readonly clipped: boolean;
} {
  const rawMaximum = Math.max(0, ...samples.map(finalElapsedMs));
  const rounded = Math.ceil(Math.max(MIN_DOMAIN_MS, rawMaximum) / 100) * 100;
  return {
    maximumMs: Math.min(MAX_DOMAIN_MS, rounded),
    clipped: rawMaximum > MAX_DOMAIN_MS,
  };
}

function xForTime(timeMs: number, maximumMs: number): number {
  const width = VIEW_WIDTH - PLOT_LEFT - PLOT_RIGHT;
  return PLOT_LEFT + (Math.min(timeMs, maximumMs) / maximumMs) * width;
}

function yForPosition(bodySize: CoordinationBodySizeBucket, position: StructuralPosition): number {
  if (bodySize === "2") return TWO_PART_ROLE_Y[position === "first" ? "first" : "last"];
  return THREE_PART_ROLE_Y[position];
}

function positionsForSample(sample: InputOrderTrajectorySample): readonly StructuralPosition[] {
  return sample.bodySize === "2"
    ? positionsForTwoPartPermutation(sample.permutation)
    : positionsForThreePartPermutation(sample.permutation);
}

function pathForTrajectory(sample: InputOrderTrajectorySample, maximumMs: number): string {
  const positions = positionsForSample(sample);
  return sample.elapsedMs.map((timeMs, index) => {
    const x = xForTime(timeMs, maximumMs);
    const y = yForPosition(sample.bodySize, positions[index]!);
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y}`;
  }).join(" ");
}

function opacityForAge(index: number, total: number): number {
  const age = total - 1 - index;
  return Math.min(0.18, 0.03 + 0.15 * Math.exp(-age / 18));
}

function railPositions(bodySize: CoordinationBodySizeBucket): readonly StructuralPosition[] {
  return bodySize === "2" ? ["first", "last"] : ["first", "middle", "last"];
}

export function strategyTrajectoryMarkup(
  bodySize: CoordinationBodySizeBucket,
  samples: readonly InputOrderTrajectorySample[],
): string {
  const visibleSamples = samples.filter((sample) => sample.bodySize === bodySize);
  const { maximumMs, clipped } = trajectoryDomain(visibleSamples);
  const midpoint = Math.round(maximumMs / 2);
  const ticks = [0, midpoint, maximumMs];
  const rails = railPositions(bodySize).map((position) => {
    const y = yForPosition(bodySize, position);
    return `<g class="analysis-v2-strategy-trajectory-rail"><text x="${PLOT_LEFT - 14}" y="${y + 4}" text-anchor="end">${roleLabel(bodySize, position)}</text><line x1="${PLOT_LEFT}" y1="${y}" x2="${VIEW_WIDTH - PLOT_RIGHT}" y2="${y}"></line></g>`;
  }).join("");
  const grid = ticks.map((tick) => {
    const x = xForTime(tick, maximumMs);
    const endLabel = tick === maximumMs && clipped ? `${tick}+ ms` : `${tick} ms`;
    return `<g class="analysis-v2-strategy-trajectory-tick"><line x1="${x.toFixed(1)}" y1="20" x2="${x.toFixed(1)}" y2="${AXIS_Y - 14}"></line><text x="${x.toFixed(1)}" y="${AXIS_Y}" text-anchor="middle">${endLabel}</text></g>`;
  }).join("");
  const paths = visibleSamples.map((sample, index) => {
    const opacity = opacityForAge(index, visibleSamples.length);
    const finalMs = finalElapsedMs(sample);
    const sampleClipped = finalMs > maximumMs;
    const elapsed = sample.elapsedMs.map((value) => Math.round(value)).join("、");
    const title = `${sampleOrderLabel(sample)}；${elapsed} 毫秒`;
    return `<path class="analysis-v2-strategy-trajectory-path${sampleClipped ? " is-clipped" : ""}" d="${pathForTrajectory(sample, maximumMs)}" style="--trajectory-opacity:${opacity.toFixed(3)}"><title>${escapeHtml(title)}</title></path>`;
  }).join("");
  const bodyLabel = bodySize === "2" ? "二注音" : "三注音";
  const meta = visibleSamples.length === 0
    ? "軌跡從此版本開始累積"
    : `最近 ${visibleSamples.length} 個乾淨${bodyLabel}字 · 越新越清楚 · 最多保留 ${STRATEGY_TRAJECTORY_LIMIT} 個`;
  const railDescription = bodySize === "2" ? "前位、後位" : "聲母、介音、韻母";

  return `<div class="analysis-v2-strategy-trajectory" data-body-size="${bodySize}">
    <div class="analysis-v2-strategy-trajectory-meta"><strong>字內輸入軌跡</strong><span>${escapeHtml(meta)}</span></div>
    <svg viewBox="0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}" role="img" aria-label="最近${bodyLabel}字的${railDescription}完成軌跡；橫軸是從第一個接受注音開始計算的相對毫秒">
      ${grid}
      ${rails}
      <g class="analysis-v2-strategy-trajectory-lines">${paths}</g>
      <text class="analysis-v2-strategy-trajectory-axis-label" x="${VIEW_WIDTH - PLOT_RIGHT}" y="${VIEW_HEIGHT - 5}" text-anchor="end">字內累積完成時間</text>
    </svg>
  </div>`;
}