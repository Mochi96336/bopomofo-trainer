# Causative evidence-shape audit

This audit exists because the formal grammar currently declares a legacy
`causative` valency frame, while the runtime profile projector never derives
that frame. The resulting zero-support measurement does **not** mean that the
pinned UD source contains no causative annotation.

Chinese GSD r2.18 explicitly annotates causative-marked tokens with the
morphological feature `Voice=Cau`. The full syntax-evidence artifact preserves
morphological feature counts, while the compact runtime syntax profile does not.
Therefore causative morphology and verbal valency must not be conflated.

## Question being measured

For every basic CoNLL-U token with `Voice=Cau`, classify the basic dependency
shape around that token without assigning a new project grammar category.

The audit records:

- causative token count
- UPOS and head-relation distributions
- valency-signature distribution
- direct subject/object occurrence
- `ccomp` and `xcomp` occurrence
- whether a `ccomp`/`xcomp` child has its own basic subject
- whether `ccomp`/`xcomp` co-occurs with a direct matrix object

The output is aggregate-only and contains no sentence text or per-token lexical
rows.

## Why `Voice=Cau` is not a `causative` valency frame

`Voice=Cau` says that the annotated token is causative-marked. It does not by
itself specify which argument structure follows that token.

Two structurally different shapes must remain distinguishable:

```text
causative
  └─ ccomp -> embedded predicate
               └─ nsubj -> embedded subject/causee
```

and

```text
causative
  ├─ obj   -> matrix object/causee
  └─ xcomp -> subjectless embedded predicate
```

The first shape is not an object-control `OpenClause`: the embedded predicate
has its own overt subject. The second shape is only a candidate for object
control; basic `obj + xcomp` remains insufficient to identify the controller
without the controller-evidence contract defined by the xcomp audit.

## Runtime boundary

This audit does not change:

- `ValencyFrame`
- compact runtime syntax profiles
- lexical construction feature matching
- canonical grammar productions
- syntax sampling
- the runtime lock

A later migration may choose to preserve more causative morphology in runtime
or split causative constructions by dependency shape. That decision must be
based on the measured source distribution rather than by mapping every
`Voice=Cau` token to one legacy rule.

## Reproduction

With the pinned Chinese GSD r2.18 source materialized at the normal source
location:

```sh
python scripts/audit-causative-evidence.py
```

The CLI validates the pinned source file size/checksum contract before counting
and emits a deterministic aggregate digest.
