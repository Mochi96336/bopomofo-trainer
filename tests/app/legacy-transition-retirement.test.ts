import { describe, expect, it } from "vitest";
import {
  productionDiagnosticPreferenceStorage,
} from "../../src/app/legacy-transition-retirement.js";
import { DIAGNOSTIC_PREFERENCES_KEY } from "../../src/app/diagnostic-preferences.js";

function memoryStorage(initial: string | null) {
  let value = initial;
  return {
    storage: {
      getItem(key: string) {
        return key === DIAGNOSTIC_PREFERENCES_KEY ? value : null;
      },
      setItem(key: string, next: string) {
        if (key === DIAGNOSTIC_PREFERENCES_KEY) value = next;
      },
    },
    value: () => value,
  };
}

describe("legacy transition retirement", () => {
  it("maps a saved transition tab back to key diagnostics on read and write", () => {
    const source = JSON.stringify({
      expanded: true,
      activeTab: "transition",
      keySort: "timing",
      networkOverlay: true,
    });
    const memory = memoryStorage(source);
    const storage = productionDiagnosticPreferenceStorage(memory.storage);

    expect(JSON.parse(storage.getItem(DIAGNOSTIC_PREFERENCES_KEY)!)).toMatchObject({
      activeTab: "key",
    });

    storage.setItem(DIAGNOSTIC_PREFERENCES_KEY, source);
    expect(JSON.parse(memory.value()!)).toMatchObject({ activeTab: "key" });
  });

  it("leaves semantic tab preferences unchanged", () => {
    const source = JSON.stringify({
      expanded: true,
      activeTab: "confusion",
      keySort: "error-ratio",
      networkOverlay: false,
    });
    const memory = memoryStorage(source);
    const storage = productionDiagnosticPreferenceStorage(memory.storage);
    expect(storage.getItem(DIAGNOSTIC_PREFERENCES_KEY)).toBe(source);
  });
});
