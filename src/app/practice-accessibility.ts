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
