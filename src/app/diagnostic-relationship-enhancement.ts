import type {
  DiagnosticModel,
} from "../diagnostics/types.js";
import {
  buildDiagnosticNetworkPaths,
  buildDiagnosticRelationshipPaths,
  DIAGNOSTIC_RELATIONSHIP_VIEWBOX,
  type DiagnosticRelationshipKind,
  type DiagnosticRelationshipPath,
  type DiagnosticRelationshipRow,
} from "./diagnostic-relationship-layout.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function activeKind(host: HTMLElement): DiagnosticRelationshipKind | null {
  const tab = host.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.dataset.tab;
  if (tab === "transition" || tab === "confusion") return tab;
  return null;
}

function networkOverlayEnabled(host: HTMLElement): boolean {
  return host.querySelector<HTMLInputElement>('[data-action="toggle-network"]')?.checked ?? false;
}

const NETWORK_MARKER_ID = "diagnostic-arrow-network";

function networkPathMarkup(path: DiagnosticRelationshipPath): string {
  return `<path class="diagnostic-relationship-path network${path.includesTone ? " tone" : ""}" d="${path.path}" style="--relation-width:${path.width};--relation-opacity:${path.opacity};--relation-severity:${path.severity}" marker-end="url(#${NETWORK_MARKER_ID})"></path>`;
}

function renderNetworkOverlay(board: HTMLElement, model: DiagnosticModel): void {
  const paths = buildDiagnosticNetworkPaths(model);
  if (paths.length === 0) return;
  const viewBox = DIAGNOSTIC_RELATIONSHIP_VIEWBOX;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("diagnostic-relationship-svg", "network");
  svg.setAttribute("viewBox", `${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = `<defs><marker id="${NETWORK_MARKER_ID}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto" markerUnits="strokeWidth"><path class="diagnostic-relationship-arrow" d="M 0 0 L 8 4 L 0 8 z"></path></marker></defs>${paths.map(networkPathMarkup).join("")}`;
  board.prepend(svg);
}

function visibleRelationshipRows(
  kind: DiagnosticRelationshipKind,
  model: DiagnosticModel,
  buttons: readonly HTMLButtonElement[],
): readonly DiagnosticRelationshipRow[] {
  const rows: readonly DiagnosticRelationshipRow[] = kind === "transition"
    ? model.transitions
    : model.confusions;
  const rowsById = new Map(rows.map((row) => [row.id, row] as const));
  return buttons.flatMap((button) => {
    const id = button.dataset.id;
    if (id === undefined) return [];
    const row = rowsById.get(id);
    return row === undefined ? [] : [row];
  });
}

function renderRelationshipOverlay(
  host: HTMLElement,
  getModel: () => DiagnosticModel,
): void {
  host.querySelector(".diagnostic-relationship-svg")?.remove();
  const board = host.querySelector<HTMLElement>(".diagnostic-keyboard-board");
  if (board === null) return;
  if (networkOverlayEnabled(host)) {
    renderNetworkOverlay(board, getModel());
    return;
  }
  const kind = activeKind(host);
  if (kind === null) return;
  const buttons = [...host.querySelectorAll<HTMLButtonElement>(
    '.diagnostic-inspector-list button[data-action="select-relation"][data-id]',
  )];
  const rows = visibleRelationshipRows(kind, getModel(), buttons);
  if (rows.length === 0) return;
  const selectedId = buttons.find((button) => button.classList.contains("selected"))?.dataset.id ?? null;
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

export function mountDiagnosticRelationshipEnhancement(
  getModel: () => DiagnosticModel,
): () => void {
  const host = document.querySelector<HTMLElement>("#diagnostic-analysis");
  if (host === null) return () => undefined;
  let scheduled = false;
  let observer: MutationObserver;
  const observe = (): void => {
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["hidden"],
    });
  };
  const schedule = (): void => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      observer.disconnect();
      renderRelationshipOverlay(host, getModel);
      observe();
    });
  };
  observer = new MutationObserver(schedule);
  observe();
  schedule();
  return () => observer.disconnect();
}
