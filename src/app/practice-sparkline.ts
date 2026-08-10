import type { PilotRoundRecord } from "../product/pilot-history.js";
import { escapeHtml } from "./html.js";

/**
 * The small trend charts in the practice panel's recent history. They describe
 * completed rounds only: there is no projection past the newest point and no
 * combined score across the two metrics, which are different observations.
 */

const SPARKLINE = {
  width: 168,
  height: 40,
  pad: 4,
} as const;

/**
 * Keep enough vertical context that tiny changes do not consume the full chart
 * height. The observed range still drives meaningful changes, but every series
 * gets modest headroom plus a minimum span relative to its own magnitude. This
 * keeps a 1 ms wobble near 200 ms visibly small while preserving large moves.
 */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
  pad: number,
): readonly { readonly x: number; readonly y: number }[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const midpoint = (min + max) / 2;
  const observedSpan = max - min;
  const minimumSpan = Math.max(1, Math.abs(midpoint) * 0.18);
  const span = Math.max(observedSpan, minimumSpan) * 1.2;
  const domainMin = midpoint - span / 2;
  const innerWidth = width - pad * 2;
  const innerHeight = height - pad * 2;
  const step = values.length > 1 ? innerWidth / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: pad + step * index,
    y: pad + innerHeight - ((value - domainMin) / span) * innerHeight,
  }));
}

/** A single point is not a trend, so fewer than two values renders the empty state. */
export function renderSparkline(
  label: string,
  values: readonly number[],
  formatValue: (value: number) => string,
): string {
  const { width, height, pad } = SPARKLINE;
  if (values.length < 2) {
    return `<div class="trend-chart">
      <div class="trend-chart-heading"><span class="trend-label">${escapeHtml(label)}</span></div>
      <div class="trend-empty">還沒有足夠資料</div>
    </div>`;
  }
  const points = sparklinePoints(values, width, height, pad);
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const last = points.at(-1)!;
  return `<div class="trend-chart">
    <div class="trend-chart-heading">
      <span class="trend-label">${escapeHtml(label)}</span>
      <span class="trend-value">${escapeHtml(formatValue(values.at(-1)!))}</span>
    </div>
    <svg class="trend-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}" class="trend-baseline"></line>
      <path d="${path}" class="trend-line"></path>
      <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5" class="trend-dot"></circle>
    </svg>
  </div>`;
}

/**
 * Rounds with no attempts are dropped before anything is derived, so an
 * abandoned round cannot divide by zero or flatten the accuracy series. Latency
 * keeps its own filter: a round can be answered without ever producing a clean
 * timing sample, and those rounds must not be read as zero milliseconds.
 */
export function renderTrendSection(records: readonly PilotRoundRecord[]): string {
  const answered = records.filter((record) => record.attempts > 0);
  const accuracyValues = answered.map(
    (record) => ((record.attempts - record.errors) / record.attempts) * 100,
  );
  const latencyValues = answered
    .map((record) => record.cleanLatencyMedianMs)
    .filter((value): value is number => value !== null);
  return `<div class="trend-row">
    ${renderSparkline("正確率", accuracyValues, (value) => `${Math.round(value)}%`)}
    ${renderSparkline("反應時間", latencyValues, (value) => `${Math.round(value)} ms`)}
  </div>`;
}
