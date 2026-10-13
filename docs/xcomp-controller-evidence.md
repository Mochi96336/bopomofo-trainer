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

The project pins `UD_Chinese-GSD` release `r2.18` at commit
`e0d85a020182e264d6384be2a59c0f4879a1cc35`.

The reviewed CI audit measures:

- sentences: **4,997**
- ordinary syntactic tokens: **123,289**
- basic `xcomp` occurrences: **1,924**
- enhanced external-subject `:xsubj` edges: **0**
- subject-controller occurrences: **0**
- object-controller occurrences: **0**
- other accepted controller occurrences: **0**
- unresolved xcomp occurrences: **1,924**
- basic matrix `obj + xcomp`: **208**
- unresolved basic `obj + xcomp`: **208**

Occurrence digest:

`614c21c9fc9b5953337801f26ae8f2a65482f152c8d93be12e543aeb2c72ede3`

So this source can support generic observed `xcomp` capability but cannot
distinguish subject-control from object-control lexical capability under the
accepted evidence rule.

The 208 basic `obj + xcomp` cases are especially important: **all 208 remain
unresolved**. Their coexistence therefore provides no safe shortcut to
object-control licensing.

That result is intentional and fail-closed: **zero controller-typed support is
better than projecting controller identity from an unsafe basic-tree heuristic.**

## Reproducible audit

The canonical CI-backed audit fetches the exact pinned source commit and verifies
the reviewed aggregate boundary:

```bash
npx tsx scripts/audit-xcomp-controller-source-evidence.ts --verify
```

It emits only aggregate counts and a deterministic structural occurrence digest;
it does not redistribute sentence text or lexical rows.

The older local Python audit remains useful as an implementation cross-check when
the external treebank is present under
`data/external/ud/chinese-gsd/r2.18`:

```bash
python scripts/audit-xcomp-controller-evidence.py
```

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

This audit does not add new runtime valency frames and does not change the active
catalog by itself.

Current runtime projection already maps basic `xcomp` only to
`open-clausal-complement`; it does not project either controller-typed frame.
The packaged valency-reachability audit likewise reports the predicate slots of
both live controller-specific Clause rules as zero-support.

Therefore the current GSD evidence does not justify keeping
`clause.xcomp-subject-control` or `clause.xcomp-object-control` executable
merely as hypothetical typed paths. Their structural distinction may be
preserved in migration documentation and reserved wire values, while executable
controller-specific rules should remain fail-closed until an approved source
actually provides controller-typed evidence.
