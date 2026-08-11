import type { AnalysisV2Model } from "./analysis-v2-model.js";

export function renderAnalysisV2Summary(
  section: HTMLElement,
  model: AnalysisV2Model,
  openAnalysis: () => void,
): void {
  section.className = "panel-section analysis-v2-summary";
  section.removeAttribute("data-analysis-v2-summary-slot");
  section.innerHTML = `<div class="analysis-v2-summary-heading"><div><h3>分析</h3><p>${model.semantic.keysWithData} 鍵有語意資料 · ${model.coordination.readyScopes} 類協調觀察可比較 · ${model.strategy.totalObservations} 個順序位置觀察</p></div><button type="button" class="analysis-v2-open">進入分析</button></div><div class="analysis-v2-summary-signals" aria-label="分析摘要"><div><span>語意</span><strong>${model.semantic.keysWithData} 鍵</strong><small>${model.semantic.repeatedConfusions} 組重複誤按</small></div><div><span>協調</span><strong>${model.coordination.readyScopes} 類</strong><small>${model.coordination.cleanTimingSamples} 個乾淨樣本</small></div><div><span>策略</span><strong>${model.strategy.totalObservations}</strong><small>${model.strategy.bodySizeBucketsWithData} 種注音數有資料</small></div></div>`;
  section.querySelector<HTMLButtonElement>(".analysis-v2-open")
    ?.addEventListener("click", openAnalysis);
}
