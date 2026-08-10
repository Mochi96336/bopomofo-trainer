import "./motor-diagnostic-summary.css";
import type {
  MeasurementSummaryV2,
  MotorTimingAggregate,
} from "../measurement-v2/aggregate.js";
import { escapeHtml } from "./html.js";

const SUFFICIENT_SAMPLES = 5;

interface MotorSignal {
  readonly label: string;
  readonly value: string;
  readonly meta: string;
}

function milliseconds(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)} ms`;
}

function sampleMeta(samples: number, observations: number): string {
  if (observations === 0) return "尚無資料";
  if (samples === 0) return `${observations} 次觀察 · 尚無乾淨時間`;
  if (samples < SUFFICIENT_SAMPLES) return `${samples} 個乾淨樣本 · 樣本累積中`;
  return `${samples} 個乾淨樣本 · 分散於各類，單類樣本不足`;
}

function handLabel(hand: "left" | "right"): string {
  return hand === "left" ? "左" : "右";
}

function sufficientlySampled<T>(
  aggregates: readonly MotorTimingAggregate<T>[],
): readonly MotorTimingAggregate<T>[] {
  return aggregates.filter((aggregate) =>
    aggregate.timingSamples >= SUFFICIENT_SAMPLES
    && aggregate.currentTimeToTypeMs !== null,
  );
}

function familySignal<T>(
  label: string,
  aggregates: readonly MotorTimingAggregate<T>[],
  scopeLabel: (aggregate: MotorTimingAggregate<T>) => string,
): MotorSignal {
  const ready = sufficientlySampled(aggregates);
  if (ready.length === 0) {
    const observations = aggregates.reduce((sum, aggregate) => sum + aggregate.observations, 0);
    const samples = aggregates.reduce((sum, aggregate) => sum + aggregate.timingSamples, 0);
    return {
      label,
      value: "—",
      meta: sampleMeta(samples, observations),
    };
  }

  if (ready.length === 1) {
    const aggregate = ready[0]!;
    return {
      label,
      value: milliseconds(aggregate.currentTimeToTypeMs),
      meta: `${scopeLabel(aggregate)} · ${aggregate.timingSamples} 樣本`,
    };
  }

  const samples = ready.reduce((sum, aggregate) => sum + aggregate.timingSamples, 0);
  return {
    label,
    value: `${ready.length} 類`,
    meta: `${samples} 個乾淨樣本 · 各類分開估計，不跨類排名`,
  };
}

function coordinationSignal(summary: MeasurementSummaryV2): MotorSignal {
  return familySignal(
    "音節協調",
    Object.values(summary.motor.coordination),
    (aggregate) => {
      const shape = aggregate.scope.handShape === "mixed"
        ? "雙手"
        : aggregate.scope.handShape === "left-only"
          ? "左手"
          : aggregate.scope.handShape === "right-only"
            ? "右手"
            : "手別未知";
      return `${aggregate.scope.bodySize} 成分 · ${shape}`;
    },
  );
}

function immediateHandSignal(summary: MeasurementSummaryV2): MotorSignal {
  return familySignal(
    "左右手交接",
    Object.values(summary.motor.immediateHands),
    (aggregate) => `${handLabel(aggregate.scope.fromHand)} → ${handLabel(aggregate.scope.toHand)}`,
  );
}

function revisitSignal(summary: MeasurementSummaryV2): MotorSignal {
  return familySignal(
    "同手再出手",
    Object.values(summary.motor.sameHandRevisits),
    (aggregate) => `${handLabel(aggregate.scope.hand)}手 · ${aggregate.scope.oppositeHandIntervened ? "中間有另一手" : "連續同手"}`,
  );
}

function toneSignal(summary: MeasurementSummaryV2): MotorSignal {
  return familySignal(
    "聲調完成",
    Object.values(summary.motor.toneCommits),
    (aggregate) => `聲調 ${aggregate.scope.toneToken.slice("tone:".length)}`,
  );
}

export function motorDiagnosticSignals(summary: MeasurementSummaryV2): readonly MotorSignal[] {
  return [
    coordinationSignal(summary),
    immediateHandSignal(summary),
    revisitSignal(summary),
    toneSignal(summary),
  ];
}

export function renderMotorDiagnosticSummary(
  container: HTMLElement,
  summary: MeasurementSummaryV2,
): void {
  container.querySelector(".motor-diagnostic-section")?.remove();
  const section = document.createElement("section");
  section.className = "panel-section motor-diagnostic-section";
  const signals = motorDiagnosticSignals(summary);
  section.innerHTML = `<div class="panel-heading">
      <div>
        <h3>動作協調</h3>
        <p class="panel-note">依實際按鍵順序量測；不同成分數與動作類型分開估計，不用絕對毫秒跨類判定弱點。</p>
      </div>
    </div>
    <div class="diagnostic-summary-signals motor-diagnostic-signals">
      ${signals.map((signal) => `<div>
        <span>${escapeHtml(signal.label)}</span>
        <strong>${escapeHtml(signal.value)}</strong>
        <small>${escapeHtml(signal.meta)}</small>
      </div>`).join("")}
    </div>`;
  const semantic = container.querySelector(".diagnostic-summary-section");
  if (semantic?.nextSibling !== null && semantic !== null) {
    semantic.parentNode?.insertBefore(section, semantic.nextSibling);
  } else if (semantic !== null) {
    semantic.parentNode?.append(section);
  } else {
    container.prepend(section);
  }
}
