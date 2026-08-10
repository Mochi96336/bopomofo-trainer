import { tokenLabel } from "../diagnostics/labels.js";
import type { ImmediateTokenAggregateScope } from "../measurement-v2/aggregate.js";
import type { AnalysisV2Model, AnalysisV2MotorCell } from "./analysis-v2-model.js";
import { exactTransitionHistoryLabel } from "./analysis-v2-speed-network.js";

const SPEED_TARGET_SELECTOR = ".analysis-v2-speed-path, .analysis-v2-speed-hit";

export interface AnalysisV2SpeedPreviewController {
  destroy(): void;
}

function relationTarget(target: EventTarget | null): SVGPathElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest<SVGPathElement>(SPEED_TARGET_SELECTOR);
}

function relationId(target: EventTarget | null): string | null {
  return relationTarget(target)?.dataset.speedId ?? null;
}

/**
 * Coordination flylines use hover as a transient preview and click as the
 * persistent selection owned by analysis-v2-panel. This controller swaps the
 * current lower readout/accent while the pointer is over a relation. It also
 * decorates the freshly rendered baseline readout with the exact-pair history;
 * the panel itself remains concerned only with current aggregate selection.
 */
export function mountAnalysisV2SpeedPreview(
  host: HTMLElement,
  getModel: () => AnalysisV2Model,
): AnalysisV2SpeedPreviewController {
  let activePreviewId: string | null = null;
  let previewBoard: Element | null = null;
  let baselineReadoutHtml: string | null = null;
  let baselineAccentId: string | null = null;
  let cachedBoard: Element | null = null;
  let cachedCells: ReadonlyMap<string, AnalysisV2MotorCell<ImmediateTokenAggregateScope>> = new Map();

  const clearPreviewState = (): void => {
    activePreviewId = null;
    previewBoard = null;
    baselineReadoutHtml = null;
    baselineAccentId = null;
  };

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

  const syncBaselineHistory = (): void => {
    const board = host.querySelector(".analysis-v2-speed-board");
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout");
    const detail = readout?.querySelector<HTMLElement>("span");
    const accent = board?.querySelector<SVGPathElement>(".analysis-v2-speed-path.is-accent");
    const id = accent?.dataset.speedId;
    if (board === null || detail == null || id === undefined) return;
    const cell = cellsForBoard(board).get(id);
    if (cell === undefined) return;
    const history = exactTransitionHistoryLabel(cell);
    const current = detail.textContent ?? "";
    if (current.startsWith(history)) return;
    detail.textContent = `${history} · ${current}`;
  };

  const showPreview = (id: string): void => {
    const board = host.querySelector(".analysis-v2-speed-board");
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout");
    if (board === null || readout === null) return;
    const cell = cellsForBoard(board).get(id);
    if (cell === undefined || cell.currentTimeToTypeMs === null) return;

    if (previewBoard !== board || baselineReadoutHtml === null) {
      previewBoard = board;
      baselineReadoutHtml = readout.innerHTML;
      baselineAccentId = board.querySelector<SVGPathElement>(".analysis-v2-speed-path.is-accent")
        ?.dataset.speedId ?? null;
    }
    activePreviewId = id;
    setAccent(board, id);
    readout.innerHTML = `<strong><b>${tokenLabel(cell.scope.fromToken)} → ${tokenLabel(cell.scope.toToken)}</b><em>${Math.round(cell.currentTimeToTypeMs)} ms</em></strong><small>${cell.timingSamples} 個乾淨樣本 · 僅在畫面中的同類實際鍵間轉換中比較</small><span>${exactTransitionHistoryLabel(cell)} · 暫時預覽；點擊後固定</span>`;
  };

  const restorePreview = (): void => {
    const board = previewBoard;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout");
    if (board !== null && readout !== null && baselineReadoutHtml !== null) {
      readout.innerHTML = baselineReadoutHtml;
      setAccent(board, baselineAccentId);
    }
    clearPreviewState();
    syncBaselineHistory();
  };

  const pointerOver = (event: PointerEvent): void => {
    const id = relationId(event.target);
    if (id === null || id === activePreviewId) return;
    showPreview(id);
  };

  const pointerOut = (event: PointerEvent): void => {
    const from = relationId(event.target);
    if (from === null || from !== activePreviewId) return;
    const to = relationId(event.relatedTarget);
    if (to === from) return;
    if (to !== null) {
      showPreview(to);
      return;
    }
    restorePreview();
  };

  const focusIn = (event: FocusEvent): void => {
    const id = relationId(event.target);
    if (id === null || id === activePreviewId) return;
    showPreview(id);
  };

  const focusOut = (event: FocusEvent): void => {
    const from = relationId(event.target);
    if (from === null || from !== activePreviewId) return;
    const to = relationId(event.relatedTarget);
    if (to === from) return;
    if (to !== null) {
      showPreview(to);
      return;
    }
    restorePreview();
  };

  host.addEventListener("pointerover", pointerOver);
  host.addEventListener("pointerout", pointerOut);
  host.addEventListener("focusin", focusIn);
  host.addEventListener("focusout", focusOut);

  const observer = new MutationObserver(() => syncBaselineHistory());
  observer.observe(host, { childList: true, subtree: true });
  syncBaselineHistory();

  return {
    destroy(): void {
      observer.disconnect();
      host.removeEventListener("pointerover", pointerOver);
      host.removeEventListener("pointerout", pointerOut);
      host.removeEventListener("focusin", focusIn);
      host.removeEventListener("focusout", focusOut);
      clearPreviewState();
    },
  };
}
