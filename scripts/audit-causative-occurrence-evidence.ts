import { readFile } from "node:fs/promises";
import { compileCatalog } from "../src/catalog/compile-catalog.js";
import type { ActiveCatalogSyntaxProfilesArtifact } from "../src/syntax/runtime-profiles.js";
import { loadResolvedCatalogSource } from "./load-resolved-catalog-source.js";

const REVIEWED_FEATURE = "Voice=Cau" as const;
const UD_SOURCE_COMMIT = "e0d85a020182e264d6384be2a59c0f4879a1cc35" as const;
const UD_FILENAMES = [
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

interface UdSentence {
  readonly text: string | null;
  readonly tokens: readonly UdToken[];
}

interface SourceExample {
  readonly text: string | null;
  readonly form: string;
  readonly relation: string;
  readonly ccompForms: readonly string[];
  readonly embeddedSubjects: readonly string[];
}

function lexemeUposKey(text: string, upos: string): string {
  return `${text}\u0000${upos}`;
}

function parseSentences(source: string): readonly UdSentence[] {
  const sentences: UdSentence[] = [];
  let text: string | null = null;
  let tokens: UdToken[] = [];

  const flush = (): void => {
    if (tokens.length > 0) sentences.push({ text, tokens });
    text = null;
    tokens = [];
  };

  for (const line of source.split("\n")) {
    if (line.length === 0) {
      flush();
      continue;
    }
    if (line.startsWith("# text = ")) {
      text = line.slice("# text = ".length);
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

function sortedTexts(values: ReadonlySet<string>): readonly string[] {
  return [...values].sort((left, right) => left.localeCompare(right, "zh-Hant"));
}

const [resolvedSource, profilesSource, udSources] = await Promise.all([
  loadResolvedCatalogSource(),
  readFile(new URL("../data/grammar/formal-syntax-active-catalog-profiles.json", import.meta.url), "utf8"),
  Promise.all(UD_FILENAMES.map(async (filename) => {
    const url = `https://raw.githubusercontent.com/UniversalDependencies/UD_Chinese-GSD/${UD_SOURCE_COMMIT}/${filename}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`failed to fetch pinned GSD ${filename}: ${response.status}`);
    return response.text();
  })),
]);

const catalog = compileCatalog(resolvedSource.records, new Set());
if (catalog.errors.length > 0) {
  throw new Error(catalog.errors.map((error) => error.message).join("\n"));
}
const textByEntryId = new Map(catalog.entries.map((entry) => [entry.id, entry.prompt.text]));
const artifact = JSON.parse(profilesSource) as ActiveCatalogSyntaxProfilesArtifact;

const voiceCauCounts = new Map<string, number>();
const sameTokenCcompCounts = new Map<string, number>();
const sameTokenCcompOwnSubjectCounts = new Map<string, number>();
const examplesByKey = new Map<string, SourceExample[]>();
let voiceCauTokenCount = 0;
let sameTokenCcompTokenCount = 0;
let sameTokenCcompOwnSubjectTokenCount = 0;

for (const source of udSources) {
  for (const sentence of parseSentences(source)) {
    const childrenByHead = new Map<number, UdToken[]>();
    for (const token of sentence.tokens) {
      const children = childrenByHead.get(token.head) ?? [];
      children.push(token);
      childrenByHead.set(token.head, children);
    }
    for (const token of sentence.tokens) {
      if (!token.feats.split("|").includes(REVIEWED_FEATURE)) continue;
      voiceCauTokenCount += 1;
      const key = lexemeUposKey(token.form, token.upos);
      increment(voiceCauCounts, key);

      const ccompChildren = (childrenByHead.get(token.id) ?? [])
        .filter((child) => child.relation === "ccomp");
      const embeddedSubjects = ccompChildren.flatMap((child) =>
        (childrenByHead.get(child.id) ?? [])
          .filter((candidate) => candidate.relation === "nsubj"
            || candidate.relation.startsWith("nsubj:"))
          .map((candidate) => candidate.form),
      );
      const examples = examplesByKey.get(key) ?? [];
      if (examples.length < 3) {
        examples.push({
          text: sentence.text,
          form: token.form,
          relation: token.relation,
          ccompForms: ccompChildren.map((child) => child.form),
          embeddedSubjects,
        });
        examplesByKey.set(key, examples);
      }

      if (ccompChildren.length === 0) continue;
      sameTokenCcompTokenCount += 1;
      increment(sameTokenCcompCounts, key);
      if (embeddedSubjects.length === 0) continue;
      sameTokenCcompOwnSubjectTokenCount += 1;
      increment(sameTokenCcompOwnSubjectCounts, key);
    }
  }
}

const currentAggregateEntryIds = new Set<string>();
const currentAggregateProfileIds = new Set<string>();
const sameTokenCcompEntryIds = new Set<string>();
const sameTokenCcompProfileIds = new Set<string>();
const sameTokenOwnSubjectEntryIds = new Set<string>();
const sameTokenOwnSubjectProfileIds = new Set<string>();
const aggregateOnlyTexts = new Set<string>();
const sameTokenCcompTexts = new Set<string>();
const sameTokenOwnSubjectTexts = new Set<string>();
const aggregateOnlySourceExamples: Record<string, readonly SourceExample[]> = {};

for (const profile of artifact.profiles) {
  const text = textByEntryId.get(profile.entryId);
  if (text === undefined) throw new Error(`profile references unknown entry ${profile.entryId}`);
  const morphology = profile.dependencyEvidence.morphologicalFeatureCounts;
  const hasVoiceCau = (morphology?.[REVIEWED_FEATURE] ?? 0) > 0;
  const hasAggregateCcomp = profile.valencyFrames.includes("clausal-complement");
  if (!hasVoiceCau || !hasAggregateCcomp) continue;

  currentAggregateProfileIds.add(profile.id);
  currentAggregateEntryIds.add(profile.entryId);
  const key = lexemeUposKey(text, profile.upos);
  if (sameTokenCcompCounts.has(key)) {
    sameTokenCcompProfileIds.add(profile.id);
    sameTokenCcompEntryIds.add(profile.entryId);
    sameTokenCcompTexts.add(text);
  } else {
    aggregateOnlyTexts.add(text);
    aggregateOnlySourceExamples[text] = examplesByKey.get(key) ?? [];
  }
  if (sameTokenCcompOwnSubjectCounts.has(key)) {
    sameTokenOwnSubjectProfileIds.add(profile.id);
    sameTokenOwnSubjectEntryIds.add(profile.entryId);
    sameTokenOwnSubjectTexts.add(text);
  }
}

const summary = {
  auditVersion: "causative-occurrence-evidence-v1",
  sourceCommit: UD_SOURCE_COMMIT,
  reviewedFeature: REVIEWED_FEATURE,
  source: {
    voiceCauTokenCount,
    voiceCauLexemeUposCount: voiceCauCounts.size,
    sameTokenCcompTokenCount,
    sameTokenCcompLexemeUposCount: sameTokenCcompCounts.size,
    sameTokenCcompOwnSubjectTokenCount,
    sameTokenCcompOwnSubjectLexemeUposCount: sameTokenCcompOwnSubjectCounts.size,
  },
  currentAggregateConsumer: {
    profileCount: currentAggregateProfileIds.size,
    entryCount: currentAggregateEntryIds.size,
  },
  supportedBySameTokenCcomp: {
    profileCount: sameTokenCcompProfileIds.size,
    entryCount: sameTokenCcompEntryIds.size,
    texts: sortedTexts(sameTokenCcompTexts),
  },
  supportedBySameTokenCcompOwnSubject: {
    profileCount: sameTokenOwnSubjectProfileIds.size,
    entryCount: sameTokenOwnSubjectEntryIds.size,
    texts: sortedTexts(sameTokenOwnSubjectTexts),
  },
  aggregateOnly: {
    profileCount: currentAggregateProfileIds.size - sameTokenCcompProfileIds.size,
    entryCount: currentAggregateEntryIds.size - sameTokenCcompEntryIds.size,
    texts: sortedTexts(aggregateOnlyTexts),
    sourceExamples: aggregateOnlySourceExamples,
  },
};

console.log(JSON.stringify(summary, null, 2));
