// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  createMemoryStorage,
  mountApp,
  type MountedApp,
} from "./app-harness.js";

let mounted: MountedApp | null = null;

afterEach(() => {
  mounted?.destroy();
  mounted = null;
  document.body.innerHTML = "";
});

describe("Analysis V2 integration ownership", () => {
  it("hands Analysis the app-owned full practice support instead of selection settings", () => {
    mounted = mountApp({ analysisV2: true });
    const first = mounted.app.getAnalysisV2Snapshot();

    expect(Object.keys(first).sort()).toEqual([
      "practiceSupport",
      "progress",
      "progressHistory",
    ]);
    expect(Object.keys(first.practiceSupport.byToken).length).toBeGreaterThan(0);

    mounted.openPanel();
    const errorInfluence = mounted.find<HTMLInputElement>("#error-influence");
    errorInfluence.value = "200";
    errorInfluence.dispatchEvent(new Event("change", { bubbles: true }));

    const afterTuning = mounted.app.getAnalysisV2Snapshot();
    expect(afterTuning.practiceSupport).toBe(first.practiceSupport);
    expect(afterTuning.progress).toBe(first.progress);
    expect(mounted.find(".analysis-v2-summary")).toBeTruthy();
  });

  it("keeps support ownership per app instance instead of sharing integration cache state", () => {
    const first = mountApp({ analysisV2: true, storage: createMemoryStorage() });
    const firstSupport = first.app.getAnalysisV2Snapshot().practiceSupport;
    first.destroy({ keepDocument: true });

    const second = mountApp({
      analysisV2: true,
      reuseDocument: true,
      storage: createMemoryStorage(),
    });
    mounted = second;
    const secondSupport = second.app.getAnalysisV2Snapshot().practiceSupport;

    expect(secondSupport).not.toBe(firstSupport);
    second.openPanel();
    expect(second.find(".analysis-v2-summary")).toBeTruthy();
    expect(document.querySelectorAll(".analysis-v2-modal")).toHaveLength(1);
  });

  it("leaves the Analysis summary slot empty when the integration is not composed", () => {
    mounted = mountApp();
    mounted.openPanel();

    const slot = mounted.find<HTMLElement>('[data-analysis-v2-summary-slot="true"]');
    expect(slot.childElementCount).toBe(0);
    expect(slot.textContent).toBe("");
    expect(document.querySelector(".weak-bindings")).toBeNull();
  });
});
