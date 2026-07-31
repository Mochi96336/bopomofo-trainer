import { describe, expect, it } from "vitest";
import {
  boost,
  detailStateMarkup,
  milliseconds,
  percent,
  stateBadgeMarkup,
} from "../../src/app/diagnostic-format.js";

describe("diagnostic value formatting", () => {
  it("writes a ratio as a whole-number percentage", () => {
    expect(percent(0)).toBe("0%");
    expect(percent(0.125)).toBe("13%");
    expect(percent(1)).toBe("100%");
  });

  it("writes a duration as whole milliseconds", () => {
    expect(milliseconds(0)).toBe("0 ms");
    expect(milliseconds(183.4)).toBe("183 ms");
    expect(milliseconds(183.5)).toBe("184 ms");
  });

  // A boost keeps two decimals because the differences that matter here are
  // smaller than the rounding a whole number would apply.
  it("writes a boost as a multiplier with two decimals", () => {
    expect(boost(1)).toBe("1.00×");
    expect(boost(1.234)).toBe("1.23×");
  });
});

describe("diagnostic data-state markup", () => {
  // Sufficient is the ordinary case; labelling it would spend the learner's
  // attention on the absence of a problem.
  it("renders nothing when the state is sufficient", () => {
    expect(stateBadgeMarkup("sufficient")).toBe("");
    expect(detailStateMarkup("sufficient")).toBe("");
  });

  it("labels a shortfall and carries the state as a class", () => {
    const badge = stateBadgeMarkup("insufficient");
    expect(badge).toContain('class="diagnostic-state insufficient"');
    expect(badge.length).toBeGreaterThan(0);

    const detail = detailStateMarkup("preliminary");
    expect(detail).toContain('class="diagnostic-detail-state preliminary"');
  });

  it("uses distinct elements so the list badge and the detail can be styled apart", () => {
    expect(stateBadgeMarkup("preliminary").startsWith("<span")).toBe(true);
    expect(detailStateMarkup("preliminary").startsWith("<strong")).toBe(true);
  });
});
