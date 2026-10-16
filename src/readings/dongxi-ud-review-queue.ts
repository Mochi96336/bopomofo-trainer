import {
  validateDongxiUdIntake, type DongxiUdCorpus,
} from "./dongxi-ud-intake.js";

/**
 * Independent review packet for the six GSD TRAIN source sentences only.
 * "Blind" here means that the reviewer does not receive the prior semantic
 * hypothesis or a guessed pronunciation. This is NOT a held-out test set.
 */
/** Intentional human-reviewed freeze of the entire blank reviewer handout.
 * Any copy change requires updating this pin in the same reviewed diff.
 * Git blob SHA is a change detector, not a human-independence guarantee. */
export const PINNED_DONGXI_HANDOUT_GIT_BLOB_SHA = "4e07d765044c4551229685370b048897cb3c8ea2";

export interface DongxiUdReviewQueue {
  readonly schemaVersion: "dongxi-ud-train-review-queue-v1";
  readonly sourceCommit: string;
  readonly scope: "source-train-only-not-held-out";
  readonly hypothesisDisclosure: "no-prior-sense-or-pronunciation-proposals";
  readonly approvedGoldLabels: 0;
  readonly eligibleForTraining: false;
  readonly eligibleForProductRule: false;
  readonly cases: readonly {
    readonly sourceId: string;
    readonly sourceTokenId: number;
    readonly target: "東西";
    readonly targetUtf16Offset: number;
    readonly sentence: string;
    readonly review: {
      readonly independentTokenization: "pending";
      readonly taiwanMandarinNaturalness: "pending";
      readonly contextualSense: "pending";
      readonly contextualReading: "pending";
    };
  }[];
}

export function buildDongxiUdTrainReviewQueue(source: DongxiUdCorpus): DongxiUdReviewQueue {
  validateDongxiUdIntake(source);
  const cases = source.candidates
    .filter(row => row.split === "train")
    .map(row => {
      const offset = row.sentence.indexOf("東西");
      if (offset < 0 || row.sentence.indexOf("東西", offset + 2) >= 0) {
        throw new Error("review target must be an unambiguous exact surface occurrence");
      }
      return {
        sourceId: row.id,
        sourceTokenId: row.lexicalSourceToken.id,
        target: "東西" as const,
        targetUtf16Offset: offset,
        sentence: row.sentence,
        review: {
          independentTokenization: "pending" as const,
          taiwanMandarinNaturalness: "pending" as const,
          contextualSense: "pending" as const,
          contextualReading: "pending" as const,
        },
      };
    });
  if (cases.length !== 6) throw new Error("expected exactly six GSD train review cases");
  return {
    schemaVersion: "dongxi-ud-train-review-queue-v1",
    sourceCommit: source.source.commit,
    scope: "source-train-only-not-held-out",
    hypothesisDisclosure: "no-prior-sense-or-pronunciation-proposals",
    approvedGoldLabels: 0,
    eligibleForTraining: false,
    eligibleForProductRule: false,
    cases,
  };
}

/** Strictly compare parsed reviewer-queue fixture against a fresh source
 * projection. Reject injected gold labels, guessed senses or extra source rows.
 * Validating this blank queue never approves a human review. */
function sameTree(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length
      && a.every((value, index) => sameTree(value, b[index]));
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keysA = Object.keys(left).sort();
  const keysB = Object.keys(right).sort();
  return keysA.length === keysB.length
    && keysA.every((key, i) => key === keysB[i] && sameTree(left[key], right[key]));
}

export function validateDongxiUdTrainReviewQueue(
  value: unknown, source: DongxiUdCorpus,
): { sourceTrainCases: 6; pendingIndependentReviews: 6; approvedGoldLabels: 0 } {
  if (!sameTree(value, buildDongxiUdTrainReviewQueue(source))) {
    throw new Error("UD train review queue drift or unapproved judgment/label was inserted");
  }
  return { sourceTrainCases: 6, pendingIndependentReviews: 6, approvedGoldLabels: 0 };
}

/**
 * Validate what human reviewers actually receive, not just the machine queue.
 * A correct source JSON does not protect a separately edited Markdown handout.
 * This gate checks source fidelity and obvious evidence/answer leakage; it
 * cannot prove a reviewer has never seen hypotheses elsewhere.
 */
export function validateDongxiUdReviewerHandout(
  markdown: string, source: DongxiUdCorpus,
): { reviewerCases: 6; sourceMatches: 6; approvedGoldLabels: 0 } {
  const expected = buildDongxiUdTrainReviewQueue(source).cases;
  const text = markdown.replaceAll("\r\n", "\n");
  const entries = [...text.matchAll(/^## R(\d{2})\n([^\n]+)$/gm)];
  if (entries.length !== expected.length) {
    throw new Error("reviewer handout must contain exactly the six numbered train sentences");
  }
  for (let i = 0; i < expected.length; i++) {
    if (entries[i]![1] !== String(i + 1).padStart(2, "0")
      || entries[i]![2] !== expected[i]!.sentence) {
      throw new Error("reviewer handout sentence text/order differs from pinned UD train source");
    }
  }
  if (source.candidates.some(row => row.split !== "train" && text.includes(row.sentence))) {
    throw new Error("reviewer handout exposes a dev/test sentence");
  }
  // These indicators belong in the organizer/source packet, never a reviewer handout.
  if (/\bud-gsd-(?:train|dev|test)-s\d+\b|preliminarySenseProposal|sourceTokenId|sourceCommit|Translit|dōngxi|ㄉㄨㄥ|ㄒㄧ|\bGSD\b|\bNOUN\b/u.test(text)) {
    throw new Error("reviewer handout contains source metadata or reading hints");
  }
  return { reviewerCases: 6, sourceMatches: 6, approvedGoldLabels: 0 };
}
