import { it } from "vitest";

it("prints the pinned BA runtime identity join for review", async () => {
  await import("../../scripts/probe-ba-runtime-occurrence-capability.js");
});
