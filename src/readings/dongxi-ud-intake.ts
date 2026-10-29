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

/** Verified against the immutable upstream UD CoNLL-U at source.commit.
 * This second, independently pinned list prevents source JSON and review JSON
 * drifting together while both continue to pass shape/count-only checks.
 * Sentence strings are source provenance, not approved reading labels. */
const PINNED_UPSTREAM_SOURCE_FACTS = {
  "train-s681": {
    "sentence": "有了這兩東西，人類生存了。",
    "tokenId": 5,
    "deprel": "obj"
  },
  "train-s1643": {
    "sentence": "海光寺路口也成為天津市東西和南北方向的交通要衝，常年交通擁堵。",
    "tokenId": 9,
    "deprel": "nmod"
  },
  "train-s2287": {
    "sentence": "我承認當時我踢的足球不像現在和在阿賈克斯踢的這麼漂亮，可是作為一名運動員，我學到了不少東西。",
    "tokenId": 31,
    "deprel": "obj"
  },
  "train-s2541": {
    "sentence": "面對不可能和疑問，理性的人就只有放棄或否認，並永遠為失去的東西而悲傷。",
    "tokenId": 21,
    "deprel": "nmod"
  },
  "train-s3688": {
    "sentence": "學民思潮召集人黃之鋒聞言舉起《中國模式國情專題教學手冊》，表示「此東西都是由大學所寫的」。",
    "tokenId": 21,
    "deprel": "ccomp"
  },
  "train-s3831": {
    "sentence": "市境東西寬106公里，南北寬111公里，總面積4058平方公里。",
    "tokenId": 2,
    "deprel": "nsubj"
  },
  "dev-s34": {
    "sentence": "北京外城共有七門，南面三門，東西各一門，此外還有兩座便門。",
    "tokenId": 12,
    "deprel": "conj"
  },
  "dev-s35": {
    "sentence": "瓮城為元朝末年所修，因為當時崇仁門為東垣正中城門，因此瓮城幾乎為正方形，南北寬68米，東西深62米，南面辟閘樓、券門。",
    "tokenId": 30,
    "deprel": "nsubj"
  },
  "dev-s312": {
    "sentence": "校園中有一條南北向的大道將校園分成東西兩部。",
    "tokenId": 12,
    "deprel": "obj"
  },
  "test-s354": {
    "sentence": "始鏡猴科有可以抓住東西的手及腳，手指及腳趾有指甲而沒有爪。",
    "tokenId": 6,
    "deprel": "obj"
  }
} as const;

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
    const pinned = PINNED_UPSTREAM_SOURCE_FACTS[row.sentId as keyof typeof PINNED_UPSTREAM_SOURCE_FACTS];
    if (!pinned || row.sentence !== pinned.sentence
      || row.lexicalSourceToken.id !== pinned.tokenId
      || row.lexicalSourceToken.deprel !== pinned.deprel) {
      throw new Error("pinned UD source sentence/token facts differ from verified upstream CoNLL-U");
    }
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
