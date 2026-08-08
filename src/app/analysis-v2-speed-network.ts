import "./analysis-v2-speed-network.css";
import type { TokenId } from "../core/model.js";
import type { ImmediateTokenAggregateScope } from "../measurement-v2/aggregate.js";
import { tokenLabel } from "../diagnostics/labels.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import { KEYBOARD_GEOMETRY_ROWS, keyboardColumnSpan } from "./keyboard-geometry.js";
import type { AnalysisV2MotorCell } from "./analysis-v2-model.js";

export interface AnalysisV2SpeedPath {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly width: number;
  readonly opacity: number;
  /** Relative speed rank inside this homogeneous exact-transition family. */
  readonly slowness: number;
  readonly ready: boolean;
  readonly includesTone: boolean;
}

export const ANALYSIS_V2_SPEED_VIEWBOX = Object.freeze({
  minX: 0,
  minY: 0,
  width: 60,
  height: 5,
});

interface KeyboardPoint {
  readonly x: number;
  readonly y: number;
}

function keyboardPoints(): ReadonlyMap<TokenId, KeyboardPoint> {
  const result = new Map<TokenId, KeyboardPoint>();
  KEYBOARD_GEOMETRY_ROWS.forEach((row, rowIndex) => {
    let column = 0;
    for (const key of row) {
      const span = keyboardColumnSpan(key);
      const tokenId = STANDARD_BOPOMOFO_LAYOUT.bindings[key.code];
      if (tokenId !== undefined) {
        result.set(tokenId, { x: column + span / 2, y: rowIndex + 0.5 });
      }
      column += span;
    }
    if (column !== ANALYSIS_V2_SPEED_VIEWBOX.width) {
      throw new Error(`keyboard row ${rowIndex} spans ${column}, expected 60`);
    }
  });
  return result;
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pathFor(
  id: string,
  from: KeyboardPoint,
  to: KeyboardPoint,
  includesTone: boolean,
): string {
  const lane = stableHash(id) % 4;
  const xDistance = Math.abs(to.x - from.x);
  if (xDistance < 0.01) {
    const side = stableHash(`${id}:side`) % 2 === 0 ? -1 : 1;
    const controlX = from.x + side * (1.5 + lane * 0.38);
    return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${controlX.toFixed(2)} ${from.y.toFixed(2)}, ${controlX.toFixed(2)} ${to.y.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }
  const baseRise = includesTone ? 0.72 : 0.3 + Math.min(0.58, xDistance / 38);
  const laneRise = lane * (includesTone ? 0.1 : 0.08);
  const controlY = Math.min(from.y, to.y) - baseRise - laneRise;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${from.x.toFixed(2)} ${controlY.toFixed(2)}, ${to.x.toFixed(2)} ${controlY.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

function sampleWidth(samples: number): number {
  if (samples >= 8) return 2;
  if (samples >= 5) return 1.65;
  if (samples >= 3) return 1.35;
  return 1.1;
}

/**
 * Builds only edges that have at least one clean within-syllable timing sample.
 * No potential/canonical edge is synthesized. Slowness is a within-family rank,
 * so one outlier cannot redefine a global millisecond threshold for every edge.
 */
export function buildAnalysisV2SpeedPaths(
  cells: readonly AnalysisV2MotorCell<ImmediateTokenAggregateScope>[],
): readonly AnalysisV2SpeedPath[] {
  const points = keyboardPoints();
  const timed = cells
    .filter((cell) => cell.timingSamples > 0 && cell.currentTimeToTypeMs !== null)
    .sort((left, right) => {
      const time = left.currentTimeToTypeMs! - right.currentTimeToTypeMs!;
      return time !== 0 ? time : left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
  const maximumRank = Math.max(1, timed.length - 1);
  return timed.flatMap((cell, index) => {
    const from = points.get(cell.scope.fromToken);
    const to = points.get(cell.scope.toToken);
    if (from === undefined || to === undefined || cell.currentTimeToTypeMs === null) return [];
    const slowness = timed.length === 1 ? 0.5 : index / maximumRank;
    const includesTone = cell.scope.fromToken.startsWith("tone:")
      || cell.scope.toToken.startsWith("tone:");
    return [{
      id: cell.id,
      path: pathFor(cell.id, from, to, includesTone),
      label: `${tokenLabel(cell.scope.fromToken)} 到 ${tokenLabel(cell.scope.toToken)}，${Math.round(cell.currentTimeToTypeMs)} 毫秒，${cell.timingSamples} 個乾淨樣本`,
      width: sampleWidth(cell.timingSamples),
      opacity: cell.ready ? 0.34 + slowness * 0.46 : 0.18 + slowness * 0.2,
      slowness,
      ready: cell.ready,
      includesTone,
    }];
  });
}
