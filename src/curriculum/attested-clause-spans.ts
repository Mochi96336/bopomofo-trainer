import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";

/** Exact, contiguous *subordinate-clause spans* in a pinned UD sentence.
 * These are source quotations for offline review, NOT independent utterances,
 * a guarantee of natural Taiwan Mandarin, or a pronunciation label.
 */
export interface AttestedClauseSpan {
  readonly sourceHeadTokenId: number;
  readonly sourceRelation: "ccomp" | "advcl";
  readonly tokens: readonly UdOccurrenceToken[];
}

/** Do not infer missing subjects, reorder tokens or stitch discontinuous spans. */
export function extractAttestedClauseSpans(
  sentence: readonly UdOccurrenceToken[],
): readonly AttestedClauseSpan[] {
  const byHead = new Map<number, UdOccurrenceToken[]>();
  const indexById = new Map(sentence.map((token, index) => [token.id, index]));
  for (const token of sentence) {
    const children = byHead.get(token.head) ?? [];
    children.push(token);
    byHead.set(token.head, children);
  }
  const spans: AttestedClauseSpan[] = [];
  for (const head of sentence) {
    if (head.upos !== "VERB" || (head.relation !== "ccomp" && head.relation !== "advcl")) continue;
    // A direct lexical subject is a minimal finite-clause signal. It must be
    // inside this clause; an externally inherited subject is not inferred.
    if (!(byHead.get(head.id) ?? []).some(child =>
      child.relation === "nsubj" && ["PRON", "NOUN", "PROPN"].includes(child.upos))) continue;
    const descendants = new Set<number>();
    const pending = [head.id];
    while (pending.length) {
      const id = pending.pop()!;
      if (descendants.has(id)) continue;
      descendants.add(id);
      for (const child of byHead.get(id) ?? []) pending.push(child.id);
    }
    const indices = [...descendants].map(id => indexById.get(id));
    if (indices.some(index => index === undefined)) continue;
    const start = Math.min(...(indices as number[]));
    const end = Math.max(...(indices as number[]));
    // Reject any interleaving material rather than splice unrelated words
    // into the quotation or silently delete words between source tokens.
    if (end - start + 1 !== descendants.size) continue;
    const tokens = sentence.slice(start, end + 1);
    if (tokens.some(token => !descendants.has(token.id))) continue;
    spans.push({
      sourceHeadTokenId: head.id,
      sourceRelation: head.relation,
      tokens,
    });
  }
  return spans;
}
