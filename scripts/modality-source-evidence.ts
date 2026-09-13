import {
  loadPinnedUdGsdOccurrenceSources,
  parseUdOccurrenceSentences,
  type UdOccurrenceToken,
} from "./ud-occurrence-source.js";

export const MODALITY_SOURCE_EVIDENCE_CONTRACT = "pinned-gsd-aux-feature-inventory-v1" as const;
export const PREVERBAL_AUX_EVIDENCE_CONTRACT = "same-token-exact-aux-preverbal-v1" as const;

const DIAGNOSTIC_FORMS = ["了", "著", "着", "過", "被", "是", "為", "爲"] as const;

function increment(target: Map<string, number>, key: string): void {
  target.set(key, (target.get(key) ?? 0) + 1);
}

function sortedRecord(values: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries([...values].sort(([left], [right]) => left.localeCompare(right, "zh-Hant")));
}

function featureItems(feats: string): readonly string[] {
  if (feats === "_" || feats.length === 0) return [];
  return feats.split("|").filter((item) => item.length > 0).sort();
}

function auxHeadPosition(token: UdOccurrenceToken): "preverbal" | "postverbal" | "root" {
  if (token.head === 0) return "root";
  return token.id < token.head ? "preverbal" : "postverbal";
}

interface MutableFormSummary {
  count: number;
  readonly relationCounts: Map<string, number>;
  readonly featureCounts: Map<string, number>;
}

export interface AuxFormEvidenceSummary {
  readonly count: number;
  readonly relationCounts: Readonly<Record<string, number>>;
  readonly featureCounts: Readonly<Record<string, number>>;
}

export interface ModalitySourceEvidenceSummary {
  readonly contract: typeof MODALITY_SOURCE_EVIDENCE_CONTRACT;
  readonly preverbalAuxEvidenceContract: typeof PREVERBAL_AUX_EVIDENCE_CONTRACT;
  readonly auxTokenCount: number;
  readonly auxFormCount: number;
  readonly relationCounts: Readonly<Record<string, number>>;
  readonly featureCounts: Readonly<Record<string, number>>;
  readonly featureSignatureCounts: Readonly<Record<string, number>>;
  readonly moodFeatureCounts: Readonly<Record<string, number>>;
  readonly verbTypeFeatureCounts: Readonly<Record<string, number>>;
  readonly auxRelationFormCounts: Readonly<Record<string, number>>;
  readonly auxPassRelationFormCounts: Readonly<Record<string, number>>;
  readonly auxRelationHeadPositionCounts: Readonly<Record<string, number>>;
  readonly preverbalAuxTokenCount: number;
  readonly postverbalAuxTokenCount: number;
  readonly preverbalAuxFormCounts: Readonly<Record<string, number>>;
  readonly postverbalAuxFormCounts: Readonly<Record<string, number>>;
  readonly preverbalAuxFeatureCounts: Readonly<Record<string, number>>;
  readonly postverbalAuxFeatureCounts: Readonly<Record<string, number>>;
  readonly diagnosticForms: Readonly<Record<string, AuxFormEvidenceSummary>>;
  readonly forms: Readonly<Record<string, AuxFormEvidenceSummary>>;
}

export function summarizeModalitySourceEvidence(
  sources: readonly string[],
): ModalitySourceEvidenceSummary {
  const relationCounts = new Map<string, number>();
  const featureCounts = new Map<string, number>();
  const featureSignatureCounts = new Map<string, number>();
  const moodFeatureCounts = new Map<string, number>();
  const verbTypeFeatureCounts = new Map<string, number>();
  const auxRelationFormCounts = new Map<string, number>();
  const auxPassRelationFormCounts = new Map<string, number>();
  const auxRelationHeadPositionCounts = new Map<string, number>();
  const preverbalAuxFormCounts = new Map<string, number>();
  const postverbalAuxFormCounts = new Map<string, number>();
  const preverbalAuxFeatureCounts = new Map<string, number>();
  const postverbalAuxFeatureCounts = new Map<string, number>();
  const forms = new Map<string, MutableFormSummary>();
  let auxTokenCount = 0;
  let preverbalAuxTokenCount = 0;
  let postverbalAuxTokenCount = 0;

  const visit = (token: UdOccurrenceToken): void => {
    if (token.upos !== "AUX") return;
    auxTokenCount += 1;
    increment(relationCounts, token.relation);

    const features = featureItems(token.feats);
    if (token.relation === "aux") {
      increment(auxRelationFormCounts, token.form);
      const position = auxHeadPosition(token);
      increment(auxRelationHeadPositionCounts, position);
      if (position === "preverbal") {
        preverbalAuxTokenCount += 1;
        increment(preverbalAuxFormCounts, token.form);
        for (const feature of features) increment(preverbalAuxFeatureCounts, feature);
      } else if (position === "postverbal") {
        postverbalAuxTokenCount += 1;
        increment(postverbalAuxFormCounts, token.form);
        for (const feature of features) increment(postverbalAuxFeatureCounts, feature);
      }
    }
    if (token.relation === "aux:pass") increment(auxPassRelationFormCounts, token.form);

    increment(featureSignatureCounts, features.length === 0 ? "_" : features.join("|"));
    for (const feature of features) {
      increment(featureCounts, feature);
      if (feature.startsWith("Mood=")) increment(moodFeatureCounts, feature);
      if (feature.startsWith("VerbType=")) increment(verbTypeFeatureCounts, feature);
    }

    const form = forms.get(token.form) ?? {
      count: 0,
      relationCounts: new Map<string, number>(),
      featureCounts: new Map<string, number>(),
    };
    form.count += 1;
    increment(form.relationCounts, token.relation);
    for (const feature of features) increment(form.featureCounts, feature);
    forms.set(token.form, form);
  };

  for (const source of sources) {
    for (const sentence of parseUdOccurrenceSentences(source)) {
      for (const token of sentence) visit(token);
    }
  }

  const finalForms = Object.fromEntries([...forms]
    .sort(([left], [right]) => left.localeCompare(right, "zh-Hant"))
    .map(([form, summary]) => [form, {
      count: summary.count,
      relationCounts: sortedRecord(summary.relationCounts),
      featureCounts: sortedRecord(summary.featureCounts),
    }]));
  const diagnosticForms = Object.fromEntries(DIAGNOSTIC_FORMS
    .filter((form) => finalForms[form] !== undefined)
    .map((form) => [form, finalForms[form]!]));

  return {
    contract: MODALITY_SOURCE_EVIDENCE_CONTRACT,
    preverbalAuxEvidenceContract: PREVERBAL_AUX_EVIDENCE_CONTRACT,
    auxTokenCount,
    auxFormCount: forms.size,
    relationCounts: sortedRecord(relationCounts),
    featureCounts: sortedRecord(featureCounts),
    featureSignatureCounts: sortedRecord(featureSignatureCounts),
    moodFeatureCounts: sortedRecord(moodFeatureCounts),
    verbTypeFeatureCounts: sortedRecord(verbTypeFeatureCounts),
    auxRelationFormCounts: sortedRecord(auxRelationFormCounts),
    auxPassRelationFormCounts: sortedRecord(auxPassRelationFormCounts),
    auxRelationHeadPositionCounts: sortedRecord(auxRelationHeadPositionCounts),
    preverbalAuxTokenCount,
    postverbalAuxTokenCount,
    preverbalAuxFormCounts: sortedRecord(preverbalAuxFormCounts),
    postverbalAuxFormCounts: sortedRecord(postverbalAuxFormCounts),
    preverbalAuxFeatureCounts: sortedRecord(preverbalAuxFeatureCounts),
    postverbalAuxFeatureCounts: sortedRecord(postverbalAuxFeatureCounts),
    diagnosticForms,
    forms: finalForms,
  };
}

export async function auditPinnedModalitySourceEvidence(): Promise<ModalitySourceEvidenceSummary> {
  return summarizeModalitySourceEvidence(await loadPinnedUdGsdOccurrenceSources());
}
