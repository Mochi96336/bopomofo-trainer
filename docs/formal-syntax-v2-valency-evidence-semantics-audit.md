# Formal Syntax V2: valency evidence semantics audit

## Status

Audit-only follow-up to #212 on current `main` (`a9d7858cda17f244c6fecd08a522c00830f6499c`).

This change does **not** alter grammar rules, runtime profiles, product sampling, construction activation, Measurement V2, or #221. It adds a diagnostic boundary so the next implementation step can change ownership without silently changing product behavior.

## The question

Formal Syntax V2 wants this separation:

```text
corpus occurrence
  -> evidence
  -> lexical / occurrence capability
  -> grammar constraint
  -> realized Clause arguments
```

The current projection still collapses two different statements:

1. **lexical capability** — what complements a predicate is licensed to take;
2. **argument realization** — what dependents happened to be overt in one corpus occurrence.

Those are not interchangeable.

## Current projection behavior

`src/syntax/profile-projection.ts` derives lexical-looking `ValencyFrame` values from aggregate `valencySignatureCounts`.

Today:

- any observed `obj` adds `transitive`;
- any observed `iobj` adds `ditransitive`;
- any observed `ccomp` adds `clausal-complement`;
- any observed `xcomp` adds `open-clausal-complement`;
- any observed base `obl` adds `adpositional-complement`;
- any occurrence with none of `obj | iobj | ccomp | xcomp | obl` adds `intransitive`;
- if nominal-object evidence and one such complementless occurrence coexist in the aggregate profile, `ambitransitive` is added.

The last two bullets are the problem: absence of an overt complement is being promoted into a lexical capability claim.

## Why mixed object evidence is not lexical ambitransitivity

Consider the same predicate across two occurrences:

```text
我吃飯
我吃過了
```

The corpus may observe:

```text
occurrence A: obj=1
occurrence B: none
```

This proves:

```text
object-bearing realization observed
objectless realization observed
```

It does **not** by itself prove:

```text
lexically transitive + lexically intransitive
```

The second occurrence can be ordinary argument omission. Chinese allows extensive context-driven omission, so the missing object must remain a realization fact unless a separate lexical-capability contract justifies a stronger claim.

The existing reachability audit reports 629 distinct catalog entries with `ambitransitive` support. Under the current implementation, `ambitransitive` has only one derivation path: aggregate object-bearing evidence plus at least one complementless occurrence. Therefore that support set must not be described as independently reviewed lexical ambitransitivity.

## Why objectless-only evidence is still provisional

For a predicate observed only as:

```text
他走
```

`none` / subject-only valency signatures are strong evidence that an objectless realization is grammatical in the corpus.

They still do not logically prove that the predicate can never take an object in another sense or construction. For V2, the safe ownership is:

```text
occurrence evidence:
  objectless realization observed

lexical capability:
  separate, positive contract
```

This audit does not remove current `intransitive` projection yet because doing so would change runtime reachability and product output. It marks the inference as provisional so it can be migrated deliberately.

## Why generic `obl` is also provisional

The UD projector currently reduces dependency labels to their base relation before predicate-side valency aggregation.

That means:

```text
obl:patient
obl:agent
obl:<other subtype>
plain obl
```

all become:

```text
obl
```

The current profile projection then turns any `obl` into:

```text
adpositional-complement
```

But base `obl` alone cannot distinguish a selected lexical complement from an adjunct, nor can it preserve BA/passive construction roles. The existing reachability audit reports 1,407 distinct catalog entries with `adpositional-complement` support; that number is reachability evidence, not proof that 1,407 entries have a reviewed lexical adpositional-complement capability.

## The ownership rule going forward

Use this rule consistently:

```text
Predicate capability
  = positive evidence that a predicate licenses a relation / construction

Clause realization
  = which licensed participants are overt in this occurrence
```

Examples:

```text
他走
  predicate: 走
  realization: subject overt, no object overt

他吃飯
  predicate: 吃
  positive evidence: obj observed
  realization: subject + object overt

他吃了
  predicate: 吃
  lexical object capability does not disappear
  realization: object omitted

他給我一本書
  predicate: 給
  positive evidence: iobj / obj pattern
  realization: subject + indirect object + object overt
```

The important consequence is that `clause.intransitive` and `clause.object-omission` cannot continue to be distinguished merely by treating object absence as a lexical frame.

## Diagnostic added by this audit

`auditValencyEvidenceSemantics()` reads the full source evidence artifact and separately reports:

- profiles with mixed nominal-object realization;
- profiles where complementless occurrences currently feed `intransitive`;
- profiles where mixed aggregate occurrences currently feed `ambitransitive`;
- profiles where base `obl` currently feeds `adpositional-complement`.

It is intentionally not imported by grammar generation or product selection.

Run it against a generated UD syntax evidence artifact with:

```sh
npx tsx scripts/audit-valency-evidence-semantics.ts <ud-syntax-evidence.json>
```

## What this audit decides

### Keep

- positive `obj` evidence as evidence of object-taking capability;
- positive `iobj` evidence as evidence of indirect-object behavior;
- positive `ccomp` evidence as generic finite-clausal-complement capability;
- positive `xcomp` evidence as generic open-clausal-complement capability;
- same-occurrence capabilities for claims that require multiple facts on one token occurrence.

### Do not treat as final lexical truth

- `none -> intransitive`;
- mixed object-bearing + objectless occurrences -> lexical `ambitransitive`;
- base `obl -> adpositional-complement`.

### Do not change yet

- product probabilities;
- grammar rule inventory;
- runtime syntax-profile artifact;
- construction selection;
- causative activation;
- #221;
- Measurement V2 / progress.

## Next implementation slice

The next non-audit PR should be small and staged:

1. preserve explicit occurrence-level argument-realization evidence instead of reinterpreting absence immediately;
2. introduce/derive positive predicate capability separately from realization diagnostics;
3. migrate the ordinary `他走 / 他吃飯 / 他吃了 / 他給我一本書` paths first;
4. compare legality and candidate-distribution deltas before any product-facing switch;
5. only then retire the provisional `ambitransitive` inference and revisit `intransitive` naming/ownership;
6. keep BA/passive/xcomp activation blocked until this foundation is stable.

This avoids a framework rewrite: the current grammar can remain executable while ownership moves one seam at a time.
