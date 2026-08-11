# Formal syntax v2: Clause model foundation

## Status

This document defines the migration boundary from the executable
`mandarin-formal-grammar-v1` Clause inventory toward an orthogonal Clause model.
It does **not** change v1 runtime legality or product sampling by itself.

The current v1 grammar remains executable until each v2 dimension has a concrete
structural representation, evidence contract, and regression coverage.

## Problem

The current `Clause` production inventory mixes several independent grammatical
dimensions at one mutually competing rule level:

- predicate and valency frames (`intransitive`, `transitive`, `ditransitive`);
- predicate type (`nominal-predicate`, `adjective-predicate`, `copular`);
- grammatical marking (`modal`, `negative`, `aspect`);
- argument constructions (`ba`, `bei`, `comparative`);
- predicate structure (`causative`, `pivotal`, `serial-verb`);
- information structure (`topic-comment`);
- argument realization (`subject-omission`, `object-omission`);
- embedding (`subject-content`, `object-content`, `complement-content`, `quoted-content`).

These are not naturally exclusive choices. A single Mandarin clause can be
transitive, negative, modal, aspect-marked, and use a disposal/passive
construction at the same time. Treating each dimension as a peer `Clause`
production therefore makes representation choices constrain combinations and
sampling in ways that are not grammatical facts.

## Target dimensions

The v2 model separates seven structural axes:

```text
Clause
├─ predicate-frame
├─ argument-construction
├─ predicate-marking
├─ argument-realization
├─ information-structure
├─ embedding
└─ predicate-structure
```

The axes are grammar dimensions, not product sampling families. Product
frequency remains outside the formal grammar.

### Predicate frame

Owns the core predication and lexical valency requirement. The initial preserved
set is nominal, adjectival, copular, existential, verbal intransitive,
transitive, and ditransitive. Clausal-complement frames will be rebuilt through
embedding rather than copied mechanically from v1 rules.

### Argument construction

Owns non-canonical argument realization such as `ba`, passive, and comparative
constructions. `bei` must not remain one rule with an optional agent: the short
AUX passive and long ADP + overt-agent passive need separate executable shapes.

### Predicate marking

Owns polarity, modality, and aspect. These markings must compose with a core
predicate frame rather than replace that frame as the selected Clause identity.

### Argument realization

Owns whether licensed arguments are expressed on the surface. Subject/object
omission changes realization, not the underlying lexical valency frame.

### Information structure

Owns topic/dislocation and later related surface organization. A topic-comment
construction should wrap or transform a core Clause instead of replacing it
with an unrelated `NounPhrase + VerbPhrase` peer production.

### Embedding

Owns subject clauses, `ccomp`, `xcomp`, quotation, and relative-clause behavior.
`xcomp` requires an executable control contract; an arbitrary embedded Clause
is too broad. Relative clauses likewise require a relation between the modified
head and the missing/controlled role inside the relative clause before they can
claim full relative-clause semantics.

### Predicate structure

Owns multi-predicate and predicate-internal constructions such as object-control,
serial, causative, resultative, and directional structures. Legacy names are not
sufficient evidence: structures whose v1 valency label cannot be derived by the
current UD evidence pipeline remain on hold until a corpus-backed contract is
specified.

## Migration inventory

`src/syntax/clause-model-v2.ts` accounts for every current v1 production whose
output category is `Clause`.

The first migration partition is:

- 7 `preserve-core` rules;
- 6 `move-to-axis` rules;
- 3 `rebuild-construction` rules;
- 5 `rebuild-embedding-control` rules;
- 3 `hold-for-corpus-rebuild` rules.

The inventory is intentionally exhaustive. Tests compare its keys to the live
canonical grammar so a future Clause production cannot silently bypass the v2
migration decision.

## Runtime boundary

This foundation does not delete or reinterpret any v1 production yet.

A v1 production may be removed or changed only after its v2 target has:

1. an executable structural representation;
2. a syntax-evidence contract;
3. lexical reachability tests against the packaged profiles;
4. positive and negative realization regressions;
5. product migration behavior, when the change affects active sampling.

This prevents a half-migration where, for example, removing `clause.negative`
would simply make negative clauses disappear before predicate marking can
compose with other frames.

## First implementation sequence

1. Decide single ownership of verbal arguments: Clause frame or VerbPhrase, not both.
2. Add structural composition/constraint support required by orthogonal axes.
3. Rebuild passive short/long forms and `ba` from dependency evidence.
4. Rebuild `ccomp` / `xcomp` and control semantics.
5. Separate lexical capability from merely observed corpus roles.
6. Audit locative, causative, serial, resultative, and related predicate patterns
   against the committed UD evidence before making them executable v2 families.
7. Only after legality is stable, define any Clause-level curriculum sampling
   policy over meaningful v2 construction identities.

## Non-goals

- no new product sampling weights in this foundation;
- no claim that the v2 inventory equals natural Mandarin frequency;
- no semantic plausibility or world-knowledge scoring;
- no immediate removal of the v1 grammar;
- no attempt to infer unsupported constructions from rule names alone.
