import type { TokenId } from "../core/model.js";
import { DIAGNOSTIC_POLICY } from "../diagnostics/policy.js";
import type {
  ConfusionDiagnostic,
  DiagnosticModel,
  TransitionDiagnostic,
} from "../diagnostics/types.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import {
  KEYBOARD_GEOMETRY_ROWS,
  keyboardColumnSpan,
} from "./keyboard-geometry.js";

export type DiagnosticRelationshipRow = TransitionDiagnostic | ConfusionDiagnostic;
export type DiagnosticRelationshipKind = "transition" | "confusion";

export interface DiagnosticKeyboardPoint {
  readonly x: number;
  readonly y: number;
}

export interface DiagnosticRelationshipPath {
  readonly id: string;
  readonly path: string;
  readonly label: string;
  readonly width: number;
  readonly opacity: number;
  readonly selected: boolean;
  readonly includesTone: boolean;
  // 0 (fast/rare, faint ink) to 1 (slow/frequent, full red).
  readonly severity: number;
}

const KEYBOARD_COLUMNS = 60;
const KEYBOARD_ROWS = 5;

function stableHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function diagnosticKeyboardPoints(): ReadonlyMap<TokenId, DiagnosticKeyboardPoint> {
  const result = new Map<TokenId, DiagnosticKeyboardPoint>();
  KEYBOARD_GEOMETRY_ROWS.forEach((row, rowIndex) => {
    let column = 0;
    for (const key of row) {
      const span = keyboardColumnSpan(key);
      const tokenId = STANDARD_BOPOMOFO_LAYOUT.bindings[key.code];
      if (tokenId !== undefined) {
        result.set(tokenId, {
          x: column + span / 2,
          y: rowIndex + 0.5,
        });
      }
      column += span;
    }
    if (column !== KEYBOARD_COLUMNS) {
      throw new Error(`keyboard row ${rowIndex} spans ${column}, expected ${KEYBOARD_COLUMNS}`);
    }
  });
  return result;
}

function relationTokens(
  kind: DiagnosticRelationshipKind,
  row: DiagnosticRelationshipRow,
): readonly [TokenId, TokenId] {
  if (kind === "transition" && "fromTokenId" in row) {
    return [row.fromTokenId, row.toTokenId];
  }
  if (kind === "confusion" && "expectedTokenId" in row) {
    return [row.expectedTokenId, row.actualTokenId];
  }
  throw new TypeError(`relationship row does not match ${kind}`);
}

function relationLabel(
  kind: DiagnosticRelationshipKind,
  row: DiagnosticRelationshipRow,
): string {
  if (kind === "transition" && "fromSymbol" in row) {
    return `${row.fromSymbol} 到 ${row.toSymbol}，${Math.round(row.timingMs)} 毫秒，${row.timingSamples} 個樣本`;
  }
  if (kind === "confusion" && "expectedSymbol" in row) {
    return `應按 ${row.expectedSymbol}，按成 ${row.actualSymbol}，${row.occurrences} 次`;
  }
  throw new TypeError(`relationship row does not match ${kind}`);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

// Confusions use their actual error share; transitions have no error rate, so
// slowness against the policy's timing bands stands in as the equivalent.
function relationSeverity(kind: DiagnosticRelationshipKind, row: DiagnosticRelationshipRow): number {
  if (kind === "confusion" && "expectedErrorShare" in row) {
    return clamp(row.expectedErrorShare, 0, 1);
  }
  if (kind === "transition" && "timingMs" in row) {
    const { medium, slow } = DIAGNOSTIC_POLICY.transitionTimingBandsMs;
    return clamp((row.timingMs - medium) / (slow - medium), 0, 1);
  }
  return 0;
}

function relationWidth(kind: DiagnosticRelationshipKind, row: DiagnosticRelationshipRow): number {
  const samples = kind === "transition" && "timingSamples" in row
    ? row.timingSamples
    : "occurrences" in row
      ? row.occurrences
      : 1;
  if (samples >= 8) return 2;
  if (samples >= 5) return 1.65;
  if (samples >= 3) return 1.35;
  return 1.1;
}

function relationshipPath(
  id: string,
  from: DiagnosticKeyboardPoint,
  to: DiagnosticKeyboardPoint,
  includesTone: boolean,
): string {
  const lane = stableHash(id) % 4;
  const xDistance = Math.abs(to.x - from.x);
  if (Math.abs(to.x - from.x) < 0.01) {
    const side = stableHash(`${id}:side`) % 2 === 0 ? -1 : 1;
    const controlX = from.x + side * (1.5 + lane * 0.38);
    return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${controlX.toFixed(2)} ${from.y.toFixed(2)}, ${controlX.toFixed(2)} ${to.y.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }

  const baseRise = includesTone ? 0.72 : 0.3 + Math.min(0.58, xDistance / 38);
  const laneRise = lane * (includesTone ? 0.1 : 0.08);
  const controlY = Math.min(from.y, to.y) - baseRise - laneRise;
  return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} C ${from.x.toFixed(2)} ${controlY.toFixed(2)}, ${to.x.toFixed(2)} ${controlY.toFixed(2)}, ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
}

export function buildDiagnosticRelationshipPaths(
  kind: DiagnosticRelationshipKind,
  rows: readonly DiagnosticRelationshipRow[],
  selectedId: string | null,
): readonly DiagnosticRelationshipPath[] {
  const points = diagnosticKeyboardPoints();
  const maximumRank = Math.max(1, rows.length - 1);
  return rows.flatMap((row, index) => {
    const [fromTokenId, toTokenId] = relationTokens(kind, row);
    const from = points.get(fromTokenId);
    const to = points.get(toTokenId);
    if (from === undefined || to === undefined) return [];
    const includesTone = fromTokenId.startsWith("tone:") || toTokenId.startsWith("tone:");
    return [{
      id: row.id,
      path: relationshipPath(row.id, from, to, includesTone),
      label: relationLabel(kind, row),
      width: relationWidth(kind, row),
      opacity: Math.max(0.28, 0.72 - (index / maximumRank) * 0.34),
      selected: selectedId === row.id,
      includesTone,
      severity: relationSeverity(kind, row),
    }];
  });
}

// Every transition and confusion at once, unfiltered and unranked — the
// primary visual on entering analysis, unlike the capped per-tab lists above.
function networkPath(
  points: ReadonlyMap<TokenId, DiagnosticKeyboardPoint>,
  kind: DiagnosticRelationshipKind,
  row: DiagnosticRelationshipRow,
): DiagnosticRelationshipPath | null {
  const [fromTokenId, toTokenId] = relationTokens(kind, row);
  const from = points.get(fromTokenId);
  const to = points.get(toTokenId);
  if (from === undefined || to === undefined) return null;
  const includesTone = fromTokenId.startsWith("tone:") || toTokenId.startsWith("tone:");
  const severity = relationSeverity(kind, row);
  return {
    id: row.id,
    path: relationshipPath(row.id, from, to, includesTone),
    label: relationLabel(kind, row),
    width: 1.1 + severity * 1.4,
    opacity: 0.2 + severity * 0.55,
    selected: false,
    includesTone,
    severity,
  };
}

export function buildDiagnosticNetworkPaths(
  model: Pick<DiagnosticModel, "transitions" | "confusions">,
): readonly DiagnosticRelationshipPath[] {
  const points = diagnosticKeyboardPoints();
  return [
    ...model.transitions.flatMap((row) => networkPath(points, "transition", row) ?? []),
    ...model.confusions.flatMap((row) => networkPath(points, "confusion", row) ?? []),
  ];
}

export const DIAGNOSTIC_RELATIONSHIP_VIEWBOX = Object.freeze({
  minX: 0,
  minY: 0,
  width: KEYBOARD_COLUMNS,
  height: KEYBOARD_ROWS,
});
