// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { TransitionDiagnostic } from "../../src/diagnostics/types.js";
import { renderDiagnosticRelationshipOverlay } from "../../src/app/diagnostic-relationship-enhancement.js";
import type {
  DiagnosticModel,
} from "../../src/diagnostics/types.js";
import type {
  DiagnosticRelationshipView,
} from "../../src/app/diagnostic-relationship-layout.js";

/**
 * The overlay driven by what the panel says it rendered.
 *
 * This could not be written while the overlay derived that from the markup: a
 * test would have had to reproduce the panel's tab attributes, its
 * `aria-pressed` toggle and its `selected` class exactly, and would then have
 * been asserting its own copy of the panel's rendering rather than the overlay.
 * Given a view model, the overlay is a function of its two arguments.
 */

const transition: TransitionDiagnostic = {
  id: "transition:zhuyin:ㄓ→zhuyin:ㄨ",
  fromTokenId: "zhuyin:ㄓ",
  toTokenId: "zhuyin:ㄨ",
  fromSymbol: "ㄓ",
  toSymbol: "ㄨ",
  fromPhysicalKey: "5",
  toPhysicalKey: "J",
  timingMs: 481,
  bestTimingMs: 332,
  timingSamples: 8,
  dataState: "sufficient",
  includesTone: false,
};

const EMPTY_MODEL: DiagnosticModel = {
  summary: { keysWithData: 0, repeatedConfusions: 0, slowerTransitions: 0 },
  keys: [],
  transitions: [],
  confusions: [],
  keyProgress: {},
};

/** The part of the analysis markup the overlay draws into and wires against. */
function buildHost(rows: readonly TransitionDiagnostic[]): HTMLElement {
  const host = document.createElement("section");
  host.innerHTML = `<div class="diagnostic-keyboard-stage">
      <div class="diagnostic-keyboard-board"></div>
    </div>
    <div class="diagnostic-inspector-list">
      ${rows.map((row) => `<button type="button" data-action="select-relation" data-id="${row.id}"></button>`).join("")}
    </div>`;
  document.body.replaceChildren(host);
  return host;
}

function view(overrides: Partial<DiagnosticRelationshipView> = {}): DiagnosticRelationshipView {
  return {
    kind: "transition",
    rows: [transition],
    selectedId: null,
    networkVisible: false,
    model: EMPTY_MODEL,
    ...overrides,
  };
}

describe("diagnostic relationship overlay", () => {
  it("draws one path per listed row", () => {
    const host = buildHost([transition]);
    renderDiagnosticRelationshipOverlay(host, view());

    const paths = host.querySelectorAll(".diagnostic-relationship-path");
    expect(paths).toHaveLength(1);
    expect(paths[0]?.getAttribute("data-relation-id")).toBe(transition.id);
  });

  it("marks the row the panel says is selected", () => {
    const host = buildHost([transition]);
    renderDiagnosticRelationshipOverlay(host, view({ selectedId: transition.id }));

    expect(host.querySelector(".diagnostic-relationship-path")?.getAttribute("aria-pressed"))
      .toBe("true");
  });

  it("activates the list row a path belongs to", () => {
    const host = buildHost([transition]);
    renderDiagnosticRelationshipOverlay(host, view());
    let clicked = 0;
    host.querySelector("button[data-action='select-relation']")
      ?.addEventListener("click", () => { clicked += 1; });

    host.querySelector<SVGPathElement>(".diagnostic-relationship-path")?.dispatchEvent(
      new MouseEvent("click", { bubbles: true }),
    );

    expect(clicked).toBe(1);
  });

  // The mesh is a view of the whole model rather than of the listed rows, and it
  // can be showing on any tab, so it is reported independently of `kind`. It is
  // never empty on an empty model either: a transition nobody has made yet is
  // still one the layout makes possible, and the mesh draws those too.
  it("draws the network instead of the list when the panel says it is showing", () => {
    const host = buildHost([transition]);
    renderDiagnosticRelationshipOverlay(host, view({ networkVisible: true }));

    expect(host.querySelector(".diagnostic-relationship-svg.network")).not.toBeNull();
    expect(host.querySelectorAll(".diagnostic-relationship-path.network").length)
      .toBeGreaterThan(0);
    // None of them is an interactive row path: the mesh is not the list.
    expect(host.querySelector("[data-relation-id]")).toBeNull();
  });

  it("draws nothing on a tab that has no relationship list", () => {
    const host = buildHost([]);
    renderDiagnosticRelationshipOverlay(host, view({ kind: null, rows: [] }));

    expect(host.querySelector(".diagnostic-relationship-svg")).toBeNull();
  });

  it("replaces the previous drawing rather than stacking a second one", () => {
    const host = buildHost([transition]);
    renderDiagnosticRelationshipOverlay(host, view());
    renderDiagnosticRelationshipOverlay(host, view());

    expect(host.querySelectorAll(".diagnostic-relationship-svg")).toHaveLength(1);
  });
});
