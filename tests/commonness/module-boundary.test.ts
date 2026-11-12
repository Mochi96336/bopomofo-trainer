import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("commonness module boundaries", () => {
  it("keeps NAER-specific imports out of curriculum", async () => {
    const source = (await Promise.all([
      "frequency-first-utterance.ts", "selection-scoring.ts", "lexical-selection.ts",
    ].map(name => readFile(new URL(`../../src/curriculum/${name}`, import.meta.url), "utf8")))).join("\n");
    expect(source).not.toContain("naer-general-frequency");
    expect(source).toContain("commonness/catalog-projection");
  });
});
