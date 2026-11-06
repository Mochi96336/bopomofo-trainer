import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG } from "../../src/app/generated/catalog.js";
import { readingAuditCatalog } from "../../scripts/reading-audit-catalog.js";

describe("reading replay catalog versions", () => {
  it("verifies the complete historical catalog and profile fingerprints without changing the current catalog", () => {
    const historical = readingAuditCatalog("before-qian");
    expect(historical.PRACTICE_CATALOG).toHaveLength(13692);
    expect(historical.SYNTAX_PROFILES).toHaveLength(16061);
    const current = readingAuditCatalog("current");
    expect(current.PRACTICE_CATALOG).toBe(PRACTICE_CATALOG);
    expect(current.PRACTICE_CATALOG.length - historical.PRACTICE_CATALOG.length).toBe(1);
    expect(current.SYNTAX_PROFILES.slice(0, -1)).toEqual(historical.SYNTAX_PROFILES);
  });
  it("rejects an unknown snapshot rather than silently using the current population", () => {
    expect(() => readingAuditCatalog("unknown")).toThrow(/accepts current or before-qian/);
  });
});
