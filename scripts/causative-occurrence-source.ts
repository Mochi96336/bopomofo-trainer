export const CAUSATIVE_REVIEWED_FEATURE = "Voice=Cau" as const;
export const CAUSATIVE_OCCURRENCE_CAPABILITY = "voice-cau-ccomp-same-occurrence" as const;
export const CAUSATIVE_OCCURRENCE_EVIDENCE_CONTRACT = "same-token-voice-cau-direct-ccomp-v1" as const;
export const UD_GSD_PROVENANCE_ID = "ud:chinese-gsd-r2.18" as const;
export const UD_GSD_SOURCE_VERSION = "r2.18" as const;
export const UD_GSD_SOURCE_COMMIT = "e0d85a020182e264d6384be2a59c0f4879a1cc35" as const;
export const UD_GSD_FILENAMES = [
  "zh_gsd-ud-train.conllu",
  "zh_gsd-ud-dev.conllu",
  "zh_gsd-ud-test.conllu",
] as const;

interface UdToken {
  readonly id: number;
  readonly form: string;
  readonly upos: string;
  readonly feats: string;
  readonly head: number;
  readonly relation: string;
}

export interface CausativeOccurrenceEvidence {
  readonly voiceCauTokenCount: number;
  readonly voiceCauCounts: ReadonlyMap<string, number>;
  readonly sameTokenCcompTokenCount: number;
  readonly sameTokenCcompCounts: ReadonlyMap<string, number>;
  readonly sameTokenCcompOwnSubjectTokenCount: number;
  readonly sameTokenCcompOwnSubjectCounts: ReadonlyMap<string, number>;
}

export function lexemeUposKey(text: string, upos: string): string {
  return `${text}\u0000${upos}`;
}

function parseSentences(source: string): readonly (readonly UdToken[])[] {
  const sentences: UdToken[][] = [];
  let tokens: UdToken[] = [];

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

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export function parseCausativeOccurrenceEvidence(source: string): CausativeOccurrenceEvidence {
  const voiceCauCounts = new Map<string, number>();
  const sameTokenCcompCounts = new Map<string, number>();
  const sameTokenCcompOwnSubjectCounts = new Map<string, number>();
  let voiceCauTokenCount = 0;
  let sameTokenCcompTokenCount = 0;
  let sameTokenCcompOwnSubjectTokenCount = 0;

  for (const tokens of parseSentences(source)) {
    const childrenByHead = new Map<number, UdToken[]>();
    for (const token of tokens) {
      const children = childrenByHead.get(token.head) ?? [];
      children.push(token);
      childrenByHead.set(token.head, children);
    }
    for (const token of tokens) {
      if (!token.feats.split("|").includes(CAUSATIVE_REVIEWED_FEATURE)) continue;
      voiceCauTokenCount += 1;
      const key = lexemeUposKey(token.form, token.upos);
      increment(voiceCauCounts, key);

      const ccompChildren = (childrenByHead.get(token.id) ?? [])
        .filter((child) => child.relation === "ccomp");
      if (ccompChildren.length === 0) continue;
      sameTokenCcompTokenCount += 1;
      increment(sameTokenCcompCounts, key);

      const hasEmbeddedSubject = ccompChildren.some((child) =>
        (childrenByHead.get(child.id) ?? []).some((candidate) =>
          candidate.relation === "nsubj" || candidate.relation.startsWith("nsubj:"),
        ),
      );
      if (!hasEmbeddedSubject) continue;
      sameTokenCcompOwnSubjectTokenCount += 1;
      increment(sameTokenCcompOwnSubjectCounts, key);
    }
  }

  return {
    voiceCauTokenCount,
    voiceCauCounts,
    sameTokenCcompTokenCount,
    sameTokenCcompCounts,
    sameTokenCcompOwnSubjectTokenCount,
    sameTokenCcompOwnSubjectCounts,
  };
}

function mergeCounts(target: Map<string, number>, source: ReadonlyMap<string, number>): void {
  for (const [key, count] of source) {
    target.set(key, (target.get(key) ?? 0) + count);
  }
}

export function mergeCausativeOccurrenceEvidence(
  observations: readonly CausativeOccurrenceEvidence[],
): CausativeOccurrenceEvidence {
  const voiceCauCounts = new Map<string, number>();
  const sameTokenCcompCounts = new Map<string, number>();
  const sameTokenCcompOwnSubjectCounts = new Map<string, number>();
  let voiceCauTokenCount = 0;
  let sameTokenCcompTokenCount = 0;
  let sameTokenCcompOwnSubjectTokenCount = 0;

  for (const observation of observations) {
    voiceCauTokenCount += observation.voiceCauTokenCount;
    sameTokenCcompTokenCount += observation.sameTokenCcompTokenCount;
    sameTokenCcompOwnSubjectTokenCount += observation.sameTokenCcompOwnSubjectTokenCount;
    mergeCounts(voiceCauCounts, observation.voiceCauCounts);
    mergeCounts(sameTokenCcompCounts, observation.sameTokenCcompCounts);
    mergeCounts(sameTokenCcompOwnSubjectCounts, observation.sameTokenCcompOwnSubjectCounts);
  }

  return {
    voiceCauTokenCount,
    voiceCauCounts,
    sameTokenCcompTokenCount,
    sameTokenCcompCounts,
    sameTokenCcompOwnSubjectTokenCount,
    sameTokenCcompOwnSubjectCounts,
  };
}

export async function loadPinnedCausativeOccurrenceEvidence(): Promise<CausativeOccurrenceEvidence> {
  const observations = await Promise.all(UD_GSD_FILENAMES.map(async (filename) => {
    const url = `https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSD/${UD_GSD_SOURCE_COMMIT}/${filename}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`failed to fetch pinned ${UD_GSD_SOURCE_VERSION} source ${filename}: ${response.status}`);
    }
    return parseCausativeOccurrenceEvidence(await response.text());
  }));
  return mergeCausativeOccurrenceEvidence(observations);
}
