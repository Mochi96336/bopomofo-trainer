// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_PROGRESS_KEY } from "../../src/app/persistence-transaction.js";
import { PRODUCT_PROGRESS_SCHEMA_VERSION, type ProductProgress } from "../../src/product/types.js";
import { legacyProgressDraft } from "../product/legacy-progress-fixture.js";
import {
  createMemoryStorage,
  mountApp,
  type MountedApp,
} from "./app-harness.js";

let mounted: MountedApp | null = null;

afterEach(() => {
  mounted?.destroy();
  mounted = null;
});

function freshStoredProgress(): string {
  const storage = createMemoryStorage();
  const first = mountApp({ storage });
  const source = storage.getItem(LOCAL_PROGRESS_KEY);
  first.destroy();
  if (source === null) throw new Error("fresh app did not persist progress");
  return source;
}

describe("progress load notices", () => {
  it("announces schema 7 format migration without claiming measurements were deleted", () => {
    const current = JSON.parse(freshStoredProgress()) as ProductProgress;
    const storage = createMemoryStorage({
      [LOCAL_PROGRESS_KEY]: JSON.stringify(legacyProgressDraft(current, 7)),
    });

    mounted = mountApp({ storage });
    const notice = mounted.find("#notice-region").textContent ?? "";
    expect(notice).toContain("舊版進度已更新到目前格式");
    expect(notice).toContain("本機進度與量測已保留");
    expect(notice).not.toContain("舊量測證據已刪除");
    expect(notice).not.toContain("無效的本機進度");

    const persisted = storage.getItem(LOCAL_PROGRESS_KEY);
    if (persisted === null) throw new Error("migrated progress was not written back");
    expect((JSON.parse(persisted) as Record<string, unknown>).schemaVersion).toBe(PRODUCT_PROGRESS_SCHEMA_VERSION);
  });

  it("announces schema 6 measurement reset and writes schema 8 immediately", () => {
    const current = JSON.parse(freshStoredProgress()) as ProductProgress;
    const legacy = legacyProgressDraft(current, 6);
    legacy.measurements = { policyVersion: "phase-3-v2", legacy: true };
    const storage = createMemoryStorage({
      [LOCAL_PROGRESS_KEY]: JSON.stringify(legacy),
    });

    mounted = mountApp({ storage });
    const notice = mounted.find("#notice-region").textContent ?? "";
    expect(notice).toContain("舊版量測已切換到新的輸入模型");
    expect(notice).toContain("舊量測證據已刪除");
    expect(notice).toContain("其他可相容的本機進度已保留");
    expect(notice).not.toContain("無效的本機進度");

    const persisted = storage.getItem(LOCAL_PROGRESS_KEY);
    if (persisted === null) throw new Error("reset progress was not written back");
    expect((JSON.parse(persisted) as Record<string, unknown>).schemaVersion).toBe(PRODUCT_PROGRESS_SCHEMA_VERSION);
  });

  it("announces a fresh reset for invalid progress without claiming compatible progress was preserved", () => {
    const storage = createMemoryStorage({
      [LOCAL_PROGRESS_KEY]: "{ broken",
    });

    mounted = mountApp({ storage });
    const notice = mounted.find("#notice-region").textContent ?? "";
    expect(notice).toContain("無效的本機進度已刪除");
    expect(notice).toContain("重新建立新的練習進度");
    expect(notice).not.toContain("其他可相容的本機進度已保留");
  });
});
