import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product and research CI boundary", () => {
  it("keeps archived simulation out of the ordinary local PR gate", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["check:pr"]).toContain("npm run test:fast");
    expect(packageJson.scripts["check:pr"]).not.toContain("test:simulation");
    expect(packageJson.scripts["test:simulation"]).toContain("tests/simulation");
  });

  it("keeps full Vitest coverage inside the explicit research gate", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["check:research"]).toContain("npm test");
    expect(packageJson.scripts["check:research"]).toContain("integration:research");
    expect(packageJson.scripts["check:research"]).toContain("experiment:relational");
  });

  it("keeps GitHub ordinary check free of a simulation step", () => {
    const workflow = readFileSync(".github/workflows/check.yml", "utf8");
    expect(workflow).not.toContain("- name: Simulation tests");
    expect(workflow).not.toContain("npm run test:simulation");
    expect(workflow).toContain("github.event_name == 'workflow_dispatch' && inputs.run_research");
    expect(workflow).toContain("npm run check:research");
  });
});
