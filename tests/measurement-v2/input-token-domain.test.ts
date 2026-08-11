import { describe, expect, it } from "vitest";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";
import { ZHUYIN_TOKENS } from "../../src/scheme/tokens.js";

describe("standard Bopomofo input token domain", () => {
  it("maps the complete legal Bopomofo token vocabulary", () => {
    const mapped = [...new Set(Object.values(STANDARD_BOPOMOFO_LAYOUT.bindings))].sort();
    const vocabulary = ZHUYIN_TOKENS.map((token) => token.id).sort();

    expect(mapped).toEqual(vocabulary);
  });
});
