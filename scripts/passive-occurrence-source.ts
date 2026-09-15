import {
  indexUdOccurrenceChildren,
  lexemeUposKey,
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
} from "./ud-occurrence-source.js";

export const PASSIVE_MARKER = "被" as const;
export const SHORT_PASSIVE_OCCURRENCE_EVIDENCE_CONTRACT =
  "same-predicate-aux-pass-bei-v1" as const;
export const LONG_PASSIVE_OCCURRENCE_EVIDENCE_CONTRACT =
  "same-predicate-obl-agent-case-bei-v1" as const;

export interface PassiveOccurrenceEvidence {
  readonly shortPassivePredicateTokenCount: number;
  readonly shortPassivePredicateCounts: ReadonlyMap<string, number>;
  readonly shortPassiveWithSubjectTokenCount: number;
  readonly shortPassiveWithSubjectCounts: ReadonlyMap<string, number>;
  readonly longPassivePredicateTokenCount: number;
  readonly longPassivePredicateCounts: ReadonlyMap<string, number>;
  readonly longPassiveWithSubjectTokenCount: number;
  readonly longPassiveWithSubjectCounts: ReadonlyMap<string, number>;
  readonly passivePredicateTokenCount: number;
  readonly passivePredicateCounts: ReadonlyMap<string, number>;
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function hasPassiveSubject(
  predicateId: number,
  childrenByHead: ReadonlyMap<number, readonly { readonly relation: string }[]>,
): boolean {
  return (childrenByHead.get(predicateId) ?? []).some((candidate) =>
    candidate.relation === "nsubj:pass",
  );
}

export function parsePassiveOccurrenceEvidence(source: string): PassiveOccurrenceEvidence {
  const shortPassivePredicateCounts = new Map<string, number>();
  const shortPassiveWithSubjectCounts = new Map<string, number>();
  const longPassivePredicateCounts = new Map<string, number>();
  const longPassiveWithSubjectCounts = new Map<string, number>();
  const passivePredicateCounts = new Map<string, number>();
  let shortPassivePredicateTokenCount = 0;
  let shortPassiveWithSubjectTokenCount = 0;
  let longPassivePredicateTokenCount = 0;
  let longPassiveWithSubjectTokenCount = 0;
  let passivePredicateTokenCount = 0;

  for (const tokens of parseUdOccurrenceSentences(source)) {
    const childrenByHead = indexUdOccurrenceChildren(tokens);
    for (const predicate of tokens) {
      const directChildren = childrenByHead.get(predicate.id) ?? [];
      const shortPassive = directChildren.some((candidate) =>
        candidate.relation === "aux:pass"
        && candidate.upos === "AUX"
        && candidate.form === PASSIVE_MARKER,
      );
      const longPassive = directChildren
        .filter((candidate) => candidate.relation === "obl:agent")
        .some((agent) => (childrenByHead.get(agent.id) ?? []).some((candidate) =>
          candidate.relation === "case"
          && candidate.upos === "ADP"
          && candidate.form === PASSIVE_MARKER,
        ));
      if (!shortPassive && !longPassive) continue;

      const key = lexemeUposKey(predicate.form, predicate.upos);
      const subject = hasPassiveSubject(predicate.id, childrenByHead);

      if (shortPassive) {
        shortPassivePredicateTokenCount += 1;
        increment(shortPassivePredicateCounts, key);
        if (subject) {
          shortPassiveWithSubjectTokenCount += 1;
          increment(shortPassiveWithSubjectCounts, key);
        }
      }
      if (longPassive) {
        longPassivePredicateTokenCount += 1;
        increment(longPassivePredicateCounts, key);
        if (subject) {
          longPassiveWithSubjectTokenCount += 1;
          increment(longPassiveWithSubjectCounts, key);
        }
      }

      passivePredicateTokenCount += 1;
      increment(passivePredicateCounts, key);
    }
  }

  return {
    shortPassivePredicateTokenCount,
    shortPassivePredicateCounts,
    shortPassiveWithSubjectTokenCount,
    shortPassiveWithSubjectCounts,
    longPassivePredicateTokenCount,
    longPassivePredicateCounts,
    longPassiveWithSubjectTokenCount,
    longPassiveWithSubjectCounts,
    passivePredicateTokenCount,
    passivePredicateCounts,
  };
}

function mergeCounts(target: Map<string, number>, source: ReadonlyMap<string, number>): void {
  for (const [key, count] of source) {
    target.set(key, (target.get(key) ?? 0) + count);
  }
}

export function mergePassiveOccurrenceEvidence(
  observations: readonly PassiveOccurrenceEvidence[],
): PassiveOccurrenceEvidence {
  const shortPassivePredicateCounts = new Map<string, number>();
  const shortPassiveWithSubjectCounts = new Map<string, number>();
  const longPassivePredicateCounts = new Map<string, number>();
  const longPassiveWithSubjectCounts = new Map<string, number>();
  const passivePredicateCounts = new Map<string, number>();
  let shortPassivePredicateTokenCount = 0;
  let shortPassiveWithSubjectTokenCount = 0;
  let longPassivePredicateTokenCount = 0;
  let longPassiveWithSubjectTokenCount = 0;
  let passivePredicateTokenCount = 0;

  for (const observation of observations) {
    shortPassivePredicateTokenCount += observation.shortPassivePredicateTokenCount;
    shortPassiveWithSubjectTokenCount += observation.shortPassiveWithSubjectTokenCount;
    longPassivePredicateTokenCount += observation.longPassivePredicateTokenCount;
    longPassiveWithSubjectTokenCount += observation.longPassiveWithSubjectTokenCount;
    passivePredicateTokenCount += observation.passivePredicateTokenCount;
    mergeCounts(shortPassivePredicateCounts, observation.shortPassivePredicateCounts);
    mergeCounts(shortPassiveWithSubjectCounts, observation.shortPassiveWithSubjectCounts);
    mergeCounts(longPassivePredicateCounts, observation.longPassivePredicateCounts);
    mergeCounts(longPassiveWithSubjectCounts, observation.longPassiveWithSubjectCounts);
    mergeCounts(passivePredicateCounts, observation.passivePredicateCounts);
  }

  return {
    shortPassivePredicateTokenCount,
    shortPassivePredicateCounts,
    shortPassiveWithSubjectTokenCount,
    shortPassiveWithSubjectCounts,
    longPassivePredicateTokenCount,
    longPassivePredicateCounts,
    longPassiveWithSubjectTokenCount,
    longPassiveWithSubjectCounts,
    passivePredicateTokenCount,
    passivePredicateCounts,
  };
}

export async function loadPinnedPassiveOccurrenceEvidence(): Promise<PassiveOccurrenceEvidence> {
  return mergePassiveOccurrenceEvidence(
    (await loadPinnedUdGsdOccurrenceSources()).map(parsePassiveOccurrenceEvidence),
  );
}
