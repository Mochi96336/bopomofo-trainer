import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../src/app/html.js";

describe("html escaping", () => {
  it("escapes every character that could close or open a tag or attribute", () => {
    expect(escapeHtml("&<>\"'")).toBe("&amp;&lt;&gt;&quot;&#39;");
  });

  // The ampersand has to be rewritten before it can be re-read as the start of
  // an entity the source never contained.
  it("does not double-escape an ampersand it just produced", () => {
    expect(escapeHtml("<")).toBe("&lt;");
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves text without markup characters untouched", () => {
    expect(escapeHtml("ㄅ → ㄆ · 12 樣本")).toBe("ㄅ → ㄆ · 12 樣本");
    expect(escapeHtml("")).toBe("");
  });

  it("escapes every occurrence, not only the first", () => {
    expect(escapeHtml("<<>>")).toBe("&lt;&lt;&gt;&gt;");
  });

  // A learner-supplied string reaching a template is the case this exists for:
  // an imported backup carries values the app did not author.
  it("neutralizes an embedded script tag", () => {
    const escaped = escapeHtml('<script>alert("x")</script>');
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });
});
