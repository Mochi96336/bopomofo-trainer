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
  createDiagnosticAnalysis,
  renderDiagnosticSummary,
  type DiagnosticAnalysisController,
} from "./diagnostic-panel.js";
import type { DiagnosticPreferenceStorage } from "./diagnostic-preferences.js";
import { renderDiagnosticRelationshipOverlay } from "./diagnostic-relationship-enhancement.js";
import type { DiagnosticSnapshot } from "./diagnostic-snapshot.js";
import {
  productionDiagnosticPreferenceStorage,
  retireLegacyTransitionAnalysis,
  retireLegacyTransitionSummary,
} from "./legacy-transition-retirement.js";
import { renderMotorDiagnosticSummary } from "./motor-diagnostic-summary.js";
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

function diagnosticModelFrom(snapshot: DiagnosticSnapshot | null) {
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
    measurements: legacySelectionMeasurementView(progress.measurements),
    curriculum: progress.curriculum,
    support: environment.practiceSupport,
    layout: STANDARD_BOPOMOFO_LAYOUT,
    selectionPolicy: environment.utterancePolicy,
    progressHistory: snapshot?.progressHistory ?? null,
  });
}

export interface DiagnosticEnhancementDependencies {
  readonly closePanel: () => void;
  readonly focusPractice: () => void;
  readonly getSnapshot: () => DiagnosticSnapshot | null;
  readonly storage: DiagnosticPreferenceStorage;
}

export interface DiagnosticEnhancement {
  panelRendered(content: HTMLElement): void;
  destroy(): void;
}

function findLegacyWeakSection(content: HTMLElement): HTMLElement | null {
  return content.querySelector<HTMLElement>('section[data-legacy-weak-section="true"]');
}

function openAnalysisFromPractice(
  analysis: DiagnosticAnalysisController,
  deps: DiagnosticEnhancementDependencies,
): void {
  deps.closePanel();
  deps.focusPractice();
  analysis.open();
}

function mountAnalysisTopLayer(
  analysis: HTMLElement,
  focusPractice: () => void,
): () => void {
  const modal = document.createElement("dialog");
  modal.className = "diagnostic-analysis-modal";
  modal.setAttribute("aria-labelledby", "diagnostic-analysis-title");
  analysis.removeAttribute("role");
  analysis.removeAttribute("aria-modal");
  analysis.removeAttribute("aria-labelledby");
  analysis.before(modal);
  modal.append(analysis);

  const sync = (): void => {
    if (!analysis.hidden && !modal.open) modal.showModal();
    if (analysis.hidden && modal.open) modal.close();
  };
  const observer = new MutationObserver(sync);
  observer.observe(analysis, { attributes: true, attributeFilter: ["hidden"] });
  modal.addEventListener("cancel", (event) => event.preventDefault());
  modal.addEventListener("close", focusPractice);
  sync();

  return () => {
    observer.disconnect();
    if (modal.open) modal.close();
    modal.remove();
  };
}

export function mountDiagnosticEnhancement(
  deps: DiagnosticEnhancementDependencies,
): DiagnosticEnhancement {
  const currentDiagnosticModel = () => diagnosticModelFrom(deps.getSnapshot());
  const analysis = createDiagnosticAnalysis({
    getModel: currentDiagnosticModel,
    storage: productionDiagnosticPreferenceStorage(deps.storage),
    onRendered: (view) => {
      retireLegacyTransitionAnalysis(analysis.host);
      renderDiagnosticRelationshipOverlay(analysis.host, view);
    },
  });
  const releaseTopLayer = mountAnalysisTopLayer(analysis.host, deps.focusPractice);

  return {
    panelRendered(content: HTMLElement): void {
      const section = findLegacyWeakSection(content);
      if (section === null) return;
      const model = currentDiagnosticModel();
      renderDiagnosticSummary(
        section,
        model,
        () => openAnalysisFromPractice(analysis, deps),
      );
      retireLegacyTransitionSummary(section, model);
      renderMotorDiagnosticSummary(
        content,
        deps.getSnapshot()?.progress.measurements ?? createEmptyMeasurementSummaryV2(),
      );
    },
    destroy(): void {
      releaseTopLayer();
      analysis.destroy();
    },
  };
}
