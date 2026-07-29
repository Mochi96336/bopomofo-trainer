import { describe, expect, it } from "vitest";
import { shouldCloseNetworkOverview } from "../../src/app/diagnostic-relationship-enhancement.js";

describe("diagnostic relationship enhancement", () => {
  it("closes the transition overview when confusion becomes active", () => {
    expect(shouldCloseNetworkOverview("confusion", true)).toBe(true);
  });

  it("leaves the overview state alone in other views or when already closed", () => {
    expect(shouldCloseNetworkOverview("transition", true)).toBe(false);
    expect(shouldCloseNetworkOverview("confusion", false)).toBe(false);
    expect(shouldCloseNetworkOverview(null, true)).toBe(false);
  });
});
