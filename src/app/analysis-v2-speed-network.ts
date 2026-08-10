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
  /** Relative speed rank inside the visible homogeneous exact-transition family. */
  readonly slowness: number;
  readonly includesTone: boolean;
}

export const ANALYSIS_V2_SPEED_VIEWBOX = Object.freeze({
  minX: 0,
  minY: 0,
  width: 60,
  height: 5,
});

export const ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES = 36;

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

  /* Keep top-row arcs distinct instead of letting several long transitions hit
     the same y=0.08 ceiling. Distance and the stable lane still influence rise,
     but their combined rise is scaled to fit inside the existing 0..5 viewBox. */
  const baseRise = includesTone
    ? 0.26
    : 0.16 + Math.min(0.12, xDistance / 100);
  const laneRise = lane * 0.035;
  const controlY = Math.max(0.08, Math.min(from.y, to.y) - baseRise - laneRise);
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${from.x.toFixed(2)} ${controlY.toFixed(2)}, ${to.x.toFixed(2)} ${controlY.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

/**
 * Shared keyboard-space curve geometry for overlays that connect two mapped
 * Bopomofo tokens. Coordination and Semantic confusion use the same physical
 * keyboard coordinates so their endpoints cannot drift apart visually.
 */
export function analysisV2KeyboardCurvePath(
  id: string,
  fromToken: TokenId,
  toToken: TokenId,
): string | null {
  const points = keyboardPoints();
  const from = points.get(fromToken);
  const to = points.get(toToken);
  if (from === undefined || to === undefined) return null;
  const includesTone = fromToken.startsWith("tone:") || toToken.startsWith("tone:");
  return pathFor(id, from, to, includesTone);
}

function sampleWidth(samples: number): number {
  if (samples >= 12) return 2;
  if (samples >= 8) return 1.7;
  return 1.4;
}

function compareSupport(
  left: AnalysisV2MotorCell<ImmediateTokenAggregateScope>,
  right: AnalysisV2MotorCell<ImmediateTokenAggregateScope>,
): number {
  return right.timingSamples - left.timingSamples
    || right.observations - left.observations
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

export function exactTransitionHistoryLabel(
  cell: AnalysisV2MotorCell<ImmediateTokenAggregateScope>,
): string {
  const values = cell.history.slice(-5).map((point) => Math.round(point.representativeTimingMs));
  if (values.length > 0) return `近期完成點 ${values.join(" → ")} 毫秒`;
  if (cell.partialTimingSamples > 0) {
    return `近期歷史累積中，${cell.partialTimingSamples} 個尚未成點樣本`;
  }
  return "近期歷史尚無完成點";
}

/**
 * Draws only exact accepted-token transitions with enough clean within-syllable
 * timing support to be comparable. If the family grows dense, the graph keeps
 * the highest-support edges rather than turning the keyboard into a complete
 * mesh. No potential/canonical edge is synthesized.
 */
export function buildAnalysisV2SpeedPaths(
  cells: readonly AnalysisV2MotorCell<ImmediateTokenAggregateScope>[],
  maximumVisibleEdges = ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES,
): readonly AnalysisV2SpeedPath[] {
  const points = keyboardPoints();
  const visible = cells
    .filter((cell) => cell.ready && cell.currentTimeToTypeMs !== null)
    .sort(compareSupport)
    .slice(0, Math.max(0, maximumVisibleEdges))
    .sort((left, right) => {
      const time = left.currentTimeToTypeMs! - right.currentTimeToTypeMs!;
      return time !== 0 ? time : left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
    });
  const maximumRank = Math.max(1, visible.length - 1);
  return visible.flatMap((cell, index) => {
    const from = points.get(cell.scope.fromToken);
    const to = points.get(cell.scope.toToken);
    if (from === undefined || to === undefined || cell.currentTimeToTypeMs === null) return [];
    const slowness = visible.length === 1 ? 0.5 : index / maximumRank;
    const includesTone = cell.scope.fromToken.startsWith("tone:")
      || cell.scope.toToken.startsWith("tone:");
    return [{
      id: cell.id,
      path: pathFor(cell.id, from, to, includesTone),
      label: `${tokenLabel(cell.scope.fromToken)} 到 ${tokenLabel(cell.scope.toToken)}，${Math.round(cell.currentTimeToTypeMs)} 毫秒，${cell.timingSamples} 個乾淨樣本；${exactTransitionHistoryLabel(cell)}`,
      width: sampleWidth(cell.timingSamples),
      opacity: 0.48 + slowness * 0.34,
      slowness,
      includesTone,
    }];
  });
}
