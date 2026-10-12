# Formal Syntax V2 ccomp source evidence audit

## Question

Before rebuilding `clause.object-content`, determine what pinned Chinese GSD
actually supports for finite clausal complements.

Current executable shape:

```text
NounPhrase?
+ Predicate[clausal-complement]
+ ContentClause[requiredFunctions: object]
```

That shape mixes three questions which must stay separate:

1. how the matrix subject is realized;
2. which lexical heads license `ccomp`;
3. how the embedded clause is structurally related to the matrix predicate.

## Reviewed source contract

Evidence contract:

`pinned-gsd-ccomp-shape-inventory-v1`

A reviewed occurrence is an ordinary pinned Chinese GSD token whose base
dependency relation is exactly `ccomp`. The ccomp token is treated as the head
of the embedded clause; its governor is treated as the matrix/governing head.

This is a source-shape inventory. It does not claim that every UD ccomp shape
should become one productive Mandarin construction.

## Reviewed pinned boundary

Pinned Chinese GSD r2.18:

- source sentences: **4,997**
- ordinary tokens: **123,289**
- ccomp occurrences: **2,156**
- recovered governing heads: **2,156 / 2,156**

### Matrix/governing heads

UPOS:

- VERB: **2,075**
- ADP: **33**
- NOUN: **20**
- ADJ: **16**
- ADV: **6**
- PART: **3**
- NUM / PRON / PROPN: **1** each

The governing-head identity inventory contains **650** form+UPOS identities,
pinned by SHA-256:

`48718393004dd9e432e5019692eaac7801552620502f430c7e0078b9eafe8629`

Most governors are verbal, but the source frontier is not strictly verb-only.
The current transitional `Predicate` category is VERB-only, so the generic
ccomp source boundary is wider than the executable rule. This audit does not
automatically promote the non-verbal tail into product grammar.

### Matrix subject realization

Among the 2,156 ccomp governors:

- with an overt subject: **1,298**
- without an overt subject: **858**
- with nominal subject relation: **1,190**
- with clausal subject relation: **108**

The 108 clausal-subject governors are direct evidence that a bare
`NounPhrase?` slot is too narrow as the structural matrix-subject type.

The shared Clause-model V2 `Subject` wrapper already separates:

```text
Subject
├─ argument.subject.noun   -> NounPhrase
└─ argument.subject.clause -> ContentClause
```

so a future rewrite can use `Subject?` without converting clausal subjecthood
into a lexical function requirement.

### Embedded clause realization

The ccomp heads themselves have these UPOS counts:

- VERB: **1,769**
- NOUN: **193**
- ADJ: **140**
- PART: **33**
- PROPN: **9**
- NUM: **5**
- ADP / ADV / AUX: **2** each
- X: **1**

There are **1,280** ccomp-head form+UPOS identities, pinned by:

`060b1b5e3aea3b26ff04a9b5efd3c96142c06d0ecb99b35512a4a34ae1c470af`

Embedded subject realization:

- with overt subject: **2,123**
- without overt subject: **33**
- with nominal subject relation: **2,065**
- with clausal subject relation: **59**

This strongly supports keeping the embedded content as a recursive ordinary
`Clause`, because its own predicate frame and Subject realization vary
independently of the matrix embedding relation.

### ccomp is not an Object slot

Among ccomp governors:

- with a separate `obj` child: **155**
- without a separate `obj` child: **2,001**
- with an additional ccomp child: **116**
- with xcomp child: **117**
- with iobj child: **0**

A matrix predicate can therefore host both a direct object and a ccomp in the
same occurrence. Treating the `ContentClause` as an `object` role is not a
faithful representation of the UD relation.

This is also consistent with the runtime projection: `ccomp` maps to the
syntactic function `complement`, while `obj` maps to `object`.

The current `requiredFunctions:["object"]` on the nonterminal
`ContentClause` is additionally not inherited into its embedded lexical
material. It is therefore both conceptually misleading and not an effective
same-role evidence gate.

### Surface order and embedding context

- ccomp before governor: **316**
- ccomp after governor: **1,840**
- governor root: **1,032**
- governor non-root: **1,124**
- ccomp with a `mark` child: **435**
- ccomp without a `mark` child: **1,721**

So post-governor ccomp is dominant but not universal, and the matrix predicate
itself is almost evenly split between root and embedded contexts.

The existing single canonical surface order remains a separate modeling issue;
this audit does not infer product ordering weights from corpus counts.

## Migration consequences

### 1. Matrix Subject should use the shared structural role

Replacing:

```text
NounPhrase?
```

with:

```text
Subject?
```

is supported by the source inventory because 108 reviewed matrix governors have
a clausal subject. Subject omission remains an orthogonal realization choice.

### 2. ContentClause should be a complement, not an object-labelled clause

The 155 co-occurring obj+ccomp cases prove that the ccomp relation cannot be
identified with the direct-object slot. The embedding construction should own a
clausal complement edge without imposing a permanent object function on the
embedded clause.

### 3. Predicate coverage remains an explicit frontier

The current matrix `Predicate` is VERB-only, while 81 / 2,156 reviewed
governors are non-VERB. The largest tails are ADP 33, NOUN 20, and ADJ 16.

That discrepancy must not be hidden by the Subject/complement cleanup. A later
slice should decide which non-verbal governor shapes represent productive
matrix predication versus UD analysis artifacts or other constructions.

## Product boundary

This audit changes no executable grammar or product sampling.

It does not:

- replace the matrix NounPhrase with Subject yet;
- remove the legacy object function label yet;
- broaden Predicate beyond VERB;
- infer a preferred ccomp order from 316 / 1,840;
- infer product incidence from 2,156 source occurrences.

The next safe implementation is a narrow structural cleanup of matrix Subject
ownership and ccomp complement ownership, followed by a deterministic migration
audit before merge.
