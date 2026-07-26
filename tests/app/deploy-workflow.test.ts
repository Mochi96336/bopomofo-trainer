import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Pages deployment gate", () => {
  it("deploys the successful checked main commit instead of racing CI", () => {
    const workflow = readFileSync(".github/workflows/deploy-pages.yml", "utf8");

    expect(workflow).toContain("workflow_run:");
    expect(workflow).toContain("- check");
    expect(workflow).toContain("github.event.workflow_run.conclusion == 'success'");
    expect(workflow).toContain("github.event.workflow_run.event == 'push'");
    expect(workflow).toContain("github.event.workflow_run.head_branch == 'main'");
    expect(workflow).toContain("github.event.workflow_run.head_repository.full_name == github.repository");
    expect(workflow).toContain("github.event.workflow_run.head_sha");
  });
});
