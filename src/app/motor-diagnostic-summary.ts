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
  return `${samples} 個乾淨樣本${samples < SUFFICIENT_SAMPLES ? " · 樣本累積中" : ""}`;
}

function handLabel(hand: "left" | "right"): string {
  return hand === "left" ? "左" : "右";
}

function slowestWithEnoughSamples<T>(
  aggregates: readonly MotorTimingAggregate<T>[],
): MotorTimingAggregate<T> | null {
  return aggregates
    .filter((aggregate) =>
      aggregate.timingSamples >= SUFFICIENT_SAMPLES
      && aggregate.currentTimeToTypeMs !== null,
    )
    .sort((left, right) =>
      (right.currentTimeToTypeMs ?? 0) - (left.currentTimeToTypeMs ?? 0),
    )[0] ?? null;
}

function coordinationSignal(summary: MeasurementSummaryV2): MotorSignal {
  const values = Object.values(summary.motor.coordination);
  const slowest = slowestWithEnoughSamples(values);
  if (slowest === null) {
    const observations = values.reduce((sum, aggregate) => sum + aggregate.observations, 0);
    const samples = values.reduce((sum, aggregate) => sum + aggregate.timingSamples, 0);
    return {
      label: "音節協調",
      value: "—",
      meta: sampleMeta(samples, observations),
    };
  }
  const shape = slowest.scope.handShape === "mixed"
    ? "雙手"
    : slowest.scope.handShape === "left-only"
      ? "左手"
      : slowest.scope.handShape === "right-only"
        ? "右手"
        : "手別未知";
  return {
    label: "較慢音節協調",
    value: milliseconds(slowest.currentTimeToTypeMs),
    meta: `${slowest.scope.bodySize} 成分 · ${shape} · ${slowest.timingSamples} 樣本`,
  };
}

function immediateHandSignal(summary: MeasurementSummaryV2): MotorSignal {
  const values = Object.values(summary.motor.immediateHands);
  const slowest = slowestWithEnoughSamples(values);
  if (slowest === null) {
    const observations = values.reduce((sum, aggregate) => sum + aggregate.observations, 0);
    const samples = values.reduce((sum, aggregate) => sum + aggregate.timingSamples, 0);
    return {
      label: "左右手交接",
      value: "—",
      meta: sampleMeta(samples, observations),
    };
  }
  return {
    label: `${handLabel(slowest.scope.fromHand)} → ${handLabel(slowest.scope.toHand)}`,
    value: milliseconds(slowest.currentTimeToTypeMs),
    meta: `較慢的手別路徑 · ${slowest.timingSamples} 樣本`,
  };
}

function revisitSignal(summary: MeasurementSummaryV2): MotorSignal {
  const values = Object.values(summary.motor.sameHandRevisits);
  const slowest = slowestWithEnoughSamples(values);
  if (slowest === null) {
    const observations = values.reduce((sum, aggregate) => sum + aggregate.observations, 0);
    const samples = values.reduce((sum, aggregate) => sum + aggregate.timingSamples, 0);
    return {
      label: "同手再出手",
      value: "—",
      meta: sampleMeta(samples, observations),
    };
  }
  return {
    label: `${handLabel(slowest.scope.hand)}手再出手`,
    value: milliseconds(slowest.currentTimeToTypeMs),
    meta: `${slowest.scope.oppositeHandIntervened ? "中間有另一手" : "連續同手"} · ${slowest.timingSamples} 樣本`,
  };
}

function toneSignal(summary: MeasurementSummaryV2): MotorSignal {
  const values = Object.values(summary.motor.toneCommits);
  const slowest = slowestWithEnoughSamples(values);
  if (slowest === null) {
    const observations = values.reduce((sum, aggregate) => sum + aggregate.observations, 0);
    const samples = values.reduce((sum, aggregate) => sum + aggregate.timingSamples, 0);
    return {
      label: "聲調完成",
      value: "—",
      meta: sampleMeta(samples, observations),
    };
  }
  return {
    label: `聲調 ${slowest.scope.toneToken.slice("tone:".length)}`,
    value: milliseconds(slowest.currentTimeToTypeMs),
    meta: `較慢的聲調完成 · ${slowest.timingSamples} 樣本`,
  };
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
        <p class="panel-note">依實際按鍵順序量測；不使用注音的標準排列順序推測手指轉換。</p>
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
