import { tokenLabel } from "../diagnostics/labels.js";
import type { ImmediateTokenAggregateScope } from "../measurement-v2/aggregate.js";
import type { AnalysisV2Model, AnalysisV2MotorCell } from "./analysis-v2-model.js";

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
 * persistent selection owned by analysis-v2-panel. This controller only swaps
 * the current lower readout/accent while the pointer is over a relation; it
 * never changes aria-pressed or the panel's selected path state.
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

  const currentBoard = (): Element | null => host.querySelector(".analysis-v2-speed-board");

  const cellFor = (
    pathId: string,
  ): AnalysisV2MotorCell<ImmediateTokenAggregateScope> | undefined => {
    const board = currentBoard();
    if (board === null) return undefined;
    if (board !== cachedBoard) {
      cachedBoard = board;
      cachedCells = new Map(
        getModel().coordination.immediateTokens.map((cell) => [cell.id, cell]),
      );
    }
    return cachedCells.get(pathId);
  };

  const setAccent = (pathId: string | null): void => {
    for (const path of host.querySelectorAll<SVGPathElement>(".analysis-v2-speed-path")) {
      path.classList.toggle("is-accent", pathId !== null && path.dataset.speedId === pathId);
    }
  };

  const updateReadout = (
    cell: AnalysisV2MotorCell<ImmediateTokenAggregateScope>,
  ): boolean => {
    if (cell.currentTimeToTypeMs === null) return false;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout");
    const strong = readout?.querySelector<HTMLElement>("strong");
    const small = readout?.querySelector<HTMLElement>("small");
    if (readout === null || strong === null || small === null) return false;

    const pair = document.createElement("b");
    pair.textContent = `${tokenLabel(cell.scope.fromToken)} → ${tokenLabel(cell.scope.toToken)}`;
    const timing = document.createElement("em");
    timing.textContent = `${Math.round(cell.currentTimeToTypeMs)} ms`;
    strong.replaceChildren(pair, timing);
    small.textContent = `${cell.timingSamples} 個乾淨樣本 · 僅在畫面中的同類實際鍵間轉換中比較`;
    return true;
  };

  const preview = (pathId: string): void => {
    if (activePreviewId === pathId) return;
    const board = currentBoard();
    const cell = cellFor(pathId);
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout");
    if (board === null || cell === undefined || readout === null) return;

    if (activePreviewId === null) {
      previewBoard = board;
      baselineReadoutHtml = readout.innerHTML;
      baselineAccentId = host.querySelector<SVGPathElement>(
        ".analysis-v2-speed-path.is-accent",
      )?.dataset.speedId ?? null;
    }

    if (!updateReadout(cell)) return;
    activePreviewId = pathId;
    setAccent(pathId);
  };

  const restore = (): void => {
    if (activePreviewId === null) return;
    const board = currentBoard();
    if (board === previewBoard) {
      const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout");
      if (readout !== null && baselineReadoutHtml !== null) {
        readout.innerHTML = baselineReadoutHtml;
      }
      setAccent(baselineAccentId);
    }
    clearPreviewState();
  };

  const onPointerOver = (event: PointerEvent): void => {
    const pathId = relationId(event.target);
    if (pathId !== null) preview(pathId);
  };

  const onPointerOut = (event: PointerEvent): void => {
    if (relationTarget(event.target) === null) return;
    const nextId = relationId(event.relatedTarget);
    if (nextId !== null) {
      preview(nextId);
      return;
    }
    restore();
  };

  const onClick = (event: MouseEvent): void => {
    if (relationTarget(event.target) === null) return;
    // The panel owns click selection and re-renders synchronously. Clear the
    // transient snapshot after that event finishes so an old hover baseline can
    // never overwrite the newly pinned relation.
    queueMicrotask(clearPreviewState);
  };

  host.addEventListener("pointerover", onPointerOver);
  host.addEventListener("pointerout", onPointerOut);
  host.addEventListener("click", onClick);

  return {
    destroy(): void {
      restore();
      host.removeEventListener("pointerover", onPointerOver);
      host.removeEventListener("pointerout", onPointerOut);
      host.removeEventListener("click", onClick);
    },
  };
}
