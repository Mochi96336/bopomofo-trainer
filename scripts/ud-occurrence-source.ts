export const UD_GSD_PROVENANCE_ID = "ud:chinese-gsd-r2.18" as const;
export const UD_GSD_SOURCE_VERSION = "r2.18" as const;
export const UD_GSD_SOURCE_COMMIT = "e0d85a020182e264d6384be2a59c0f4879a1cc35" as const;
export const UD_GSD_FILENAMES = [
  "zh_gsd-ud-train.conllu",
  "zh_gsd-ud-dev.conllu",
  "zh_gsd-ud-test.conllu",
] as const;

export interface UdOccurrenceToken {
  readonly id: number;
  readonly form: string;
  readonly upos: string;
  readonly feats: string;
  readonly head: number;
  /** Exact UD relation, including subtypes such as obl:patient and nsubj:pass. */
  readonly relation: string;
}

export function lexemeUposKey(text: string, upos: string): string {
  return `${text}\u0000${upos}`;
}

/**
 * Parse only ordinary integer-ID CoNLL-U tokens. Multiword-token rows and empty
 * nodes are intentionally skipped because reviewed occurrence capabilities are
 * anchored to ordinary syntactic tokens.
 */
export function parseUdOccurrenceSentences(
  source: string,
): readonly (readonly UdOccurrenceToken[])[] {
  const sentences: UdOccurrenceToken[][] = [];
  let tokens: UdOccurrenceToken[] = [];

  const flush = (): void => {
    if (tokens.length > 0) sentences.push(tokens);
    tokens = [];
  };

  for (const line of source.split("\n")) {
    if (line.length === 0) {
      flush();
      continue;
    }
    if (line.startsWith("#")) continue;
    const columns = line.split("\t");
    if (columns.length !== 10 || !/^\d+$/u.test(columns[0] ?? "")) continue;
    const [rawId, form, , upos, , feats, rawHead, relation] = columns;
    if (rawId === undefined || form === undefined || upos === undefined
      || feats === undefined || rawHead === undefined || relation === undefined) {
      continue;
    }
    const id = Number(rawId);
    const head = Number(rawHead);
    if (!Number.isInteger(id) || !Number.isInteger(head)) continue;
    tokens.push({ id, form, upos, feats, head, relation });
  }
  flush();
  return sentences;
}

export function indexUdOccurrenceChildren(
  tokens: readonly UdOccurrenceToken[],
): ReadonlyMap<number, readonly UdOccurrenceToken[]> {
  const childrenByHead = new Map<number, UdOccurrenceToken[]>();
  for (const token of tokens) {
    const children = childrenByHead.get(token.head) ?? [];
    children.push(token);
    childrenByHead.set(token.head, children);
  }
  return childrenByHead;
}

export async function loadPinnedUdGsdOccurrenceSources(): Promise<readonly string[]> {
  return Promise.all(UD_GSD_FILENAMES.map(async (filename) => {
    const url = `https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSD/${UD_GSD_SOURCE_COMMIT}/${filename}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to fetch pinned ${UD_GSD_SOURCE_VERSION} source ${filename}: ${response.status}`);
    }
    return response.text();
  }));
}
