# Xcomp controller evidence

This note defines the evidence boundary for distinguishing subject control from object control in the Clause-model v2 `OpenClause` grammar.

## Structural fact versus lexical controller identity

A basic UD `xcomp` relation establishes an open clausal/predicative complement. It does not, by itself, identify which matrix argument is the controller.

The grammar therefore separates two questions:

1. Is an open complement structurally legal?
2. Which external matrix argument controls its unexpressed subject?

`clause.xcomp-subject-control` and `clause.xcomp-object-control` answer the first question by providing explicit structural shapes. Lexical admission to one controller type must be backed by controller evidence rather than inferred from the mere presence of an object.

## Accepted controller evidence

The audit accepts a controller only when Enhanced UD gives exactly one external-subject edge from the `xcomp` predicate to a basic matrix argument:

```text
matrix predicate
├─ nsubj/obj controller
└─ xcomp open predicate

controller DEPS includes:
  <xcomp-id>:nsubj:xsubj
```

Classification is then determined by the controller's basic relation to the matrix predicate:

- matrix `nsubj`/`csubj` + enhanced `nsubj:xsubj` -> subject controller
- matrix `obj`/`iobj` + enhanced `nsubj:xsubj` -> object controller
- zero or multiple matching enhanced controller edges -> unresolved

## What is not evidence

A matrix predicate having both a basic `obj` and a basic `xcomp` is **not** treated as object-control evidence.

Those two dependents can coexist without the object controlling the open complement. Therefore a rule such as:

```text
obj present + xcomp present -> object control
```

is forbidden as an evidence projection.

Likewise, lexical meaning, hand-written plausibility lists, or surface adjacency are not used to infer controller type.

## Chinese GSD r2.18 boundary

The project pins `UD_Chinese-GSD` release `r2.18`. The pinned train, dev, and test CoNLL-U splits contain basic `xcomp` relations, but inspection finds no `:xsubj` enhanced controller links in those splits.

Consequently, this source can support generic observed `xcomp` capability but cannot currently distinguish subject-control from object-control lexical capability under the evidence rule above.

That result is intentional and fail-closed: **zero controller-typed support is better than projecting controller identity from an unsafe basic-tree heuristic.**

## Reproducible audit

With the pinned external treebank files present under `data/external/ud/chinese-gsd/r2.18`:

```bash
python scripts/audit-xcomp-controller-evidence.py
```

The command validates the pinned source file sizes/checksums and emits only aggregate counts plus a determinism digest. It does not redistribute sentence text or lexical rows.

The relevant fields are:

- `xcompCount`
- `subjectControllerCount`
- `objectControllerCount`
- `otherControllerCount`
- `unresolvedCount`
- `basicObjectPlusXcompCount`
- `unresolvedBasicObjectPlusXcompCount`

`basicObjectPlusXcompCount` is diagnostic only. It must never be promoted to object-control support without an accepted enhanced controller edge.

## Runtime consequence

This audit does not add new runtime valency frames and does not change the active catalog by itself.

A later runtime-licensing change may consume controller-typed evidence only after an approved source actually provides it. Until then, Clause-model v2 must keep the distinction explicit rather than pretending the current GSD projection knows more than it does.
