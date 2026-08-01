import type { TokenId } from "../core/model.js";
import { DIAGNOSTIC_POLICY } from "../diagnostics/policy.js";
import type {
  ConfusionDiagnostic,
  DiagnosticModel,
  TransitionDiagnostic,
} from "../diagnostics/types.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import {
  analyseSyllableBody,
  listSupportedCatalogSyllableBodies,
} from "../scheme/syllable-grammar.js";
import { TONES, toneToken, zhuyinToken } from "../scheme/tokens.js";
import {
  KEYBOARD_GEOMETRY_ROWS,
  keyboardColumnSpan,
} from "./keyboard-geometry.js";

export type DiagnosticRelationshipRow = TransitionDiagnostic | ConfusionDiagnostic;
export type DiagnosticRelationshipKind = "transition" | "confusion";

/**
 * What the analysis panel just put on screen, stated rather than inferred.
 *
 * The overlay that draws relationships over the keyboard used to work this out
 * by reading the panel's own markup back: which tab carried
 * `aria-selected="true"`, which control carried `aria-pressed`, which list
 * button carried a `selected` class, and which `data-id` each of them held. It
 * worked, but it made a rendering detail into an interface -- renaming a class
 * or restructuring the list would have made the graph quietly disappear with
 * nothing to report it -- and it needed a subtree `MutationObserver` to guess
 * when to redraw, which then had to be disconnected around its own writes so it
 * would not answer them.
 *
 * The panel knows all four of these before it renders. Handing them over costs
 * one call and removes the observer, the guessing and the coupling together.
 */
export interface DiagnosticRelationshipView {
  /** Null on the key tab, where there is no relationship list to draw. */
  readonly kind: DiagnosticRelationshipKind | null;
  /** The rows the inspector listed, in the order it listed them. */
  readonly rows: readonly DiagnosticRelationshipRow[];
  readonly selectedId: string | null;
  /**
   * Whether the whole-keyboard mesh is showing, which is the preference already
   * narrowed by anything that steps it aside. It can be on for any tab, so it
   * is reported independently of `kind`.
   */
  readonly networkVisible: boolean;
  /** The mesh is drawn from the whole model rather than from the listed rows. */
  readonly model: DiagnosticModel;
}

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
  // A grammatically-possible transition with no measurements yet, not a
  // measured relation.
  readonly potential: boolean;
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
      potential: false,
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
    potential: false,
  };
}

function pairKey(a: TokenId, b: TokenId): string {
  return `${a} ${b}`;
}

// Bopomofo input has one fixed compositional order (initial, then medial
// and/or final, then tone), never reversed. This walks every syllable body
// the practice catalog actually supports and reads off the adjacent-symbol
// pairs that order permits, so the mesh reflects real Zhuyin structure
// instead of guessing from keyboard geometry.
function possibleTransitionPairs(): readonly (readonly [TokenId, TokenId])[] {
  const pairs = new Map<string, readonly [TokenId, TokenId]>();
  for (const body of listSupportedCatalogSyllableBodies()) {
    const { initial, rime } = analyseSyllableBody(body);
    const chain: TokenId[] = initial === null ? [] : [zhuyinToken(initial)];
    for (const symbol of rime) chain.push(zhuyinToken(symbol));
    for (let index = 0; index < chain.length - 1; index += 1) {
      const from = chain[index]!;
      const to = chain[index + 1]!;
      pairs.set(pairKey(from, to), [from, to]);
    }
    const last = chain[chain.length - 1];
    if (last !== undefined) {
      for (const tone of TONES) {
        const to = toneToken(tone);
        pairs.set(pairKey(last, to), [last, to]);
      }
    }
  }
  return [...pairs.values()];
}

function potentialPath(
  points: ReadonlyMap<TokenId, DiagnosticKeyboardPoint>,
  fromTokenId: TokenId,
  toTokenId: TokenId,
): DiagnosticRelationshipPath {
  const from = points.get(fromTokenId)!;
  const to = points.get(toTokenId)!;
  const includesTone = fromTokenId.startsWith("tone:") || toTokenId.startsWith("tone:");
  const id = `potential:${fromTokenId}:${toTokenId}`;
  return {
    id,
    path: relationshipPath(id, from, to, includesTone),
    label: "",
    width: 0.8,
    opacity: 0.14,
    selected: false,
    includesTone,
    severity: 0,
    potential: true,
  };
}

// Every measured transition, plus a faint backdrop mesh of every
// grammatically-possible transition that has no data yet, so the network
// reads as a graph that fills in with red rather than one that only shows up
// once something has already gone wrong. Confusions are deliberately left
// out: they are error events, not part of the syllable-order structure this
// mesh visualises, and mixing them in muddied what the lines meant.
export function buildDiagnosticNetworkPaths(
  model: Pick<DiagnosticModel, "transitions">,
): readonly DiagnosticRelationshipPath[] {
  const points = diagnosticKeyboardPoints();
  const covered = new Set<string>();
  const real: DiagnosticRelationshipPath[] = [];
  for (const row of model.transitions) {
    const path = networkPath(points, "transition", row);
    if (path === null) continue;
    real.push(path);
    covered.add(pairKey(row.fromTokenId, row.toTokenId));
  }
  const potential: DiagnosticRelationshipPath[] = [];
  for (const [fromTokenId, toTokenId] of possibleTransitionPairs()) {
    const key = pairKey(fromTokenId, toTokenId);
    if (covered.has(key)) continue;
    if (points.get(fromTokenId) === undefined || points.get(toTokenId) === undefined) continue;
    potential.push(potentialPath(points, fromTokenId, toTokenId));
  }
  return [...potential, ...real];
}

export const DIAGNOSTIC_RELATIONSHIP_VIEWBOX = Object.freeze({
  minX: 0,
  minY: 0,
  width: KEYBOARD_COLUMNS,
  height: KEYBOARD_ROWS,
});
