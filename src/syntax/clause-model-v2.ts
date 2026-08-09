export const CLAUSE_MODEL_V2_AXES = [
  "predicate-frame",
  "argument-construction",
  "predicate-marking",
  "argument-realization",
  "information-structure",
  "embedding",
  "predicate-structure",
] as const;

export type ClauseModelV2Axis = (typeof CLAUSE_MODEL_V2_AXES)[number];

export const CLAUSE_MODEL_V2_MIGRATION_GROUPS = [
  "preserve-core",
  "move-to-axis",
  "rebuild-construction",
  "rebuild-embedding-control",
  "hold-for-corpus-rebuild",
] as const;

export type ClauseModelV2MigrationGroup =
  (typeof CLAUSE_MODEL_V2_MIGRATION_GROUPS)[number];

export interface ClauseRuleV2Migration {
  readonly group: ClauseModelV2MigrationGroup;
  readonly targetAxis: ClauseModelV2Axis;
  readonly target: string;
  readonly note: string;
}

/**
 * Migration inventory for every current v1 `Clause` production.
 *
 * This is deliberately not a sampling taxonomy. It records which orthogonal
 * grammatical dimension should own each legacy production while v1 remains the
 * executable runtime. A follow-up may change legality only after the target
 * dimension has an executable representation and evidence contract.
 */
export const CURRENT_CLAUSE_RULE_V2_MIGRATION = {
  "clause.nominal-predicate": {
    group: "preserve-core",
    targetAxis: "predicate-frame",
    target: "nominal",
    note: "Keep as a core predication frame; tighten lexical/structural licensing separately.",
  },
  "clause.adjective-predicate": {
    group: "preserve-core",
    targetAxis: "predicate-frame",
    target: "adjectival",
    note: "Keep as a core predication frame.",
  },
  "clause.intransitive": {
    group: "preserve-core",
    targetAxis: "predicate-frame",
    target: "verbal.intransitive",
    note: "Keep as a lexical valency frame.",
  },
  "clause.transitive": {
    group: "preserve-core",
    targetAxis: "predicate-frame",
    target: "verbal.transitive",
    note: "Keep as a lexical valency frame; object ownership must be made single-source.",
  },
  "clause.ditransitive": {
    group: "preserve-core",
    targetAxis: "predicate-frame",
    target: "verbal.ditransitive",
    note: "Keep as a lexical valency frame; argument ownership must be made single-source.",
  },
  "clause.copular": {
    group: "preserve-core",
    targetAxis: "predicate-frame",
    target: "copular",
    note: "Keep as a core predication frame backed by copular dependency evidence.",
  },
  "clause.existential": {
    group: "preserve-core",
    targetAxis: "predicate-frame",
    target: "existential",
    note: "Keep provisionally as a core frame; separate existential from possessive uses by evidence.",
  },

  "clause.modal": {
    group: "move-to-axis",
    targetAxis: "predicate-marking",
    target: "modality",
    note: "Modality combines with predicate frames and must not compete with them as a Clause family.",
  },
  "clause.negative": {
    group: "move-to-axis",
    targetAxis: "predicate-marking",
    target: "polarity",
    note: "Negation combines with predicate frames and other markings.",
  },
  "clause.aspect": {
    group: "move-to-axis",
    targetAxis: "predicate-marking",
    target: "aspect",
    note: "Aspect combines with predicate frames and other markings.",
  },
  "clause.subject-omission": {
    group: "move-to-axis",
    targetAxis: "argument-realization",
    target: "subject.omitted",
    note: "Omission changes surface realization, not lexical valency or core Clause identity.",
  },
  "clause.object-omission": {
    group: "move-to-axis",
    targetAxis: "argument-realization",
    target: "object.omitted",
    note: "Omission changes surface realization while preserving an object-capable predicate frame.",
  },
  "clause.topic-comment": {
    group: "move-to-axis",
    targetAxis: "information-structure",
    target: "topic-dislocation",
    note: "Model as a dislocated/topic constituent over a core Clause rather than NP + VP as a peer frame.",
  },

  "clause.ba": {
    group: "rebuild-construction",
    targetAxis: "argument-construction",
    target: "ba",
    note: "Rebuild around patient/disposal dependency structure rather than a generic object slot.",
  },
  "clause.bei": {
    group: "rebuild-construction",
    targetAxis: "argument-construction",
    target: "passive.short|passive.long",
    note: "Split short AUX passive from long ADP + overt-agent passive.",
  },
  "clause.comparative": {
    group: "rebuild-construction",
    targetAxis: "argument-construction",
    target: "comparative",
    note: "Keep the construction but re-derive the licensed predicate/complement shapes from evidence.",
  },

  "clause.subject-content": {
    group: "rebuild-embedding-control",
    targetAxis: "embedding",
    target: "subject-clause",
    note: "Rebuild from clausal-subject evidence.",
  },
  "clause.object-content": {
    group: "rebuild-embedding-control",
    targetAxis: "embedding",
    target: "ccomp",
    note: "Represent a finite content complement through the clausal-complement relation.",
  },
  "clause.complement-content": {
    group: "rebuild-embedding-control",
    targetAxis: "embedding",
    target: "xcomp",
    note: "Requires executable subject-control constraints; an arbitrary embedded Clause is too broad.",
  },
  "clause.quoted-content": {
    group: "rebuild-embedding-control",
    targetAxis: "embedding",
    target: "quotation",
    note: "Keep quotation as an embedding shape while reviewing the allowed quoted root categories.",
  },
  "clause.pivotal": {
    group: "rebuild-embedding-control",
    targetAxis: "predicate-structure",
    target: "object-control",
    note: "Prefer an obj + xcomp/control representation over a bespoke pivot lexical role.",
  },

  "clause.locative": {
    group: "hold-for-corpus-rebuild",
    targetAxis: "predicate-frame",
    target: "locative:TBD",
    note: "Current copula + adposition rule is narrower than Mandarin locative predication; rebuild from observed patterns.",
  },
  "clause.causative": {
    group: "hold-for-corpus-rebuild",
    targetAxis: "predicate-structure",
    target: "causative:TBD",
    note: "Do not preserve the legacy valency label until the evidence pipeline can actually derive it.",
  },
  "clause.serial-verb": {
    group: "hold-for-corpus-rebuild",
    targetAxis: "predicate-structure",
    target: "serial:TBD",
    note: "Do not treat arbitrary VP + VP as serial-verb without a dependency-pattern contract.",
  },
} as const satisfies Readonly<Record<string, ClauseRuleV2Migration>>;
