import "./analysis-v2-modal.css";
import "./analysis-v2-layout.css";
import { buildDiagnosticModel } from "../diagnostics/build-model.js";
import { createEmptyMeasurementSummaryV2 } from "../measurement-v2/aggregate.js";
import { legacySelectionMeasurementView } from "../measurement-v2/legacy-selection-view.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../product/session.js";
import type { ProductEnvironment } from "../product/types.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import {
  EVALUATION_CATALOG,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "./generated/catalog.js";
import {
  createAnalysisV2,
  renderAnalysisV2Summary,
  type AnalysisV2Controller,
  type AnalysisV2PreferenceStorage,
} from "./analysis-v2-panel.js";
import { buildAnalysisV2Model } from "./analysis-v2-model.js";
import type { AnalysisV2Snapshot } from "./analysis-v2-snapshot.js";
import {
  DEFAULT_SELECTION_TUNING,
  policyForSelectionTuning,
  type SelectionTuning,
} from "./selection-tuning.js";

let cachedTuningKey = "";
let cachedEnvironment: ProductEnvironment | null = null;

function environmentForTuning(tuning: SelectionTuning): ProductEnvironment {
  const key = `${tuning.errorInfluence}:${tuning.timingInfluence}`;
  if (cachedEnvironment !== null && cachedTuningKey === key) return cachedEnvironment;
  cachedTuningKey = key;
  cachedEnvironment = createProductEnvironment(
    {
      practice: PRACTICE_CATALOG,
      evaluation: EVALUATION_CATALOG,
      syntaxProfiles: SYNTAX_PROFILES,
    },
    policyForSelectionTuning(tuning),
  );
  return cachedEnvironment;
}

function semanticModelFrom(snapshot: AnalysisV2Snapshot | null) {
  const environment = environmentForTuning(
    snapshot?.selectionTuning ?? DEFAULT_SELECTION_TUNING,
  );
  const progress = snapshot?.progress ?? createFreshProgressForEnvironment(
    environment,
    "analysis-v2-empty",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  return buildDiagnosticModel({
    // Temporary semantic compatibility projection only. It carries V2
    // binding/confusion evidence and deliberately exposes no transition rows.
    measurements: legacySelectionMeasurementView(progress.measurements),
    curriculum: progress.curriculum,
    support: environment.practiceSupport,
    layout: STANDARD_BOPOMOFO_LAYOUT,
    selectionPolicy: environment.utterancePolicy,
    timingExclusionsAvailable: false,
    progressHistory: snapshot?.progressHistory ?? null,
  });
}

function analysisModelFrom(snapshot: AnalysisV2Snapshot | null) {
  return buildAnalysisV2Model(
    semanticModelFrom(snapshot),
    snapshot?.progress.measurements ?? createEmptyMeasurementSummaryV2(),
    snapshot?.progressHistory ?? null,
  );
}

export interface AnalysisV2IntegrationDependencies {
  readonly closePanel: () => void;
  readonly focusPractice: () => void;
  readonly getSnapshot: () => AnalysisV2Snapshot | null;
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
  // The shell still emits the old placeholder attribute before this integration
  // replaces its contents. Keeping this compatibility lookup here prevents the
  // shell from learning any Analysis V2 rendering details.
  return content.querySelector<HTMLElement>('section[data-legacy-weak-section="true"]');
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
  modal.setAttribute("aria-labelledby", "diagnostic-analysis-title");
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
