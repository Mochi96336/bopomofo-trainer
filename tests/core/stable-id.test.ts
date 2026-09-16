import { describe, expect, it } from "vitest";
import { stableRuntimeDigest } from "../../src/core/stable-id.js";

function legacyCanonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(legacyCanonicalValue);
  if (value !== null && typeof value === "object") {
    const source = value as Readonly<Record<string, unknown>>;
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      const item = source[key];
      if (item !== undefined) result[key] = legacyCanonicalValue(item);
    }
    return result;
  }
  return value;
}

function legacyHash32(source: string, seed: number): string {
  let hash = (0x811c9dc5 ^ seed) >>> 0;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function legacyStableRuntimeDigest(value: unknown): string {
  const source = JSON.stringify(legacyCanonicalValue(value));
  return [
    0x243f6a88,
    0x85a308d3,
    0x13198a2e,
    0x03707344,
    0xa4093822,
    0x299f31d0,
    0x082efa98,
    0xec4e6c89,
  ].map((seed) => legacyHash32(source, seed)).join("");
}

describe("browser-safe runtime identities", () => {
  it("is canonical, deterministic, and sensitive to content", () => {
    const first = stableRuntimeDigest({ text: "句子", nested: { b: 2, a: 1 } });
    const reordered = stableRuntimeDigest({ nested: { a: 1, b: 2 }, text: "句子" });
    expect(first).toBe(reordered);
    expect(first).toMatch(/^[0-9a-f]{64}$/u);
    expect(stableRuntimeDigest({ text: "別的句子" })).not.toBe(first);
  });

  it("matches the legacy eight-pass digest byte-for-byte", () => {
    const cases: readonly unknown[] = [
      { text: "句子", nested: { b: 2, a: 1 } },
      { text: "注音ㄅㄆㄇ", values: [0, 1, -1, 3.5, true, false, null] },
      { z: undefined, a: { y: undefined, x: "保留" }, list: [undefined, "值"] },
      {
        category: "Clause",
        productionRuleId: "clause.basic",
        surfaceOrderId: "canonical",
        children: [
          { kind: "lexical-slot", id: "syntax-slot:0123456789abcdef", requiredFeatures: {} },
          { kind: "syntax-node", id: "syntax-node:fedcba9876543210", children: [] },
        ],
      },
      ["alpha", { beta: ["γ", "δ"] }, 42],
    ];

    for (const value of cases) {
      expect(stableRuntimeDigest(value)).toBe(legacyStableRuntimeDigest(value));
    }
  });
});
