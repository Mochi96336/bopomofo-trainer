import type {
  DiagnosticModel,
} from "../diagnostics/types.js";
import {
  buildDiagnosticNetworkPaths,
  buildDiagnosticRelationshipPaths,
  DIAGNOSTIC_RELATIONSHIP_VIEWBOX,
  type DiagnosticRelationshipPath,
  type DiagnosticRelationshipView,
} from "./diagnostic-relationship-layout.js";
import { escapeHtml } from "./html.js";

/**
 * Draws the relationship graph over the keyboard the analysis just rendered.
 *
 * What is on screen arrives as a view model from the panel that rendered it.
 * This module used to work the same facts out by reading that markup back --
 * the selected tab, the network toggle's `aria-pressed`, the `selected` class
 * on a list button, the `data-id` on each -- and to guess when to redraw with a
 * subtree `MutationObserver` that had to be disconnected around its own writes.
 * None of that is here any more.
 *
 * The DOM lookup that remains is of a different kind: the list buttons are
 * found in order to wire hover and activation between each path and its row.
 * That is connecting two rendered things, not recovering state from one.
 */

// Zhuyin composition has one fixed order, so a direction arrow adds nothing
// here; the network is a heat-map of severity, not a set of instructions.
function networkPathMarkup(path: DiagnosticRelationshipPath): string {
  const classes = ["diagnostic-relationship-path", "network", path.includesTone ? "tone" : "", path.potential ? "potential" : ""]
    .filter(Boolean).join(" ");
  const title = path.potential ? "" : `<title>${escapeHtml(path.label)}</title>`;
  return `<path class="${classes}" d="${path.path}" style="--relation-width:${path.width};--relation-opacity:${path.opacity};--relation-severity:${path.severity}">${title}</path>`;
}

function renderNetworkEmptyState(stage: HTMLElement): void {
  const empty = document.createElement("p");
  empty.className = "diagnostic-network-empty";
  // The overlay draws transitions, not keys, so an empty mesh means there is no
  // transition to draw — measured or structurally possible.
  empty.textContent = "全網已開啟，但目前沒有可標示的轉換。";
  stage.append(empty);
}

function renderNetworkOverlay(stage: HTMLElement, board: HTMLElement, model: DiagnosticModel): void {
  const paths = buildDiagnosticNetworkPaths(model);
  if (paths.length === 0) {
    renderNetworkEmptyState(stage);
    return;
  }
  const viewBox = DIAGNOSTIC_RELATIONSHIP_VIEWBOX;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("diagnostic-relationship-svg", "network");
  svg.setAttribute("viewBox", `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = paths.map(networkPathMarkup).join("");
  board.prepend(svg);
}

export function renderDiagnosticRelationshipOverlay(
  host: HTMLElement,
  view: DiagnosticRelationshipView,
): void {
  host.querySelector(".diagnostic-relationship-svg")?.remove();
  host.querySelector(".diagnostic-network-empty")?.remove();
  const stage = host.querySelector<HTMLElement>(".diagnostic-keyboard-stage");
  const board = host.querySelector<HTMLElement>(".diagnostic-keyboard-board");
  if (stage === null || board === null) return;
  if (view.networkVisible) {
    renderNetworkOverlay(stage, board, view.model);
    return;
  }
  const { kind, rows, selectedId } = view;
  if (kind === null || rows.length === 0) return;
  const buttons = [...host.querySelectorAll<HTMLButtonElement>(
    '.diagnostic-inspector-list button[data-action="select-relation"][data-id]',
  )];
  const paths = buildDiagnosticRelationshipPaths(kind, rows, selectedId);
  const markerId = `diagnostic-arrow-${kind}`;
  const viewBox = DIAGNOSTIC_RELATIONSHIP_VIEWBOX;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("diagnostic-relationship-svg", kind);
  svg.setAttribute("viewBox", `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-label", kind === "transition" ? "轉換關係" : "誤按關係");
  svg.innerHTML = `<defs><marker id="${markerId}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto" markerUnits="strokeWidth"><path class="diagnostic-relationship-arrow" d="M 0 0 L 8 4 L 0 8 z"></path></marker></defs>${paths.map((path) => `<path class="diagnostic-relationship-path${path.selected ? " selected" : ""}${path.includesTone ? " tone" : ""}" d="${path.path}" style="--relation-width:${path.width};--relation-opacity:${path.opacity}" marker-end="url(#${markerId})" tabindex="0" role="button" data-relation-id="${escapeHtml(path.id)}" aria-pressed="${path.selected}" aria-label="${escapeHtml(path.label)}"><title>${escapeHtml(path.label)}</title></path>`).join("")}`;

  for (const path of svg.querySelectorAll<SVGPathElement>(".diagnostic-relationship-path")) {
    const id = path.dataset.relationId;
    if (id === undefined) continue;
    const button = buttons.find((candidate) => candidate.dataset.id === id);
    if (button === undefined) continue;
    const activate = (): void => button.click();
    path.addEventListener("click", activate);
    path.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      activate();
    });
    path.addEventListener("pointerenter", () => button.classList.add("graph-hover"));
    path.addEventListener("pointerleave", () => button.classList.remove("graph-hover"));
    button.addEventListener("pointerenter", () => path.classList.add("list-hover"));
    button.addEventListener("pointerleave", () => path.classList.remove("list-hover"));
    button.addEventListener("focus", () => path.classList.add("list-hover"));
    button.addEventListener("blur", () => path.classList.remove("list-hover"));
  }
  board.prepend(svg);
}
