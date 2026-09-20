# Formal Syntax V2 — locative source evidence audit

## Question

`clause.locative` is still marked `hold-for-corpus-rebuild` / `locative:TBD` in the Clause Model V2 migration inventory.

The legacy executable rule is:

`Subject + copula + AdpositionPhrase`

Before changing that rule, this audit asks which locative-looking **syntactic shapes** are actually present in the pinned Chinese GSD source. It deliberately does not equate every location-marked phrase with a locative clause.

## Source boundary

- provenance: `ud:chinese-gsd-r2.18`
- version: `r2.18`
- pinned commit: `e0d85a020182e264d6384be2a59c0f4879a1cc35`
- evidence contract: `pinned-gsd-locative-shape-inventory-v1`
- sentences: **4,997**
- ordinary integer-ID tokens: **123,289**

No source sentence text, definitions, glosses, or semantic labels are retained.

## Reviewed structural inventory

The surface form `在` appears **1,644** times:

- `ADP`: **1,061**
- `VERB`: **555**
- `ADV`: **28**

### Verbal `在`

Among the **555** `在/VERB` tokens:

- root: **21**
- root + direct subject: **20**
- root + direct object: **13**
- root + direct subject + direct object: **12**
- any direct subject: **66**
- any direct `obj|obl` nominal complement: **447**

The narrowest high-confidence candidate for a dedicated verbal-locative predicate shape is therefore the same-occurrence structure:

`在/VERB(root) + nsubj + obj`

The pinned source contains **12** such occurrences.

This is positive syntactic evidence only. It is not a corpus-derived productivity probability and it does not justify treating every `在/VERB` occurrence as the same construction.

### Adpositional `在`

There are **1,050** exact `在/ADP -> case` tokens.

Of these:

- nominal head relation `obl`: **825**
- nominal head is root: **3**
- nominal head has both direct `cop` and subject: **2**

The **825** ordinary `在`-marked obliques attach overwhelmingly to another predicate:

- predicate head found: **825**
- predicate head is `VERB`: **821**

This is strong evidence that the dominant `在 + location` pattern in this source is an **oblique dependent of another predicate**, not a peer locative-Clause identity.

The most frequent governing predicates include `有`, `發生`, `出現`, `開始`, `進行`, `居住`, `住`, `存在`, and many ordinary non-locative verbs. Therefore an `obl` marked by `在` must not itself license a locative predicate family.

### Copular `在`-case shape

Only **2** `在/ADP -> case` nominal heads simultaneously have a direct copula and subject in the pinned source.

This does not prove the surface pattern is ungrammatical. It does show that the current executable `Subject + copula + AdpositionPhrase` rule is **not the dominant locative-looking structure represented by this pinned source**, so it should not be treated as the sole evidence-backed locative frame.

### Existential boundary

`有/VERB` remains separate:

- total: **603**
- root: **254**
- with a `在`-marked oblique: **35**

The audit therefore keeps existential/presentational evidence distinct from verbal `在` predication and from ordinary predicate + locative-oblique structure.

## Decision boundary

This audit does **not** change executable grammar.

It establishes three separations that the next Clause V2 step must preserve:

1. **verbal locative predication candidate** — narrow same-occurrence `在/VERB(root) + nsubj + obj`;
2. **locative oblique** — `在/ADP(case)` attached to an `obl` nominal under another predicate;
3. **existential/presentational structure** — remains independently owned and must not be reconstructed from either pattern above.

The old peer `clause.locative` rule should not be retired until an executable replacement preserves these distinctions and has lexical reachability / product migration evidence.
