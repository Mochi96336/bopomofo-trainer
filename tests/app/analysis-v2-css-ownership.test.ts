import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const APP_DIR = resolve(TEST_DIR, "../../src/app");

function appCss(filename: string): string {
  return readFileSync(resolve(APP_DIR, filename), "utf8");
}

function declaresCustomProperty(source: string, property: string): boolean {
  return new RegExp(`${property}\\s*:`).test(source);
}

describe("Analysis V2 CSS ownership", () => {
  it("keeps shared frame tokens owned by the space layer", () => {
    const hierarchy = appCss("analysis-v2-hierarchy.css");
    const space = appCss("analysis-v2-space.css");
    const sharedFrameTokens = [
      "--analysis-board-width",
      "--analysis-primary-stage-height",
      "--analysis-object-slot-height",
    ] as const;

    for (const token of sharedFrameTokens) {
      expect(declaresCustomProperty(hierarchy, token)).toBe(false);
      expect(declaresCustomProperty(space, token)).toBe(true);
    }
  });

  it("keeps speed-network CSS focused on component paint", () => {
    const speedNetwork = appCss("analysis-v2-speed-network.css");

    expect(speedNetwork).not.toContain("--analysis-board-width");
    expect(speedNetwork).not.toContain("perspective(");
  });

  it("keeps the refinement stack in one explicit composition manifest", () => {
    const composition = appCss("analysis-v2-composition.css");
    const imports = composition
      .split("\n")
      .filter((line) => line.startsWith("@import "));

    expect(imports).toEqual([
      '@import "./analysis-v2-layout.css";',
      '@import "./analysis-v2-space.css";',
      '@import "./analysis-v2-strategy-floor.css";',
      '@import "./analysis-v2-viewport-composition.css";',
    ]);
  });
});
