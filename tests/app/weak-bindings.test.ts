import { describe, expect, it } from "vitest";
import type { TokenId } from "../../src/core/model.js";
import type { CurriculumBindingRecord } from "../../src/curriculum/types.js";
import {
  WEAK_BINDING_LIMIT,
  WEAK_BINDING_MIN_ATTEMPTS,
  weakBindingsMarkup,
  weakestBindings,
} from "../../src/app/weak-bindings.js";

function binding(
  symbol: string,
  attempts: number,
  errors: number,
): [string, CurriculumBindingRecord] {
  const tokenId = `zhuyin:${symbol}` as TokenId;
  return [tokenId, {
    scope: { kind: "binding", tokenId, layoutId: "zhuyin-standard" },
    aggregate: attempts === 0 ? null : { attempts, errors, timing: null },
  } as unknown as CurriculumBindingRecord];
}

function bindings(...entries: [string, CurriculumBindingRecord][]) {
  return Object.fromEntries(entries);
}

describe("weakest bindings", () => {
  it("ranks by error rate, worst first", () => {
    const rows = weakestBindings(bindings(
      binding("ㄅ", 10, 2),
      binding("ㄆ", 10, 6),
      binding("ㄇ", 10, 4),
    ));
    expect(rows.map((row) => row.tokenId)).toEqual(["zhuyin:ㄆ", "zhuyin:ㄇ", "zhuyin:ㄅ"]);
  });

  // A rate from three attempts is one unlucky round, not a weakness.
  it("ignores bindings below the attempt gate", () => {
    const rows = weakestBindings(bindings(
      binding("ㄅ", WEAK_BINDING_MIN_ATTEMPTS - 1, 3),
      binding("ㄆ", WEAK_BINDING_MIN_ATTEMPTS, 1),
    ));
    expect(rows.map((row) => row.tokenId)).toEqual(["zhuyin:ㄆ"]);
  });

  // The list names what to work on, so a clean key is not a member of it.
  it("leaves out bindings with no errors rather than showing them at zero", () => {
    expect(weakestBindings(bindings(binding("ㄅ", 20, 0)))).toEqual([]);
  });

  it("skips bindings that have never been measured", () => {
    expect(weakestBindings(bindings(binding("ㄅ", 0, 0)))).toEqual([]);
  });

  it("breaks an equal error rate by the larger sample", () => {
    const rows = weakestBindings(bindings(
      binding("ㄅ", 10, 5),
      binding("ㄆ", 40, 20),
    ));
    expect(rows[0]?.tokenId).toBe("zhuyin:ㄆ");
  });

  it("caps the list", () => {
    const many = Array.from({ length: WEAK_BINDING_LIMIT + 4 }, (_unused, index) =>
      binding(String.fromCodePoint(0x3105 + index), 10, index + 1));
    expect(weakestBindings(bindings(...many))).toHaveLength(WEAK_BINDING_LIMIT);
  });
});

describe("weak bindings markup", () => {
  const keys = new Map<TokenId, string>([
    ["zhuyin:ㄅ" as TokenId, "Digit1"],
    ["zhuyin:ㄝ" as TokenId, "Comma"],
  ]);

  it("explains the empty state instead of rendering an empty list", () => {
    const markup = weakBindingsMarkup([], keys);
    expect(markup).toContain("history-empty");
    expect(markup).not.toContain("weak-binding-row");
  });

  // The bar is relative to the worst row, so the shape stays readable once
  // every remaining weakness is a small percentage.
  it("scales the widest bar to the worst row, not to 100%", () => {
    const markup = weakBindingsMarkup([
      { tokenId: "zhuyin:ㄅ" as TokenId, errorRate: 0.08, attempts: 50 },
      { tokenId: "zhuyin:ㄝ" as TokenId, errorRate: 0.04, attempts: 50 },
    ], keys);
    expect(markup).toContain("width:100%");
    expect(markup).toContain("width:50%");
  });

  it("keeps a near-zero bar visible", () => {
    const markup = weakBindingsMarkup([
      { tokenId: "zhuyin:ㄅ" as TokenId, errorRate: 1, attempts: 10 },
      { tokenId: "zhuyin:ㄝ" as TokenId, errorRate: 0.001, attempts: 10 },
    ], keys);
    expect(markup).toContain("width:6%");
  });

  // Regression: main.ts used to carry its own physicalKeyLabel without the
  // punctuation table, so this rendered "Comma" while the diagnostics keyboard
  // rendered "," for the same key.
  it("labels a punctuation key with its symbol", () => {
    const markup = weakBindingsMarkup(
      [{ tokenId: "zhuyin:ㄝ" as TokenId, errorRate: 0.5, attempts: 10 }],
      keys,
    );
    expect(markup).toContain(">,<");
    expect(markup).not.toContain("Comma");
  });

  it("falls back when a token has no physical key", () => {
    const markup = weakBindingsMarkup(
      [{ tokenId: "zhuyin:ㄓ" as TokenId, errorRate: 0.5, attempts: 10 }],
      keys,
    );
    expect(markup).toContain("—");
  });
});
