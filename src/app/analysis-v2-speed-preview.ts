import { tokenLabel } from "../diagnostics/labels.js";
import type { ImmediateTokenAggregateScope } from "../measurement-v2/aggregate.js";
import type { AnalysisV2Model, AnalysisV2MotorCell } from "./analysis-v2-model.js";
import { exactTransitionHistoryLabel } from "./analysis-v2-speed-network.js";

const SPEED_TARGET_SELECTOR = ".analysis-v2-speed-path, .analysis-v2-speed-hit";

export interface AnalysisV2SpeedPreviewController {
  syncPinned(pathId: string | null): void;
  destroy(): void;
}

interface PreviewOwner {
  readonly id: string;
  readonly board: Element;
}

function relationTarget(target: EventTarget | null): SVGPathElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<SVGPathElement>(SPEED_TARGET_SELECTOR);
}

function relationOwner(target: EventTarget | null): PreviewOwner | null {
  const relation = relationTarget(target);
  const id = relation?.dataset.speedId;
  const board = relation?.closest(".analysis-v2-speed-board");
  return id === undefined || board === null || board === undefined ? null : { id, board };
}

/**
 * Owns all transient Coordination flyline interaction. Hover/focus temporarily
 * overrides the persistent path selected by the panel, while board identity
 * prevents a stale pre-render owner from restoring markup into a new render.
 */
export function mountAnalysisV2SpeedPreview(
  host: HTMLElement,
  getModel: () => AnalysisV2Model,
): AnalysisV2SpeedPreviewController {
  let pointerOwner: PreviewOwner | null = null;
  let focusOwner: PreviewOwner | null = null;
  let pinnedId: string | null = null;
  let activePreviewId: string | null = null;
  let previewBoard: Element | null = null;
  let baselineReadoutHtml: string | null = null;
  let baselineAccentId: string | null = null;
  let cachedBoard: Element | null = null;
  let cachedCells: ReadonlyMap<string, AnalysisV2MotorCell<ImmediateTokenAggregateScope>> = new Map();

  const clearRenderedPreviewState = (): void => {
    activePreviewId = null;
    previewBoard = null;
    baselineReadoutHtml = null;
    baselineAccentId = null;
  };

  const currentBoard = (): Element | null => host.querySelector(".analysis-v2-speed-board");

  const cellsForBoard = (board: Element): ReadonlyMap<string, AnalysisV2MotorCell<ImmediateTokenAggregateScope>> => {
    if (cachedBoard !== board) {
      cachedBoard = board;
      cachedCells = new Map(getModel().coordination.immediateTokens.map((cell) => [cell.id, cell]));
    }
    return cachedCells;
  };

  const setAccent = (board: Element, id: string | null): void => {
    for (const path of board.querySelectorAll<SVGPathElement>(".analysis-v2-speed-path")) {
      path.classList.toggle("is-accent", id !== null && path.dataset.speedId === id);
    }
  };

  const setRelationFocus = (board: Element, id: string | null): void => {
    const paths = [...board.querySelectorAll<SVGPathElement>(".analysis-v2-speed-path")];
    const focused = id === null ? null : paths.find((path) => path.dataset.speedId === id) ?? null;
    for (const path of paths) {
      path.classList.toggle("is-focused", focused !== null && path === focused);
      path.classList.toggle("is-muted", focused !== null && path !== focused);
    }
    const relatedTokens = new Set<string>();
    if (focused !== null) {
      if (focused.dataset.fromToken !== undefined) relatedTokens.add(focused.dataset.fromToken);
      if (focused.dataset.toToken !== undefined) relatedTokens.add(focused.dataset.toToken);
    }
    for (const key of board.querySelectorAll<HTMLElement>("[data-speed-token]")) {
      key.classList.toggle("is-related", relatedTokens.has(key.dataset.speedToken ?? ""));
    }
  };

  const showPreview = (owner: PreviewOwner): void => {
    const board = currentBoard();
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout");
    if (board === null || owner.board !== board || readout === null) return;
    if (activePreviewId === owner.id && previewBoard === board) return;
    const cell = cellsForBoard(board).get(owner.id);
    if (cell === undefined || cell.currentTimeToTypeMs === null) return;

    if (previewBoard !== board || baselineReadoutHtml === null) {
      previewBoard = board;
      baselineReadoutHtml = readout.innerHTML;
      baselineAccentId = board.querySelector<SVGPathElement>(".analysis-v2-speed-path.is-accent")
        ?.dataset.speedId ?? null;
    }
    activePreviewId = owner.id;
    setAccent(board, owner.id);
    setRelationFocus(board, owner.id);
    readout.innerHTML = `<strong><b>${tokenLabel(cell.scope.fromToken)} → ${tokenLabel(cell.scope.toToken)}</b><em>${Math.round(cell.currentTimeToTypeMs)} ms</em></strong><small>${cell.timingSamples} 個乾淨樣本 · 僅在畫面中的同類實際鍵間轉換中比較</small><span>${exactTransitionHistoryLabel(cell)} · 暫時預覽；點擊後固定 · 線粗＝樣本支持；越深紅＝相對越慢</span>`;
  };

  const restorePreview = (): void => {
    const board = previewBoard;
    const boardStillCurrent = board !== null && board === currentBoard();
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout");
    if (boardStillCurrent && readout !== null && baselineReadoutHtml !== null) {
      readout.innerHTML = baselineReadoutHtml;
      setAccent(board, baselineAccentId);
    }
    clearRenderedPreviewState();
    const current = currentBoard();
    if (current !== null) setRelationFocus(current, pinnedId);
  };

  const syncPreview = (): void => {
    const board = currentBoard();
    if (pointerOwner !== null && pointerOwner.board !== board) pointerOwner = null;
    if (focusOwner !== null && focusOwner.board !== board) focusOwner = null;
    const owner = pointerOwner ?? focusOwner;
    if (owner !== null) {
      showPreview(owner);
      return;
    }
    restorePreview();
  };

  const pointerOver = (event: PointerEvent): void => {
    const owner = relationOwner(event.target);
    if (owner === null) return;
    pointerOwner = owner;
    syncPreview();
  };

  const pointerOut = (event: PointerEvent): void => {
    const from = relationOwner(event.target);
    if (from === null || pointerOwner?.id !== from.id || pointerOwner.board !== from.board) return;
    const to = relationOwner(event.relatedTarget);
    if (to?.id === from.id && to.board === from.board) return;
    pointerOwner = to;
    syncPreview();
  };

  const focusIn = (event: FocusEvent): void => {
    const owner = relationOwner(event.target);
    if (owner === null) return;
    focusOwner = owner;
    syncPreview();
  };

  const focusOut = (event: FocusEvent): void => {
    const from = relationOwner(event.target);
    if (from === null || focusOwner?.id !== from.id || focusOwner.board !== from.board) return;
    const to = relationOwner(event.relatedTarget);
    if (to?.id === from.id && to.board === from.board) return;
    focusOwner = to;
    syncPreview();
  };

  host.addEventListener("pointerover", pointerOver);
  host.addEventListener("pointerout", pointerOut);
  host.addEventListener("focusin", focusIn);
  host.addEventListener("focusout", focusOut);

  return {
    syncPinned(pathId: string | null): void {
      pinnedId = pathId;
      const board = currentBoard();
      if (previewBoard !== null && previewBoard !== board) clearRenderedPreviewState();
      if (pointerOwner !== null && pointerOwner.board !== board) pointerOwner = null;
      if (focusOwner !== null && focusOwner.board !== board) focusOwner = null;
      const owner = pointerOwner ?? focusOwner;
      if (owner !== null) showPreview(owner);
      else if (board !== null) setRelationFocus(board, pinnedId);
    },
    destroy(): void {
      host.removeEventListener("pointerover", pointerOver);
      host.removeEventListener("pointerout", pointerOut);
      host.removeEventListener("focusin", focusIn);
      host.removeEventListener("focusout", focusOut);
      pointerOwner = null;
      focusOwner = null;
      pinnedId = null;
      cachedBoard = null;
      cachedCells = new Map();
      clearRenderedPreviewState();
    },
  };
}
