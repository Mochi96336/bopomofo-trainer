import "./diagnostic-modal.css";
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
import type { DiagnosticSnapshot } from "./diagnostic-snapshot.js";
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

function semanticDiagnosticModelFrom(snapshot: DiagnosticSnapshot | null) {
  const environment = environmentForTuning(
    snapshot?.selectionTuning ?? DEFAULT_SELECTION_TUNING,
  );
  const progress = snapshot?.progress ?? createFreshProgressForEnvironment(
    environment,
    "diagnostic-empty",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  return buildDiagnosticModel({
    // This compatibility projection is semantic-only in production: it carries
    // V2 binding/confusion evidence and deliberately exposes no transition rows.
    measurements: legacySelectionMeasurementView(progress.measurements),
    curriculum: progress.curriculum,
    support: environment.practiceSupport,
    layout: STANDARD_BOPOMOFO_LAYOUT,
    selectionPolicy: environment.utterancePolicy,
    timingExclusionsAvailable: false,
    progressHistory: snapshot?.progressHistory ?? null,
  });
}

function analysisV2ModelFrom(snapshot: DiagnosticSnapshot | null) {
  return buildAnalysisV2Model(
    semanticDiagnosticModelFrom(snapshot),
    snapshot?.progress.measurements ?? createEmptyMeasurementSummaryV2(),
    snapshot?.progressHistory ?? null,
  );
}

export interface DiagnosticEnhancementDependencies {
  readonly closePanel: () => void;
  readonly focusPractice: () => void;
  readonly getSnapshot: () => DiagnosticSnapshot | null;
  readonly storage: AnalysisV2PreferenceStorage;
}

export interface DiagnosticEnhancement {
  panelRendered(content: HTMLElement): void;
  destroy(): void;
}

interface AnalysisTopLayer {
  close(): void;
  destroy(): void;
}

function findLegacyWeakSection(content: HTMLElement): HTMLElement | null {
  return content.querySelector<HTMLElement>('section[data-legacy-weak-section="true"]');
}

function openAnalysisFromPractice(
  analysis: AnalysisV2Controller,
  deps: DiagnosticEnhancementDependencies,
): void {
  deps.closePanel();
  deps.focusPractice();
  analysis.open();
}

function mountAnalysisTopLayer(analysis: HTMLElement): AnalysisTopLayer {
  const modal = document.createElement("dialog");
  modal.className = "diagnostic-analysis-modal";
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

export function mountDiagnosticEnhancement(
  deps: DiagnosticEnhancementDependencies,
): DiagnosticEnhancement {
  const currentAnalysisModel = () => analysisV2ModelFrom(deps.getSnapshot());
  let topLayer: AnalysisTopLayer | null = null;
  const analysis = createAnalysisV2({
    getModel: currentAnalysisModel,
    storage: deps.storage,
    onClose: () => {
      // Close the browser top layer before focusing practice. A still-open modal
      // dialog owns focus containment, so attempting the reverse order leaves
      // focus on the now-hidden Analysis V2 close control.
      topLayer?.close();
      deps.focusPractice();
    },
  });
  topLayer = mountAnalysisTopLayer(analysis.host);

  return {
    panelRendered(content: HTMLElement): void {
      const section = findLegacyWeakSection(content);
      if (section === null) return;
      renderAnalysisV2Summary(
        section,
        currentAnalysisModel(),
        () => openAnalysisFromPractice(analysis, deps),
      );
      content.querySelector(".motor-diagnostic-section")?.remove();
    },
    destroy(): void {
      topLayer?.destroy();
      analysis.destroy();
    },
  };
}
