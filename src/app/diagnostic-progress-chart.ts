import type { KeyProgressSeries, KeyProgressTrends } from "../diagnostics/types.js";
import { milliseconds, percent } from "./diagnostic-format.js";
import { escapeHtml } from "./html.js";

// The viewBox scales uniformly (no `preserveAspectRatio="none"`), so the point
// markers stay circular at every pane width instead of being squashed into
// ellipses, and the horizontal padding keeps the emphasized newest point fully
// inside the frame.
const PROGRESS_CHART = {
  /** Left gutter reserved for the axis bound labels. */
  gutter: 40,
  plotWidth: 230,
  height: 56,
  padX: 9,
  padY: 9,
  tick: 3,
} as const;

function progressValueText(series: KeyProgressSeries, value: number): string {
  return series.unit === "percent" ? percent(value) : milliseconds(value);
}

// The axis bounds are drawn on the chart itself rather than described beside
// it, so the scale is read where it is used. They matter because the domain is
// adaptive: without them a bounded 8%-to-7% fall and a real collapse would look
// alike.
function progressBoundText(series: KeyProgressSeries, value: number): string {
  return series.unit === "percent" ? percent(value) : `${Math.round(value)} ms`;
}

// The delta line is the two comparison windows' representative values, not the
// first and last raw points: a single outlying bucket at either end must not be
// what the learner reads as the change.
function progressDeltaText(series: KeyProgressSeries): string {
  const { previousValue, recentValue } = series.trend;
  if (previousValue !== null && recentValue !== null) {
    return `${progressValueText(series, previousValue)} → ${progressValueText(series, recentValue)}`;
  }
  return series.latestValue === null ? "—" : progressValueText(series, series.latestValue);
}

function progressPartialText(series: KeyProgressSeries): string {
  if (series.partialSampleCount === 0) return "";
  return `下一次更新：${series.partialSampleCount} / ${series.bucketSize} 筆`;
}

/**
 * A small inline chart. Points are positioned inside the domain the diagnostics
 * projection already chose, which carries a minimum span, so a one-point
 * difference cannot be drawn as a cliff. There is no extrapolated segment past
 * the newest point.
 */
function progressChartMarkup(series: KeyProgressSeries): string {
  const { gutter, plotWidth, height, padX, padY, tick } = PROGRESS_CHART;
  const { minimum, maximum } = series.chartDomain;
  const span = maximum - minimum || 1;
  const width = gutter + plotWidth;
  const left = gutter + padX;
  const right = width - padX;
  const innerWidth = right - left;
  const innerHeight = height - padY * 2;
  const yFor = (value: number): number =>
    padY + innerHeight - ((value - minimum) / span) * innerHeight;

  const step = series.points.length > 1 ? innerWidth / (series.points.length - 1) : 0;
  const placed = series.points.map((point) => ({
    point,
    x: series.points.length > 1 ? left + step * point.index : left + innerWidth / 2,
    y: yFor(point.value),
  }));
  const path = placed
    .map((entry, index) => `${index === 0 ? "M" : "L"}${entry.x.toFixed(1)},${entry.y.toFixed(1)}`)
    .join(" ");

  // Upper and lower bound of the adaptive domain, labelled where they sit.
  const bounds = [maximum, minimum].map((value) => {
    const y = yFor(value).toFixed(1);
    return `<line class="diagnostic-progress-axis-tick" x1="${gutter - tick}" x2="${gutter}" y1="${y}" y2="${y}"></line>`
      + `<text class="diagnostic-progress-axis-label" x="${gutter - tick - 3}" y="${y}" text-anchor="end" dominant-baseline="middle">${escapeHtml(progressBoundText(series, value))}</text>`;
  }).join("");

  const referenceY = series.trend.previousValue === null
    ? null
    : yFor(series.trend.previousValue).toFixed(1);
  const reference = referenceY === null
    ? ""
    : `<line class="diagnostic-progress-reference" x1="${left}" x2="${right}" y1="${referenceY}" y2="${referenceY}"></line>`;

  const dots = placed.map((entry, index) => {
    const latest = index === placed.length - 1;
    const title = `第 ${entry.point.index + 1} 區段 · ${progressValueText(series, entry.point.value)} · ${entry.point.sampleCount} 樣本`;
    return `<circle class="diagnostic-progress-point${latest ? " latest" : ""}" cx="${entry.x.toFixed(1)}" cy="${entry.y.toFixed(1)}" r="${latest ? 3 : 1.9}"><title>${escapeHtml(title)}</title></circle>`;
  }).join("");

  // Hidden from assistive technology: the accessible summary below already
  // carries every value, so the axis text must not be read out as loose numbers.
  return `<svg class="diagnostic-progress-svg" viewBox="0 0 ${width} ${height}" role="presentation" focusable="false" aria-hidden="true">
    ${bounds}
    ${reference}
    ${placed.length > 1 ? `<path class="diagnostic-progress-line" d="${path}"></path>` : ""}
    ${dots}
  </svg>`;
}

function progressSeriesMarkup(series: KeyProgressSeries): string {
  const head = `<figcaption class="diagnostic-progress-head">
      <span class="diagnostic-progress-metric">${escapeHtml(series.metricLabel)}</span>
      <span class="diagnostic-progress-delta">${escapeHtml(progressDeltaText(series))}</span>
    </figcaption>`;
  const summary = `<p class="visually-hidden">${escapeHtml(series.accessibleSummary)}</p>`;

  if (series.state === "not-applicable") {
    return `<figure class="diagnostic-progress-series" data-metric="${series.metric}" data-state="not-applicable">
      <figcaption class="diagnostic-progress-head"><span class="diagnostic-progress-metric">${escapeHtml(series.metricLabel)}</span></figcaption>
      <p class="diagnostic-progress-note">不適用</p>
      ${summary}
    </figure>`;
  }
  if (series.state === "no-history") {
    const partial = progressPartialText(series);
    return `<figure class="diagnostic-progress-series" data-metric="${series.metric}" data-state="no-history">
      <figcaption class="diagnostic-progress-head"><span class="diagnostic-progress-metric">${escapeHtml(series.metricLabel)}</span></figcaption>
      <p class="diagnostic-progress-note">變化資料將從現在開始累積。</p>
      ${partial ? `<p class="diagnostic-progress-partial">${escapeHtml(partial)}</p>` : ""}
      ${summary}
    </figure>`;
  }

  const caption = series.state === "single-point"
    ? "再累積一些有效輸入後，就能比較變化。"
    : series.trend.state === "insufficient"
      ? "目前資料不足以判斷變化。"
      : series.trend.label;
  const partial = progressPartialText(series);

  return `<figure class="diagnostic-progress-series" data-metric="${series.metric}" data-state="${series.state}" data-trend="${series.trend.state}">
    ${head}
    ${progressChartMarkup(series)}
    <p class="diagnostic-progress-trend">${escapeHtml(caption)}</p>
    ${partial ? `<p class="diagnostic-progress-meta">${escapeHtml(partial)}</p>` : ""}
    ${summary}
  </figure>`;
}

/**
 * `最近變化` sits below the exact cumulative detail, never replacing it. The two
 * metrics stay on separate charts with separate values: they are different
 * observations and are never combined into one score or one axis.
 */
export function keyProgressMarkup(trends: KeyProgressTrends | undefined): string {
  if (trends === undefined) return "";
  return `<section class="diagnostic-progress">
    <h4>最近變化</h4>
    ${progressSeriesMarkup(trends.correctness)}
    ${progressSeriesMarkup(trends.timing)}
  </section>`;
}
