import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("top-level source entrypoint boundaries", () => {
  it("keeps the default root on current product/runtime modules", () => {
    const source = readFileSync("src/index.ts", "utf8");

    for (const retiredPath of [
      '"./measurement/',
      '"./relations/',
      '"./simulation/',
      '"./composition/',
      '"./integration/relational-research.js"',
      '"./curriculum/legacy-frequency-first-utterance.js"',
      '"./curriculum/policy.js"',
      '"./curriculum/state.js"',
      '"./curriculum/focus.js"',
      '"./curriculum/simulator.js"',
    ]) {
      expect(source).not.toContain(retiredPath);
    }

    expect(source).toContain('"./measurement-v2/types.js"');
    expect(source).toContain('"./progress-history/types.js"');
    expect(source).toContain('"./curriculum/frequency-first-utterance.js"');
    expect(source).toContain('"./product/session.js"');
  });

  it("keeps build/review tooling explicit instead of mixing it into product root", () => {
    const source = readFileSync("src/tooling.ts", "utf8");
    expect(source).toContain('"./catalog/compile-catalog.js"');
    expect(source).toContain('"./syntax/profile-projection.js"');
    expect(source).toContain('"./reference/compile-reference.js"');
    expect(source).not.toContain('"./simulation/');
    expect(source).not.toContain('"./measurement/');
  });

  it("keeps archived research reachable only through the explicit research surface", () => {
    const source = readFileSync("src/research.ts", "utf8");
    expect(source).toContain('"./measurement/types.js"');
    expect(source).toContain('"./relations/catalog-report.js"');
    expect(source).toContain('"./curriculum/legacy-frequency-first-utterance.js"');
    expect(source).toContain('"./simulation/strategy-matrix.js"');
    expect(source).toContain('"./integration/relational-research.js"');
  });

  it("keeps the browser product away from the research entrypoint", () => {
    const browser = readFileSync("src/app/browser.ts", "utf8");
    const session = readFileSync("src/product/session.ts", "utf8");
    expect(browser).not.toContain("research.js");
    expect(session).not.toContain("research.js");
    expect(session).not.toContain("legacy-frequency-first-utterance");
  });
});
