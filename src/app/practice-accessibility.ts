export interface PracticeCurrentTarget {
  readonly roundNumber: number;
  readonly position: number;
  readonly total: number;
  readonly tokenLabel: string;
  readonly physicalKeyLabel: string;
}

export function practiceCurrentTargetText(target: PracticeCurrentTarget): string {
  return `第 ${target.roundNumber} 句，位置 ${target.position} / ${target.total}。目前注音 ${target.tokenLabel}，實體鍵 ${target.physicalKeyLabel}。`;
}

export interface PracticeCurrentSyllable {
  readonly roundNumber: number;
  readonly completed: number;
  readonly total: number;
  readonly tokenLabels: readonly string[];
  readonly physicalKeyLabels: readonly string[];
  readonly toneReady: boolean;
}

export function practiceCurrentSyllableText(target: PracticeCurrentSyllable): string {
  if (target.tokenLabels.length === 0) return "";
  const progress = `第 ${target.roundNumber} 句，進度 ${target.completed} / ${target.total}。`;
  if (target.toneReady) {
    return `${progress}注音成分已完成；目前輸入聲調 ${target.tokenLabels[0]}，實體鍵 ${target.physicalKeyLabels[0] ?? ""}。`;
  }
  const tokens = target.tokenLabels.join("、");
  const keys = target.physicalKeyLabels.filter(Boolean).join("、");
  return `${progress}目前音節可輸入 ${tokens}${keys ? `；實體鍵 ${keys}` : ""}，順序不限。`;
}
