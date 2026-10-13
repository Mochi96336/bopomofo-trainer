export const FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS = {
  "clause.topic-comment": {
    status: "evidence-blocked",
    grammarCategory: "Clause",
    legacyVerbPhraseConstituentKey: "comment",
    evidenceContract: "pinned-gsd-topic-dislocation-inventory-v1",
    nextPhase: "information-structure",
    note: "Pinned GSD dislocated evidence is a negative licensing boundary rather than a productive Mandarin topic signal. Keep the current legacy path explicit and defer structural replacement until a narrower topic/dislocation source is approved.",
  },
  "sentence.constituent-subject-question": {
    status: "evidence-blocked",
    grammarCategory: "Sentence",
    legacyVerbPhraseConstituentKey: "predicate",
    evidenceContract: "pinned-gsd-licensed-wh-direct-subject-shape-inventory-v1",
    nextPhase: "interrogatives",
    note: "Only 9 direct interrogative-subject occurrences are reviewed and only 1 has a root governing head. The current root template is not source-aligned enough for a safe rewrite; keep it as an explicit deferred frontier rather than broadening Predicate or inventing root coverage.",
  },
} as const;

export type FormalSyntaxV2EvidenceBlockedFrontierId =
  keyof typeof FORMAL_SYNTAX_V2_EVIDENCE_BLOCKED_FRONTIERS;
