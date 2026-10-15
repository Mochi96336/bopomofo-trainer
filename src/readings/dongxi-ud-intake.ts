/**
 * An attested UD source token is NOT a reading label: Translit=dōngxi does
 * not express the first-tone / neutral-second-syllable distinction.
 */
export interface DongxiUdCandidate {
  readonly id: string;
  readonly split: "train" | "dev" | "test";
  readonly sentId: string;
  readonly sourceFile: string;
  readonly sentence: string;
  readonly lexicalSourceToken: {
    readonly id: number;
    readonly form: "東西";
    readonly upos: "NOUN";
    readonly deprel: string;
    readonly translit: "dōngxi";
  };
  readonly preliminarySenseProposal: "directions" | "objects";
  readonly proposalStatus: "triage-only-not-adjudicated";
  readonly sourceReadingAnnotation: "not-disambiguated-in-UD-translit";
  readonly review: {
    readonly naturalness: "pending";
    readonly contextualSense: "pending";
    readonly contextualReading: "pending";
    readonly tokenization: "source-UD-token-attested-not-independently-reviewed";
  };
  readonly eligibleForTraining: false;
  readonly eligibleForProductRule: false;
}

export interface DongxiUdCorpus {
  readonly schemaVersion: "dongxi-ud-gsd-attested-review-candidates-v1";
  readonly source: {
    readonly corpus: "UD_Chinese-GSD";
    readonly repository: string;
    readonly commit: string;
    readonly annotationLicense: "CC BY-SA 4.0";
    readonly sourceTransliterationWarning: string;
  };
  readonly attestedIndependentTokenCount: number;
  readonly candidates: readonly DongxiUdCandidate[];
  readonly excludedSourceSubstringCases: readonly {
    readonly split: string;
    readonly sentId: string;
    readonly tokenId: number;
    readonly form: string;
    readonly exclusionReason: string;
  }[];
}

export interface DongxiUdIntakeSummary {
  readonly schemaVersion: "dongxi-ud-gsd-intake-report-v1";
  readonly independentlyTokenizedOccurrences: number;
  readonly splitCounts: Readonly<Record<"train" | "dev" | "test", number>>;
  readonly hypothesisCounts: Readonly<Record<"directions" | "objects", number>>;
  readonly excludedCompoundSubstringCount: number;
  readonly sourceReadingDisambiguated: false;
  readonly reviewedCorrectReadingLabels: 0;
  readonly modelTrainingReady: false;
  readonly productionActivationReady: false;
  readonly heldOutWarning: string;
}

/** Reject silently upgraded hypotheses, non-atomic substrings, and source
 * split tampering before an example can be considered for human review. */
export function validateDongxiUdIntake(value: DongxiUdCorpus): DongxiUdIntakeSummary {
  if (value.schemaVersion !== "dongxi-ud-gsd-attested-review-candidates-v1"
    || value.source.corpus !== "UD_Chinese-GSD"
    || value.source.repository !== "https://github.com/UniversalDependencies/UD_Chinese-GSD"
    || value.source.commit !== "22f73e87f7ddc530bb131a6b7587971a03e1a712"
    || value.source.annotationLicense !== "CC BY-SA 4.0") {
    throw new Error("unrecognized pinned source provenance or license");
  }
  const splitCounts = { train: 0, dev: 0, test: 0 };
  const hypothesisCounts = { directions: 0, objects: 0 };
  const seen = new Set<string>();
  for (const row of value.candidates) {
    if (!["train", "dev", "test"].includes(row.split)
      || row.sentId.match(/^(train|dev|test)-s[1-9]\d*$/)?.[1] !== row.split
      || row.sourceFile !== "zh_gsd-ud-" + row.split + ".conllu"
      || row.id !== "ud-gsd-" + row.sentId || seen.has(row.id)) {
      throw new Error("invalid, duplicate, or relocated source sentence ID");
    }
    seen.add(row.id);
    if ((row.sentence.match(/東西/gu) ?? []).length !== 1
      || !Number.isSafeInteger(row.lexicalSourceToken.id)
      || row.lexicalSourceToken.id < 1
      || row.lexicalSourceToken.form !== "東西"
      || row.lexicalSourceToken.upos !== "NOUN"
      || !row.lexicalSourceToken.deprel
      || row.lexicalSourceToken.translit !== "dōngxi") {
      throw new Error("candidate lacks one independently tokenized exact 東西 source occurrence");
    }
    if (row.proposalStatus !== "triage-only-not-adjudicated"
      || row.sourceReadingAnnotation !== "not-disambiguated-in-UD-translit"
      || row.review.naturalness !== "pending"
      || row.review.contextualSense !== "pending"
      || row.review.contextualReading !== "pending"
      || row.review.tokenization !== "source-UD-token-attested-not-independently-reviewed"
      || row.eligibleForTraining !== false
      || row.eligibleForProductRule !== false) {
      throw new Error("cannot promote source tokens or sense hypotheses into approved reading labels");
    }
    if (row.preliminarySenseProposal !== "directions" && row.preliminarySenseProposal !== "objects") {
      throw new Error("invalid candidate triage hypothesis");
    }
    splitCounts[row.split]++;
    hypothesisCounts[row.preliminarySenseProposal]++;
  }
  if (value.attestedIndependentTokenCount !== value.candidates.length
    || value.candidates.length !== 10
    || splitCounts.train !== 6 || splitCounts.dev !== 3 || splitCounts.test !== 1
    || hypothesisCounts.directions !== 5 || hypothesisCounts.objects !== 5) {
    throw new Error("pinned UD 東西 candidate inventory or split has drifted");
  }
  if (value.excludedSourceSubstringCases.length !== 1) {
    throw new Error("must preserve one explicit lexical-boundary negative control");
  }
  const negative = value.excludedSourceSubstringCases[0]!;
  if (negative.split !== "train" || negative.sentId !== "train-s816"
    || negative.form !== "東西向" || negative.tokenId !== 10
    || seen.has("ud-gsd-" + negative.sentId)) {
    throw new Error("compound 東西向 must not be mistaken for the exact 東西 token");
  }
  return {
    schemaVersion: "dongxi-ud-gsd-intake-report-v1",
    independentlyTokenizedOccurrences: value.candidates.length,
    splitCounts,
    hypothesisCounts,
    excludedCompoundSubstringCount: value.excludedSourceSubstringCases.length,
    sourceReadingDisambiguated: false,
    reviewedCorrectReadingLabels: 0,
    modelTrainingReady: false,
    productionActivationReady: false,
    heldOutWarning: "Only 1 test example (objects) and 3 dev examples (directions). These are not a representative, independently adjudicated accuracy benchmark.",
  };
}
