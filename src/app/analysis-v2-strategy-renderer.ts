import type {
  CoordinationBodySizeBucket,
  InputOrderPositionAggregateScope,
} from "../measurement-v2/aggregate.js";
import { escapeHtml } from "./html.js";
import type { AnalysisV2Model } from "./analysis-v2-model.js";
import {
  analysisV2MethodDetailsMarkup,
  analysisV2PrimaryStageMarkup,
} from "./analysis-v2-render-primitives.js";
import {
  strategyPermutationStructureLabel,
  strategyTrajectoryMarkup,
} from "./analysis-v2-strategy-trajectory.js";

const BODY_SIZES: readonly CoordinationBodySizeBucket[] = ["2", "3"];
const POSITIONS = ["first", "middle", "last"] as const;
const THREE_PART_PERMUTATIONS = [
  "first-middle-last",
  "middle-first-last",
  "first-last-middle",
  "middle-last-first",
  "last-first-middle",
  "last-middle-first",
] as const;
type ThreePartPermutation = (typeof THREE_PART_PERMUTATIONS)[number];
const STRATEGY_LEAD_MIN_ROW_OBSERVATIONS = 8;

function positionLabel(position: InputOrderPositionAggregateScope["canonicalPosition"]): string {
  return position === "first" ? "前" : position === "last" ? "後" : "中";
}

function positionsForBodySize(
  bodySize: CoordinationBodySizeBucket,
): readonly InputOrderPositionAggregateScope["canonicalPosition"][] {
  return bodySize === "2" ? ["first", "last"] : POSITIONS;
}

function positionCount(
  model: AnalysisV2Model,
  bodySize: CoordinationBodySizeBucket,
  canonical: InputOrderPositionAggregateScope["canonicalPosition"],
  accepted: InputOrderPositionAggregateScope["acceptedPosition"],
): number {
  return model.strategy.inputOrderPositions.find(
    (row) => row.scope.bodySize === bodySize
      && row.scope.canonicalPosition === canonical
      && row.scope.acceptedPosition === accepted,
  )?.observations ?? 0;
}

function positionRows(model: AnalysisV2Model, bodySize: CoordinationBodySizeBucket) {
  const positions = positionsForBodySize(bodySize);
  return positions.map((canonical) => {
    const values = positions.map((accepted) => positionCount(model, bodySize, canonical, accepted));
    return { canonical, values, total: values.reduce((sum, value) => sum + value, 0) };
  });
}

function projectionRowLabel(
  bodySize: CoordinationBodySizeBucket,
  position: InputOrderPositionAggregateScope["canonicalPosition"],
): string {
  if (bodySize === "2") return positionLabel(position);
  if (position === "first") return "聲";
  if (position === "middle") return "介";
  return "韻";
}

function completionPositionLabel(index: number): string {
  return index === 0 ? "①" : index === 1 ? "②" : "③";
}

function positionProjectionMarkup(
  model: AnalysisV2Model,
  bodySize: CoordinationBodySizeBucket,
): string {
  const positions = positionsForBodySize(bodySize);
  const rows = positionRows(model, bodySize);
  return `<aside class="analysis-v2-strategy-projection" aria-label="${bodySize} 個注音的位置投影">
    <div class="analysis-v2-strategy-projection-heading"><strong>位置投影</strong><span>結構 × 完成</span></div>
    <table class="analysis-v2-strategy-projection-matrix"><caption class="analysis-v2-visually-hidden">列是結構位置，欄是第幾個完成位置；這是邊際位置分布，不代表完整字順序。</caption><thead><tr><th scope="col"></th>${positions.map((_position, index) => `<th scope="col">${completionPositionLabel(index)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${projectionRowLabel(bodySize, row.canonical)}</th>${row.values.map((count, index) => {
      const ratio = row.total === 0 ? 0 : count / row.total;
      const title = `${projectionRowLabel(bodySize, row.canonical)}在第 ${index + 1} 個完成位置：${count} 次${row.total === 0 ? "" : `，${Math.round(ratio * 100)}%`}`;
      return `<td style="--analysis-strength:${ratio}" title="${escapeHtml(title)}"><strong>${count === 0 ? "·" : count}</strong></td>`;
    }).join("")}</tr>`).join("")}</tbody></table>
  </aside>`;
}

function strategyObjectMarkup(
  model: AnalysisV2Model,
  bodySize: CoordinationBodySizeBucket,
): string {
  return `<div class="analysis-v2-strategy-object analysis-v2-strategy-trajectory-object" data-body-size="${bodySize}">${strategyTrajectoryMarkup(bodySize, model.strategy.recentInputOrderTrajectories ?? [])}${positionProjectionMarkup(model, bodySize)}</div>`;
}

function twoPartStrategyFieldMarkup(model: AnalysisV2Model): string {
  const rows = positionRows(model, "2");
  const positions = positionsForBodySize("2");
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const shifted = rows.reduce((sum, row) => sum + row.values.reduce((rowSum, count, index) => (
    positions[index] === row.canonical ? rowSum : rowSum + count
  ), 0), 0);
  const ready = rows.every((row) => row.total >= STRATEGY_LEAD_MIN_ROW_OBSERVATIONS);
  const leadMarkup = !ready
    ? `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><strong>仍在累積</strong><small>前、後位置各累積 ${STRATEGY_LEAD_MIN_ROW_OBSERVATIONS} 個觀察後顯示換序輸入</small></div>`
    : `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><strong><b>換序輸入</b><em>${Math.round((total === 0 ? 0 : shifted / total) * 100)}%</em></strong><small>${shifted} / ${total} 個位置觀察</small></div>`;
  return analysisV2PrimaryStageMarkup(
    strategyObjectMarkup(model, "2"),
    leadMarkup,
    "analysis-v2-strategy-stage analysis-v2-strategy-trajectory-stage",
  );
}

function permutationLabel(permutation: ThreePartPermutation): string {
  return strategyPermutationStructureLabel(permutation);
}

function threePartPermutationCount(model: AnalysisV2Model, permutation: ThreePartPermutation): number {
  return model.strategy.inputOrderPermutations?.find(
    (row) => row.scope.bodySize === "3" && row.scope.permutation === permutation,
  )?.observations ?? 0;
}

function threePartStrategyFieldMarkup(model: AnalysisV2Model): string {
  const rows = THREE_PART_PERMUTATIONS.map((permutation) => ({
    permutation,
    count: threePartPermutationCount(model, permutation),
  }));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const canonical = rows.find((row) => row.permutation === "first-middle-last")?.count ?? 0;
  const reordered = total - canonical;
  const positionTotal = positionRows(model, "3").reduce((sum, row) => sum + row.total, 0);
  const sortedObserved = rows
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count
      || THREE_PART_PERMUTATIONS.indexOf(left.permutation)
        - THREE_PART_PERMUTATIONS.indexOf(right.permutation));
  const commonReordered = sortedObserved
    .filter((row) => row.permutation !== "first-middle-last")
    .slice(0, 2)
    .map((row) => `${permutationLabel(row.permutation)} ${Math.round((row.count / total) * 100)}%`)
    .join(" · ");
  const currentObservation = sortedObserved[0];
  const leadMarkup = total === 0
    ? `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><strong>完整順序開始累積</strong><small>舊的位置資料不能可靠還原成完整三注音順序與毫秒軌跡</small><span>${positionTotal} 個位置觀察仍保留，只作位置投影</span></div>`
    : total < STRATEGY_LEAD_MIN_ROW_OBSERVATIONS
      ? `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><strong>仍在累積</strong><small>${total} 個完整三注音字 · 累積 ${STRATEGY_LEAD_MIN_ROW_OBSERVATIONS} 個後顯示換序比例</small><span>${currentObservation === undefined ? "目前尚無完整順序樣本" : `目前觀察：${escapeHtml(permutationLabel(currentObservation.permutation))} · ${currentObservation.count} 次`}</span></div>`
      : `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><strong><b>換序輸入</b><em>${Math.round((reordered / total) * 100)}%</em></strong><small>${reordered} / ${total} 個三注音字</small><span>${commonReordered === "" ? "目前沒有換序樣本" : `常見換序：${escapeHtml(commonReordered)}`}</span></div>`;
  return analysisV2PrimaryStageMarkup(
    strategyObjectMarkup(model, "3"),
    leadMarkup,
    "analysis-v2-strategy-stage analysis-v2-strategy-trajectory-stage",
  );
}

function strategyFieldMarkup(model: AnalysisV2Model, bodySize: CoordinationBodySizeBucket): string {
  return bodySize === "2"
    ? twoPartStrategyFieldMarkup(model)
    : threePartStrategyFieldMarkup(model);
}

export function renderAnalysisV2Strategy(
  model: AnalysisV2Model,
  bodySize: CoordinationBodySizeBucket,
): string {
  const rule = bodySize === "2"
    ? "2 個注音也以最近乾淨完整字的真實相對毫秒畫軌跡：第一個成功接受的注音歸零，第二個點保留實際間隔；只保存最近 80 個二注音字，越新的線越清楚。因為二注音不一定是固定的聲母＋韻母，兩條軌只標前位、後位。左下位置投影只表示結構位置分別落在哪個完成位置，不把邊際分布當成另一種完整順序。二注音完整字每次固定產生前位、後位各一個位置觀察；換序時兩個位置會成對互換，所以換序比例可由累積位置觀察等價計算。"
    : "3 個注音以一整個字的完成順序為單位；聲母 → 介音 → 韻母視為結構順序，其餘五種算換序輸入。軌跡只保存最近 80 個乾淨完整三注音字：第一個成功接受的注音歸零，橫軸是真實相對毫秒，越新的線越清楚。左下位置投影是各結構成分的邊際完成位置分布，不用來反推完整順序。完整順序比例仍用累積計數，未滿 8 個完整字不下比例判斷。舊位置資料不能可靠反推完整順序或毫秒軌跡。";
  return `<section class="analysis-v2-domain analysis-v2-strategy-domain" aria-labelledby="analysis-v2-tab-strategy">
    <div class="analysis-v2-domain-controls"><div class="analysis-v2-segments analysis-v2-strategy-segments" role="group" aria-label="字內注音成分數，不含聲調">${BODY_SIZES.map((size) => `<button type="button" data-action="strategy-size" data-value="${size}" aria-pressed="${bodySize === size}" title="這個字有 ${size} 個注音，不含聲調">${size} 個注音</button>`).join("")}</div></div>
    ${strategyFieldMarkup(model, bodySize)}
    ${analysisV2MethodDetailsMarkup("資料規則", rule)}
  </section>`;
}
