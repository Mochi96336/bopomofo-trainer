import "./analysis-v2-modal.css";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import {
  createAnalysisV2,
  renderAnalysisV2Summary,
  type AnalysisV2Controller,
  type AnalysisV2PreferenceStorage,
} from "./analysis-v2-panel.js";
import "./analysis-v2-layout.css";
import { buildAnalysisV2Model } from "./analysis-v2-model.js";
import {
  mountAnalysisV2Presentation,
  normalizeAnalysisV2Summary,
  type AnalysisV2Presentation,
} from "./analysis-v2-presentation.js";
import { buildAnalysisV2SemanticModel } from "./analysis-v2-semantic-model.js";
import type { AnalysisV2Snapshot } from "./analysis-v2-snapshot.js";

function analysisModelFrom(snapshot: AnalysisV2Snapshot) {
  const semantic = buildAnalysisV2SemanticModel({
    measurements: snapshot.progress.measurements,
    curriculum: snapshot.progress.curriculum,
    support: snapshot.practiceSupport,
    layout: STANDARD_BOPOMOFO_LAYOUT,
    progressHistory: snapshot.progressHistory,
  });
  return buildAnalysisV2Model(
    semantic,
    snapshot.progress.measurements,
    snapshot.progressHistory,
  );
}

export interface AnalysisV2IntegrationDependencies {
  readonly closePanel: () => void;
  readonly focusPractice: () => void;
  readonly getSnapshot: () => AnalysisV2Snapshot;
  readonly storage: AnalysisV2PreferenceStorage;
}

export interface AnalysisV2Integration {
  panelRendered(content: HTMLElement): void;
  destroy(): void;
}

interface AnalysisV2TopLayer {
  close(): void;
  destroy(): void;
}

function findAnalysisSummarySlot(content: HTMLElement): HTMLElement | null {
  return content.querySelector<HTMLElement>(
    'section[data-analysis-v2-summary-slot="true"]',
  );
}

function keyboardFlipOrigin(): DOMRect | null {
  const sketch = document.querySelector<HTMLElement>("#keyboard-sketch");
  if (sketch === null) return null;
  const board = sketch.querySelector<HTMLElement>(".keyboard-sketch-board") ?? sketch;
  const wasHidden = sketch.hidden;
  const previousVisibility = sketch.style.visibility;
  if (wasHidden) {
    sketch.hidden = false;
    sketch.style.visibility = "hidden";
  }
  const rect = board.getBoundingClientRect();
  if (wasHidden) {
    sketch.hidden = true;
    sketch.style.visibility = previousVisibility;
  }
  return rect.width > 0 && rect.height > 0 ? rect : null;
}

function visibleAnalysisKeyboardBoard(analysis: HTMLElement): HTMLElement | null {
  return analysis.querySelector<HTMLElement>(".analysis-v2-speed-board")
    ?? analysis.querySelector<HTMLElement>(".analysis-v2-keyboard");
}

function animateKeyboardRise(board: HTMLElement, origin: DOMRect | null): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || origin === null) return;
  const target = board.getBoundingClientRect();
  if (target.width === 0 || target.height === 0) return;
  const dx = (origin.left + origin.width / 2) - (target.left + target.width / 2);
  const dy = (origin.top + origin.height / 2) - (target.top + target.height / 2);

  // Motion and object geometry are deliberately separate. The keyboard keeps its
  // protected perspective/rotateX transform for the whole animation; only the
  // independent CSS translate property moves that already-tilted object from the
  // practice keyboard's screen-space position to the Analysis slot. No scale is
  // involved, so the object reads as the same keyboard travelling between views.
  board.animate([
    { translate: `${dx}px ${dy}px`, opacity: 0.25 },
    { translate: "0px 0px", opacity: 1 },
  ], { duration: 320, easing: "cubic-bezier(.2, .75, .25, 1)" });
}

function openAnalysisFromPractice(
  analysis: AnalysisV2Controller,
  presentation: AnalysisV2Presentation,
  deps: AnalysisV2IntegrationDependencies,
): void {
  // Capture the practice keyboard before the drawer closes or the practice stage
  // recedes. The analysis keyboard then translates from that exact screen-space
  // origin instead of being synthesized from a lower-stage fallback.
  const origin = keyboardFlipOrigin();
  deps.closePanel();
  deps.focusPractice();
  document.body.classList.add("analysis-v2-open");
  analysis.open("coordination");
  presentation.refresh();
  window.requestAnimationFrame(() => {
    if (analysis.host.hidden) return;
    const board = visibleAnalysisKeyboardBoard(analysis.host);
    if (board !== null) animateKeyboardRise(board, origin);
  });
}

function mountAnalysisTopLayer(analysis: HTMLElement): AnalysisV2TopLayer {
  const modal = document.createElement("dialog");
  modal.className = "analysis-v2-modal";
  modal.setAttribute("aria-labelledby", "analysis-v2-title");
  analysis.removeAttribute("role");
  analysis.removeAttribute("aria-modal");
  analysis.removeAttribute("aria-labelledby");
  analysis.before(modal);
  modal.append(analysis);

  const close = (): void => {
    if (modal.open) modal.close();
  };
  const sync = (): void => {
    if (!analysis.hidden && !modal.open) {
      modal.showModal();
      return;
    }
    if (analysis.hidden) close();
  };
  const observer = new MutationObserver(sync);
  observer.observe(analysis, { attributes: true, attributeFilter: ["hidden"] });
  modal.addEventListener("cancel", (event) => event.preventDefault());
  sync();

  return {
    close,
    destroy(): void {
      observer.disconnect();
      close();
      modal.remove();
    },
  };
}

export function mountAnalysisV2Integration(
  deps: AnalysisV2IntegrationDependencies,
): AnalysisV2Integration {
  const currentAnalysisModel = () => analysisModelFrom(deps.getSnapshot());
  let topLayer: AnalysisV2TopLayer | null = null;
  const analysis = createAnalysisV2({
    getModel: currentAnalysisModel,
    storage: deps.storage,
    onClose: () => {
      document.body.classList.remove("analysis-v2-open");
      // Close the browser top layer before focusing practice. A still-open modal
      // owns focus containment and would otherwise reclaim focus.
      topLayer?.close();
      deps.focusPractice();
    },
  });
  const presentation = mountAnalysisV2Presentation(analysis.host, currentAnalysisModel);
  topLayer = mountAnalysisTopLayer(analysis.host);

  return {
    panelRendered(content: HTMLElement): void {
      const section = findAnalysisSummarySlot(content);
      if (section === null) return;
      renderAnalysisV2Summary(
        section,
        currentAnalysisModel(),
        () => openAnalysisFromPractice(analysis, presentation, deps),
      );
      normalizeAnalysisV2Summary(section);
    },
    destroy(): void {
      document.body.classList.remove("analysis-v2-open");
      presentation.destroy();
      topLayer?.destroy();
      analysis.destroy();
    },
  };
}
