import { diagnosticDataStateLabel } from "../diagnostics/labels.js";
import type {
  ConfusionDiagnostic,
  KeyDiagnostic,
  KeyProgressTrends,
  TransitionDiagnostic,
} from "../diagnostics/types.js";
import {
  boost,
  detailStateMarkup,
  milliseconds,
  percent,
} from "./diagnostic-format.js";
import { keyProgressMarkup } from "./diagnostic-progress-chart.js";
import { escapeHtml } from "./html.js";

/**
 * The exact cumulative measurement for one selected key, transition, or
 * confusion. This surface must never invent precision: sample notices are
 * always shown when needed, while an exclusion breakdown appears only when the
 * supplied measurement model actually preserves those causes.
 */
function keySampleNotices(row: KeyDiagnostic): string {
  const notices: string[] = [];
  if (row.errorDataState !== "sufficient") {
    notices.push(`<div><dt>錯誤觀察</dt><dd>${escapeHtml(diagnosticDataStateLabel(row.errorDataState))}</dd></div>`);
  }
  // Timing availability and timing data state move together: the model only
  // leaves the state null when timing is not applicable, which the first branch
  // already covers. There is no third case to write copy for.
  if (row.timingAvailability === "not-applicable") {
    notices.push("<div><dt>鍵間時間</dt><dd>不適用</dd></div>");
  } else if (row.timingDataState !== null && row.timingDataState !== "sufficient") {
    notices.push(`<div><dt>鍵間時間</dt><dd>${escapeHtml(diagnosticDataStateLabel(row.timingDataState))}</dd></div>`);
  }
  if (notices.length === 0) return "";
  return `<section><h4>樣本提示</h4><dl class="diagnostic-detail-lines">${notices.join("")}</dl></section>`;
}

function keyTimingCaption(row: KeyDiagnostic): string {
  if (row.timingAvailability === "not-applicable") return "不適用";
  if (row.timingDataState === "insufficient" || row.timingDataState === null) return "資料不足";
  if (row.timingDataState === "preliminary") return "初步";
  return `${row.timingSamples} 樣本`;
}

function keyTimingExclusionsMarkup(row: KeyDiagnostic): string {
  const excluded = row.excludedSamples;
  if (excluded === null) return "";
  return `<section><h4>未計入時間</h4><dl class="diagnostic-detail-lines four">
      <div><dt>音節起始</dt><dd>${excluded.syllableStart}</dd></div>
      <div><dt>錯誤輸入</dt><dd>${excluded.incorrect}</dd></div>
      <div><dt>修正輸入</dt><dd>${excluded.recovery}</dd></div>
      <div><dt>輸入干擾</dt><dd>${excluded.interactionNoise}</dd></div>
    </dl></section>`;
}

export function keyDetailMarkup(
  row: KeyDiagnostic | null,
  trends?: KeyProgressTrends,
): string {
  if (row === null) return '<div class="diagnostic-detail-empty">選一個按鍵查看量測。</div>';
  return `<article class="diagnostic-detail-card">
    <header><div><span>按鍵</span><h3>${escapeHtml(row.symbol)} <small>${escapeHtml(row.physicalKey)}</small></h3></div>${detailStateMarkup(row.overallDataState)}</header>
    <dl class="diagnostic-detail-metrics">
      <div><dt>錯誤觀察比例</dt><dd>${row.displayedErrorRatio === null ? "—" : percent(row.displayedErrorRatio)}</dd><small>${row.errors} / ${row.attempts}</small></div>
      <div><dt>有效鍵間時間</dt><dd>${row.timingMs === null ? "—" : milliseconds(row.timingMs)}</dd><small>${escapeHtml(keyTimingCaption(row))}</small></div>
      <div><dt>最佳時間</dt><dd>${row.bestTimingMs === null ? "—" : milliseconds(row.bestTimingMs)}</dd><small>${row.timingSamples} 樣本</small></div>
      <div><dt>選題倍率</dt><dd>${boost(row.reinforcement.expectedTokenBoost)}</dd><small>${escapeHtml(row.reinforcement.label)}</small></div>
    </dl>
    ${keySampleNotices(row)}
    ${keyTimingExclusionsMarkup(row)}
    <section><h4>選題原因</h4><p>${escapeHtml(row.reinforcement.reason)}</p></section>
    ${keyProgressMarkup(trends)}
  </article>`;
}

export function transitionDetailMarkup(row: TransitionDiagnostic | null): string {
  if (row === null) return '<div class="diagnostic-detail-empty">尚無可查看的轉換資料。</div>';
  return `<article class="diagnostic-detail-card relation-detail">
    <header><div><span>轉換</span><h3>${escapeHtml(row.fromSymbol)} <small>${escapeHtml(row.fromPhysicalKey)}</small> → ${escapeHtml(row.toSymbol)} <small>${escapeHtml(row.toPhysicalKey)}</small></h3></div>${detailStateMarkup(row.dataState)}</header>
    <dl class="diagnostic-detail-metrics three">
      <div><dt>目前</dt><dd>${milliseconds(row.timingMs)}</dd></div>
      <div><dt>最佳</dt><dd>${milliseconds(row.bestTimingMs)}</dd></div>
      <div><dt>樣本</dt><dd>${row.timingSamples}</dd></div>
    </dl>
    <section><h4>計算方式</h4><p>只計同一音節中相鄰、正確且未受干擾的輸入。</p></section>
  </article>`;
}

export function confusionDetailMarkup(row: ConfusionDiagnostic | null): string {
  if (row === null) return '<div class="diagnostic-detail-empty">尚無可查看的誤按紀錄。</div>';
  return `<article class="diagnostic-detail-card relation-detail">
    <header><div><span>誤按</span><h3>${escapeHtml(row.expectedSymbol)} <small>${escapeHtml(row.expectedPhysicalKey)}</small> → ${escapeHtml(row.actualSymbol)} <small>${escapeHtml(row.actualPhysicalKey)}</small></h3></div>${detailStateMarkup(row.dataState)}</header>
    <dl class="diagnostic-detail-metrics three">
      <div><dt>此組</dt><dd>${row.occurrences}</dd></div>
      <div><dt>此鍵誤按總數</dt><dd>${row.expectedConfusionTotal}</dd></div>
      <div><dt>占比</dt><dd>${percent(row.expectedErrorShare)}</dd></div>
    </dl>
    <section><h4>計算方式</h4><p>占比以同一應按鍵的所有誤按為分母。</p></section>
  </article>`;
}
