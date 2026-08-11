import { tokenLabel } from "../diagnostics/labels.js";
import type {
  ImmediateHandAggregateScope,
  ImmediateTokenAggregateScope,
  SameHandRevisitAggregateScope,
} from "../measurement-v2/aggregate.js";
import { escapeHtml } from "./html.js";
import {
  analysisV2MovementLineArtMarkup,
  type AnalysisV2MovementFamilyId,
} from "./analysis-v2-movement-line-art.js";
import type { AnalysisV2Model, AnalysisV2MotorCell } from "./analysis-v2-model.js";
import {
  analysisV2KeyboardRowsMarkup,
  analysisV2MethodDetailsMarkup,
  analysisV2Milliseconds,
  analysisV2PrimaryStageMarkup,
} from "./analysis-v2-render-primitives.js";
import {
  ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES,
  ANALYSIS_V2_SPEED_VIEWBOX,
  buildAnalysisV2SpeedPaths,
  exactTransitionHistoryLabel,
} from "./analysis-v2-speed-network.js";
import type { AnalysisV2CoordinationView } from "./analysis-v2-state.js";
import { sparklinePoints } from "./practice-sparkline.js";

const MOTOR_TREND_WIDTH = 168;
const MOTOR_TREND_HEIGHT = 30;
const MOTOR_TREND_PAD = 3;

function motorTrendMarkup<Scope>(cell: AnalysisV2MotorCell<Scope>): string {
  const values = cell.history.slice(-10).map((point) => point.representativeTimingMs);
  if (values.length < 2) {
    return '<span class="analysis-v2-motor-sparkline-empty" aria-hidden="true">—</span>';
  }
  const plotted = sparklinePoints(values, MOTOR_TREND_WIDTH, MOTOR_TREND_HEIGHT, MOTOR_TREND_PAD);
  const path = plotted
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const last = plotted.at(-1)!;
  return `<svg class="analysis-v2-motor-sparkline" viewBox="0 0 ${MOTOR_TREND_WIDTH} ${MOTOR_TREND_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="${MOTOR_TREND_PAD}" y1="${MOTOR_TREND_HEIGHT - MOTOR_TREND_PAD}" x2="${MOTOR_TREND_WIDTH - MOTOR_TREND_PAD}" y2="${MOTOR_TREND_HEIGHT - MOTOR_TREND_PAD}"></line>
    <path d="${path}"></path>
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2"></circle>
  </svg>`;
}

function speedKeyboardMarkup(): string {
  return `<div class="analysis-v2-keyboard analysis-v2-speed-keyboard" aria-hidden="true">${analysisV2KeyboardRowsMarkup((tokenId, _key, columns) => `<span class="analysis-v2-key mapped" style="--key-columns:${columns}" data-speed-token="${escapeHtml(tokenId)}"><strong>${escapeHtml(tokenLabel(tokenId))}</strong></span>`)}</div>`;
}

function speedLeadMarkup(
  cell: AnalysisV2MotorCell<ImmediateTokenAggregateScope> | undefined,
  displayCount: string,
): string {
  if (cell === undefined || cell.currentTimeToTypeMs === null) {
    return `<div class="analysis-v2-hero-readout analysis-v2-speed-readout"><strong>仍在累積</strong><small>單一轉換累積 5 個乾淨時間樣本後可比較</small><span>${escapeHtml(displayCount)} · 線粗＝樣本支持；越深紅＝相對越慢</span></div>`;
  }
  return `<div class="analysis-v2-hero-readout analysis-v2-speed-readout">
    <strong><b>${escapeHtml(tokenLabel(cell.scope.fromToken))} → ${escapeHtml(tokenLabel(cell.scope.toToken))}</b><em>${escapeHtml(analysisV2Milliseconds(cell.currentTimeToTypeMs))}</em></strong>
    <small>${cell.timingSamples} 個乾淨樣本 · 僅在畫面中的同類實際鍵間轉換中比較</small>
    <span>${escapeHtml(exactTransitionHistoryLabel(cell))} · ${escapeHtml(displayCount)} · 線粗＝樣本支持；越深紅＝相對越慢</span>
  </div>`;
}

function familyStatus<Scope>(cells: readonly AnalysisV2MotorCell<Scope>[]): string {
  const observed = cells.filter((cell) => cell.observations > 0).length;
  const ready = cells.filter((cell) => cell.ready).length;
  if (observed === 0) return "尚無資料";
  if (ready === 0) return "樣本中";
  if (ready === observed) return "可比較";
  return `${ready} 可比較 · ${observed - ready} 樣本中`;
}

function movementStatMarkup<Scope>(
  label: string,
  cell: AnalysisV2MotorCell<Scope> | undefined,
): string {
  if (cell === undefined || cell.observations === 0) {
    return `<div class="analysis-v2-movement-stat empty"><span>${escapeHtml(label)}</span><span class="analysis-v2-motor-sparkline-empty" aria-hidden="true">—</span><strong>—</strong></div>`;
  }
  const value = analysisV2Milliseconds(cell.currentTimeToTypeMs);
  const support = `${cell.timingSamples} 個乾淨樣本，${cell.observations} 次觀察`;
  const visibleSupport = cell.ready
    ? `· ${cell.timingSamples} 個樣本`
    : `· 樣本中 · ${cell.timingSamples} 個樣本`;
  return `<div class="analysis-v2-movement-stat${cell.ready ? "" : " sampling"}" aria-label="${escapeHtml(label)}，${escapeHtml(value)}，${escapeHtml(support)}"><span>${escapeHtml(label)}</span>${motorTrendMarkup(cell)}<div class="analysis-v2-movement-reading"><strong>${escapeHtml(value)}</strong><small>${escapeHtml(visibleSupport)}</small></div></div>`;
}

function sortedMovementRows<Scope>(
  rows: readonly { readonly label: string; readonly cell: AnalysisV2MotorCell<Scope> | undefined }[],
): readonly { readonly label: string; readonly cell: AnalysisV2MotorCell<Scope> | undefined }[] {
  return [...rows].sort((left, right) => {
    const leftReady = left.cell?.ready === true;
    const rightReady = right.cell?.ready === true;
    if (leftReady !== rightReady) return leftReady ? -1 : 1;
    if (!leftReady) return left.label.localeCompare(right.label, "zh-Hant");
    const leftMs = left.cell?.currentTimeToTypeMs ?? 0;
    const rightMs = right.cell?.currentTimeToTypeMs ?? 0;
    if (leftMs !== rightMs) return rightMs - leftMs;
    return left.label.localeCompare(right.label, "zh-Hant");
  });
}

function movementFamilyMarkup(
  id: AnalysisV2MovementFamilyId,
  title: string,
  status: string,
  note: string,
  stats: readonly string[],
): string {
  return `<section class="analysis-v2-movement-family" data-movement-family="${id}">
    <header><strong>${escapeHtml(title)}</strong><small>${escapeHtml(status)}</small></header>
    ${analysisV2MovementLineArtMarkup(id)}
    ${stats.length === 0 ? "" : `<div class="analysis-v2-movement-stats">${stats.join("")}</div>`}
    <p>${escapeHtml(note)}</p>
  </section>`;
}

function bodyShapeLabel(
  shape: AnalysisV2Model["coordination"]["coordination"][number]["scope"]["bodyShape"],
): string {
  if (shape === "initial-medial-final") return "聲母＋介音＋韻母";
  if (shape === "initial-medial") return "聲母＋介音";
  if (shape === "initial-final") return "聲母＋韻母";
  return "介音＋韻母";
}

function findImmediate(
  model: AnalysisV2Model,
  fromHand: "left" | "right",
  toHand: "left" | "right",
): AnalysisV2MotorCell<ImmediateHandAggregateScope> | undefined {
  return model.coordination.immediateHands.find(
    (cell) => cell.scope.fromHand === fromHand && cell.scope.toHand === toHand,
  );
}

function revisitLabel(cell: AnalysisV2MotorCell<SameHandRevisitAggregateScope>): string {
  const hand = cell.scope.hand === "left" ? "左" : "右";
  return `${hand} · 隔${cell.scope.hand === "left" ? "右" : "左"}側`;
}

function movementFamiliesMarkup(model: AnalysisV2Model): string {
  const handRows = sortedMovementRows([
    { label: "左 → 左", cell: findImmediate(model, "left", "left") },
    { label: "左 → 右", cell: findImmediate(model, "left", "right") },
    { label: "右 → 左", cell: findImmediate(model, "right", "left") },
    { label: "右 → 右", cell: findImmediate(model, "right", "right") },
  ]);
  const handStats = handRows.map(({ label, cell }) => movementStatMarkup(label, cell));

  const observedRevisits = model.coordination.sameHandRevisits.filter(
    (cell) => cell.observations > 0 && cell.scope.oppositeHandIntervened,
  );
  const revisitRows = sortedMovementRows(
    observedRevisits.map((cell) => ({ label: revisitLabel(cell), cell })),
  );
  const revisitStats = revisitRows.length === 0
    ? ['<div class="analysis-v2-movement-empty">尚無同音節同側回返資料</div>']
    : revisitRows.map(({ label, cell }) => movementStatMarkup(label, cell));

  const observedStructures = model.coordination.coordination.filter((cell) => cell.observations > 0);
  const structureRows = sortedMovementRows(
    observedStructures.map((cell) => ({ label: bodyShapeLabel(cell.scope.bodyShape), cell })),
  );
  const structureStats = structureRows.length === 0
    ? ['<div class="analysis-v2-movement-empty">尚無字內結構時間資料</div>']
    : structureRows.map(({ label, cell }) => movementStatMarkup(label, cell));

  const toneRows = sortedMovementRows(
    model.coordination.toneCommits
      .filter((cell) => cell.observations > 0)
      .map((cell) => ({ label: tokenLabel(cell.scope.toneToken), cell })),
  );
  const toneStats = toneRows.length === 0
    ? ['<div class="analysis-v2-movement-empty">尚無聲調完成資料</div>']
    : toneRows.map(({ label, cell }) => movementStatMarkup(label, cell));

  return `<section class="analysis-v2-movement-view" aria-label="動作觀察">
    <div class="analysis-v2-movement-intro"><strong>動作觀察</strong><span>diagram 先說明動作；折線只看近期變化。只有累積至少 5 個乾淨時間樣本的列才參與家族內慢→快排列；樣本中的列固定留在其後。</span></div>
    <div class="analysis-v2-movement-grid">
      ${movementFamilyMarkup(
        "hand-switch",
        "手別轉換",
        familyStatus(model.coordination.immediateHands),
        "依標準指法鍵位分側，不代表偵測到實際使用哪隻手；可比較資料依目前代表時間由慢到快排列。",
        handStats,
      )}
      ${movementFamilyMarkup(
        "same-side-revisit",
        "同側回返",
        familyStatus(observedRevisits),
        "比較同一音節內離開一側後回到原側的時間；連續同手已由手別轉換的左→左／右→右呈現。最後的聲調鍵可以成為回返終點，不跨音節。可比較資料依目前代表時間由慢到快排列。",
        revisitStats,
      )}
      ${movementFamilyMarkup(
        "word-structure",
        "字內結構",
        familyStatus(observedStructures),
        "以聲母、介音、韻母的結構組合比較字內注音完成時間；可比較資料依目前代表時間由慢到快排列。",
        structureStats,
      )}
      ${movementFamilyMarkup(
        "tone-commit",
        "聲調收尾",
        familyStatus(model.coordination.toneCommits),
        "最後一個字內注音到聲調鍵的乾淨時間；可比較資料依目前代表時間由慢到快排列。",
        toneStats,
      )}
    </div>
    ${analysisV2MethodDetailsMarkup("資料規則", "折線只表示各家族自己的近期變化；至少 5 個乾淨時間樣本後，毫秒才進入家族內排序。樣本中的列不參與排名，只固定列在可比較資料之後。字內結構按聲母、介音、韻母組合聚合；同側回返只看同一音節內離開一側後再次回到該側的已接受手部事件，包含最後聲調但不跨音節或跨字；連續同手留在手別轉換，避免重複呈現同一筆相鄰時間。")}
  </section>`;
}

function speedNetworkMarkup(
  model: AnalysisV2Model,
  selectedPathId: string | null,
): string {
  const readyCells = model.coordination.immediateTokens.filter((cell) => cell.ready);
  const paths = buildAnalysisV2SpeedPaths(model.coordination.immediateTokens);
  const cellById = new Map(model.coordination.immediateTokens.map((cell) => [cell.id, cell]));
  const selectedCell = selectedPathId === null ? undefined : cellById.get(selectedPathId);
  const slowestVisibleCell = paths.length === 0 ? undefined : cellById.get(paths[paths.length - 1]!.id);
  const leadCell = selectedCell ?? slowestVisibleCell;
  const accentId = selectedCell?.id ?? slowestVisibleCell?.id ?? null;
  const allSamples = model.coordination.immediateTokens.reduce(
    (sum, cell) => sum + cell.timingSamples,
    0,
  );
  const displayCount = readyCells.length > ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES
    ? `${paths.length} / ${readyCells.length} 條可比較`
    : `${readyCells.length} 條可比較`;
  const viewBox = ANALYSIS_V2_SPEED_VIEWBOX;
  const board = `<div class="analysis-v2-speed-scroll" tabindex="0" aria-label="鍵間軌跡"><div class="analysis-v2-speed-board">
    ${speedKeyboardMarkup()}
    ${paths.length === 0
      ? `<div class="analysis-v2-speed-empty">目前有 ${allSamples} 個鍵間乾淨樣本，但還沒有單一轉換累積到 5 個。</div>`
      : `<svg class="analysis-v2-speed-svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="none" role="group" aria-label="可比較的實際鍵間軌跡">${paths.map((path) => {
        const cell = cellById.get(path.id);
        if (cell === undefined) return "";
        const selected = selectedPathId === path.id;
        const interaction = `data-action="select-speed" data-speed-id="${escapeHtml(path.id)}" data-from-token="${escapeHtml(cell.scope.fromToken)}" data-to-token="${escapeHtml(cell.scope.toToken)}"`;
        return `<path class="analysis-v2-speed-hit" d="${path.path}" ${interaction} aria-hidden="true"></path><path class="analysis-v2-speed-path${path.includesTone ? " tone" : ""}${accentId === path.id ? " is-accent" : ""}${selected ? " selected" : ""}" d="${path.path}" style="--relation-width:${path.width};--relation-opacity:${path.opacity};--relation-slowness:${path.slowness}" ${interaction} tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escapeHtml(path.label)}"><title>${escapeHtml(path.label)}</title></path>`;
      }).join("")}</svg>`}
  </div></div>`;
  const primary = analysisV2PrimaryStageMarkup(
    board,
    speedLeadMarkup(leadCell, displayCount),
    "analysis-v2-speed-primary",
  );
  return `<section class="analysis-v2-speed-field" aria-label="鍵間軌跡">
    <div class="analysis-v2-speed-stage${selectedCell === undefined ? "" : " has-selection"}">${primary}</div>
    ${analysisV2MethodDetailsMarkup("資料規則", `只畫同一字內實際相鄰接受且乾淨的轉換，每一條至少 5 個時間樣本。最多顯示支持度較高的 ${ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES} 條；紅色深淺只在目前畫面中的同類實際鍵間轉換內表示相對速度，越深紅越慢，不代表錯誤。`)}
  </section>`;
}

export function renderAnalysisV2Coordination(
  model: AnalysisV2Model,
  selectedPathId: string | null,
  view: AnalysisV2CoordinationView,
): string {
  return `<section class="analysis-v2-domain analysis-v2-coordination-domain" aria-labelledby="analysis-v2-tab-coordination">
    <div class="analysis-v2-domain-controls"><div class="analysis-v2-segments" role="group" aria-label="協調觀察方式">
      <button type="button" data-action="coordination-view" data-value="paths" aria-pressed="${view === "paths"}">鍵間</button>
      <button type="button" data-action="coordination-view" data-value="movement" aria-pressed="${view === "movement"}">動作</button>
    </div></div>
    ${view === "paths" ? speedNetworkMarkup(model, selectedPathId) : movementFamiliesMarkup(model)}
  </section>`;
}
