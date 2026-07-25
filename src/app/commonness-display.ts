import {
  COMMONNESS_TIERS,
  commonnessTierDescription,
  type CommonnessTier,
} from "../commonness/tiers.js";

/**
 * Always four marks, lit from the most common end: one lit mark is the most
 * common tenth of the catalog, four is the rarest half. The frame keeps its
 * width at every level, so the reading does not shift the header around it.
 */
export function commonnessDotsMarkup(tier: CommonnessTier): string {
  return COMMONNESS_TIERS
    .map((level) => `<span class="commonness-dot${level <= tier ? " lit" : ""}"></span>`)
    .join("");
}

export function commonnessTierLabel(tier: CommonnessTier): string {
  return `等級 ${commonnessTierDescription(tier)}`;
}
