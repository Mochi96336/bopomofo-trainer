import "./diagnostic-modal.css";
import { buildDiagnosticModel } from "../diagnostics/build-model.js";
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
import { currentLocalProductProgress } from "./local-progress.js";
import { currentLocalProgressHistory } from "./local-progress-history.js";
import {
  createDiagnosticAnalysis,
  renderDiagnosticSummary,
  type DiagnosticAnalysisController,
} from "./diagnostic-panel.js";
import type { DiagnosticPreferenceStorage } from "./diagnostic-preferences.js";
import { mountDiagnosticRelationshipEnhancement } from "./diagnostic-relationship-enhancement.js";
import {
  currentSelectionTuning,
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

function currentDiagnosticModel() {
  const environment = environmentForTuning(currentSelectionTuning());
  const progress = currentLocalProductProgress() ?? createFreshProgressForEnvironment(
    environment,
    "diagnostic-empty",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  return buildDiagnosticModel({
    measurements: progress.measurements,
    curriculum: progress.curriculum,
    support: environment.practiceSupport,
    layout: STANDARD_BOPOMOFO_LAYOUT,
    selectionPolicy: environment.utterancePolicy,
    progressHistory: currentLocalProgressHistory(),
  });
}

/**
 * What this layer needs from the shell it enhances.
 *
 * Each of these replaces a `document.querySelector` for an element the shell
 * owns. Reaching for them by id worked, but it made the enhancement depend on
 * the shell's markup rather than on anything the shell had agreed to provide,
 * and nothing would have reported the coupling breaking.
 */
export interface DiagnosticEnhancementDependencies {
  /** Closes the information panel if it is open. */
  readonly closePanel: () => void;
  /** Returns focus to the practice surface. */
  readonly focusPractice: () => void;
  readonly storage: DiagnosticPreferenceStorage;
}

export interface DiagnosticEnhancement {
  /**
   * Called with the panel's content host every time the shell rebuilds it.
   *
   * This used to be inferred from a `MutationObserver` on that host, watching
   * childList and subtree for any change and re-deriving the whole summary from
   * it. Being told is the same signal without the guess, and without the
   * microtask guard the guess needed to avoid answering its own writes.
   */
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
  // Analysis replaces the information panel instead of nesting under it. Close
  // the source dialog and anchor focus on practice before the analysis controller
  // captures its return target, so Escape and the close button return home.
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
  // Different in kind from the observer this module used to keep on the panel:
  // that one inferred a re-render from any change to markup owned by someone
  // else, while this watches one attribute on the element wrapped right here.
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
  const analysis = createDiagnosticAnalysis({
    getModel: currentDiagnosticModel,
    storage: deps.storage,
  });
  const releaseTopLayer = mountAnalysisTopLayer(analysis.host, deps.focusPractice);
  const releaseRelationships = mountDiagnosticRelationshipEnhancement(currentDiagnosticModel);

  return {
    panelRendered(content: HTMLElement): void {
      const section = findLegacyWeakSection(content);
      if (section === null) return;
      renderDiagnosticSummary(
        section,
        currentDiagnosticModel(),
        () => openAnalysisFromPractice(analysis, deps),
      );
    },
    destroy(): void {
      releaseRelationships();
      releaseTopLayer();
      analysis.destroy();
    },
  };
}
