import { describe, expect, it } from "vitest";
import {
  clearLocalProductProgress,
  loadLocalProductProgress,
  LOCAL_PROGRESS_KEY,
  saveLocalProductProgress,
  type StorageLike,
} from "../../src/app/local-progress.js";
import { serializeProductProgress } from "../../src/product/progress.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../../src/product/session.js";
import { PRODUCT_CATALOGS } from "./fixtures.js";
import { legacyProgressDraft } from "./legacy-progress-fixture.js";

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const environment = createProductEnvironment(PRODUCT_CATALOGS);

function persistedDraft(seed = "seed"): Record<string, unknown> {
  const progress = createFreshProgressForEnvironment(
    environment,
    seed,
    "guided",
    "standard",
  );
  return JSON.parse(serializeProductProgress(progress)) as Record<string, unknown>;
}

describe("local progress adapter", () => {
  it("reports an empty store explicitly", () => {
    expect(loadLocalProductProgress(new MemoryStorage(), environment, "guided", "standard"))
      .toEqual({ progress: null, status: "empty" });
  });

  it("saves, restores, exposes, and clears canonical progress", () => {
    const storage = new MemoryStorage();
    const progress = createFreshProgressForEnvironment(
      environment,
      "seed",
      "guided",
      "standard",
    );
    saveLocalProductProgress(storage, progress);
    expect(loadLocalProductProgress(storage, environment, "guided", "standard")).toEqual({
      progress,
      status: "loaded",
    });
    clearLocalProductProgress(storage);
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).toBeNull();
  });

  it("labels schema 7 structural migration without resetting measurements", () => {
    const storage = new MemoryStorage();
    const current = JSON.parse(JSON.stringify(
      createFreshProgressForEnvironment(environment, "legacy-seed", "guided", "standard"),
    ));
    const stored = legacyProgressDraft(current, 7);
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(stored));

    const result = loadLocalProductProgress(storage, environment, "guided", "standard");
    expect(result.status).toBe("migrated");
    expect(result.progress?.seed).toBe("legacy-seed");
    expect(result.progress?.measurements).toEqual(current.measurements);
  });

  it("labels schema 6 migration as a measurement reset", () => {
    const storage = new MemoryStorage();
    const current = createFreshProgressForEnvironment(
      environment,
      "legacy-measurement-seed",
      "guided",
      "standard",
    );
    const stored = legacyProgressDraft(current, 6);
    stored.measurements = { policyVersion: "phase-3-v2", legacy: true };
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(stored));

    const result = loadLocalProductProgress(storage, environment, "guided", "standard");
    expect(result.status).toBe("measurement-reset");
    expect(result.progress?.seed).toBe("legacy-measurement-seed");
    expect(result.progress?.measurements.semantic.bindings).toEqual({});
  });

  it("rejects an unsupported stored generation as invalid", () => {
    const storage = new MemoryStorage();
    const stored = persistedDraft();
    stored.schemaVersion = 5;
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(stored));

    expect(loadLocalProductProgress(storage, environment, "guided", "standard")).toEqual({
      progress: null,
      status: "invalid",
    });
  });

  it("rejects summaries that reference unknown entries", () => {
    const storage = new MemoryStorage();
    const stored = persistedDraft();
    stored.recentSummaries = [{
      kind: "practice",
      exerciseId: "practice-1",
      completedAt: "2026-07-20T00:00:00.000Z",
      entryIds: ["unknown"],
      utteranceId: "utterance:unknown",
      templateId: null,
      focusTokenId: null,
      focusEvidence: null,
      attempts: 1,
      errors: 0,
      timingSamples: 0,
    }];
    storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(stored));
    expect(loadLocalProductProgress(storage, environment, "guided", "standard")).toEqual({
      progress: null,
      status: "invalid",
    });
  });

  it("reports malformed stored state as invalid without partially loading it", () => {
    const storage = new MemoryStorage();
    storage.setItem(LOCAL_PROGRESS_KEY, "{broken");
    expect(loadLocalProductProgress(storage, environment, "guided", "standard")).toEqual({
      progress: null,
      status: "invalid",
    });
  });
});
