import { describe, expect, it } from "vitest";
import {
  commonnessDotsMarkup,
  commonnessTierLabel,
} from "../../src/app/commonness-display.js";

function litCount(markup: string): number {
  return markup.match(/commonness-dot lit/gu)?.length ?? 0;
}

describe("commonness display", () => {
  it("lights one mark per level, fewest for the most common", () => {
    expect(litCount(commonnessDotsMarkup(1))).toBe(1);
    expect(litCount(commonnessDotsMarkup(2))).toBe(2);
    expect(litCount(commonnessDotsMarkup(3))).toBe(3);
    expect(litCount(commonnessDotsMarkup(4))).toBe(4);
  });

  it("keeps four marks at every level so the reading holds its width", () => {
    for (const tier of [1, 2, 3, 4] as const) {
      expect(commonnessDotsMarkup(tier).match(/commonness-dot/gu)).toHaveLength(4);
    }
  });

  // On screen the marks carry the level; the spoken label is the only place
  // that can say more or less than what, so it keeps the share.
  it("names both the level and its share of the catalog", () => {
    expect(commonnessTierLabel(1)).toBe("等級 最常用 · 前 10%");
    expect(commonnessTierLabel(4)).toBe("等級 少見 · 後 50%");
  });
});
