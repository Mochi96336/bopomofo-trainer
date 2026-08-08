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

function openAnalysisFromPractice(
  analysis: AnalysisV2Controller,
  deps: AnalysisV2IntegrationDependencies,
): void {
  deps.closePanel();
  deps.focusPractice();
  analysis.open();
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
      // Close the browser top layer before focusing practice. A still-open modal
      // owns focus containment and would otherwise reclaim focus.
      topLayer?.close();
      deps.focusPractice();
    },
  });
  topLayer = mountAnalysisTopLayer(analysis.host);

  return {
    panelRendered(content: HTMLElement): void {
      const section = findAnalysisSummarySlot(content);
      if (section === null) return;
      renderAnalysisV2Summary(
        section,
        currentAnalysisModel(),
        () => openAnalysisFromPractice(analysis, deps),
      );
    },
    destroy(): void {
      topLayer?.destroy();
      analysis.destroy();
    },
  };
}
