# Formal Syntax V2 comparative source evidence audit

## Question

Before rebuilding `clause.comparative`, determine what pinned Chinese GSD actually supports for the exact `比` comparative shape.

The current executable rule is:

```text
Subject + 比/ADP + NounPhrase(oblique) + AdjectivePhrase(predicate)
```

That rule currently treats an overt subject, an oblique-gated standard noun phrase, and an adjective-only predicate as one construction identity. This audit checks those assumptions separately.

## Reviewed source contract

Evidence contract:

`pinned-gsd-bi-comparative-shape-inventory-v1`

A reviewed marker occurrence is only an exact token with:

- surface form `比`;
- UPOS `ADP`;
- exact UD relation `case`.

The marker's head is treated as the comparative standard. The standard's head, when present, is treated as the governing comparative predicate for this source inventory.

This is a source-shape contract, not a complete semantic definition of comparison.

## Reviewed pinned boundary

Pinned Chinese GSD r2.18:

- source sentences: **4,997**
- ordinary tokens: **123,289**
- all surface `比` tokens: **50**
- exact `比/ADP(case)`: **41**
- recovered governing predicates: **41 / 41**
- governing predicate UPOS:
  - ADJ: **32**
  - VERB: **9**
- marker before standard: **41 / 41**
- standard before predicate: **41 / 41**
- predicates with overt subject: **25**
- predicates without overt subject: **16**
- predicate root: **9**
- predicate non-root: **32**

Standard-head relation:

- `nmod`: **31**
- `obl`: **8**
- `ccomp`: **1**
- `xcomp`: **1**

Standard-head UPOS:

- NOUN: **25**
- PART: **7**
- X: **4**
- PRON: **2**
- PROPN: **1**
- VERB: **2**

The simple NOUN/PROPN/PRON/NUM nominal subset covers **28 / 41** reviewed occurrences.

## Consequences for the current grammar

The current rule is not source-shaped in three important ways.

### 1. Overt subject is not construction identity

Only 25 of 41 reviewed predicates have an overt subject in the pinned occurrence. Subject realization therefore must not be baked into comparative construction identity merely because the old peer Clause rule requires one.

This does not by itself license arbitrary subject omission; subject realization remains owned by the argument-realization axis.

### 2. The standard is not an `oblique` lexical-role whitelist

Only 8 of 41 standard heads are annotated `obl`; 31 are `nmod`.

The grammar must therefore not require the standard noun's runtime profile to have independently been observed with an `oblique` function. The standard is a structural comparative role. Source dependency labels describe the occurrence, not a permanent lexical noun class.

### 3. Comparative predicates are not adjective-only

Nine of 41 reviewed governing predicates are VERB.

This is positive evidence that the construction cannot be represented only as `AdjectivePhrase`.

It is **not** permission to open the slot to every verb. The audit records governing predicate `form+UPOS` counts so a later identity-safe same-occurrence capability can license reviewed verbal comparative predicates without turning generic verbal predication into comparative predication.

## Product boundary

This audit does not change product behavior.

It does not:

- make every ADJ or VERB a comparative predicate;
- infer comparison from word meaning;
- treat all surface `比` tokens as comparative markers;
- use source frequency as curriculum probability;
- rewrite `clause.comparative` yet.

The next safe step is an active-profile identity join over the reviewed governing predicate `form+UPOS` frontier, followed by a construction rewrite that keeps comparative standard ownership structural and keeps argument realization orthogonal.
