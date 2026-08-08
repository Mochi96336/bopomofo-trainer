// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_PROGRESS_KEY } from "../../src/app/persistence-transaction.js";
import { PRODUCT_PROGRESS_SCHEMA_VERSION } from "../../src/product/types.js";
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
  it("announces a successful measurement-epoch migration without calling the progress invalid", () => {
    const stored = JSON.parse(freshStoredProgress()) as Record<string, unknown>;
    stored.schemaVersion = PRODUCT_PROGRESS_SCHEMA_VERSION - 1;
    delete stored.measurementEpoch;
    const storage = createMemoryStorage({
      [LOCAL_PROGRESS_KEY]: JSON.stringify(stored),
    });

    mounted = mountApp({ storage });
    const notice = mounted.find("#notice-region").textContent ?? "";
    expect(notice).toContain("舊版量測已切換到新的輸入模型");
    expect(notice).toContain("其他可相容的本機進度已保留");
    expect(notice).not.toContain("無效的本機進度");
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
