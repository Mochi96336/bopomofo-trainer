# Pinned topic-dislocation evidence boundary

## Purpose

This note records what pinned Chinese GSD r2.18 can and cannot establish about the current `clause.topic-comment` migration.

The executable legacy rule is still:

```text
NounPhrase(modifier) + VerbPhrase(predicate)
```

Clause Model V2 intends to move topic/comment structure onto the information-structure axis, but a corpus relation must not be treated as topic licensing merely because its UD label is named `dislocated`.

## Reviewed pinned result

Source:

- Chinese GSD r2.18
- 4,997 sentences
- 123,289 ordinary tokens

Exact `dislocated` dependencies:

- total: **62**
- dependent after its head: **60**
- dependent before its head: **2**
- verbal heads: **4**
- root heads: **25**

Dependent UPOS:

- VERB: 39
- ADJ: 11
- NOUN: 10
- PROPN: 2

Head UPOS:

- NOUN: 36
- PART: 9
- PROPN: 8
- VERB: 4
- PRON: 3
- X: 2

## Interpretation

This source relation is not a narrow Mandarin sentence-initial topic signal.

The dominant pinned shape is a post-head detached dependent, and most heads are non-verbal. The relation also spans verbal, adjectival, nominal, parenthetical, and other detached material.

Therefore the contract `pinned-gsd-topic-dislocation-inventory-v1` is a **negative licensing boundary**:

- exact GSD `dislocated` evidence may be used to audit detached structure;
- it must **not** be projected directly into a productive Mandarin topic capability;
- it must **not** license the current generic `NounPhrase + VerbPhrase` peer-Clause rule;
- it must **not** be treated as evidence that all topic-comment constructions are `dislocated`;
- a future topic grammar needs a source contract that identifies the topic relation to an underlying core Clause, including the gap/resumption or argument relation that the topic reorganizes.

## Grammar consequence

No product behavior changes in this audit.

The current `clause.topic-comment` remains a known migration frontier rather than being rewritten from insufficient evidence. The next safe step is either:

1. obtain a source that explicitly represents topic-to-clause dependency or constituency structure; or
2. define a narrower recoverable subset from reviewed evidence and keep all unresolved topic-like structures fail-closed.

Until then, the formal grammar should not infer topic status from generic nominal modifiers, word order alone, or the GSD `dislocated` label.
