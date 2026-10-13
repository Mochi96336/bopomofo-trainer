# Formal Syntax V2 direct-quote attachment identity audit

## Question

#378 established that exact Chinese corner-quote packaging is not itself an
argument relation. Among 90 clause-like structural candidates, the quoted root
attaches to an external governor as:

```text
ccomp       54
xcomp       17
parataxis   16
obj          3
```

This follow-up asks whether those relations can be separated by reporting-head
lexical identity.

If the same reporting predicate repeatedly appears under different source
relations, attachment cannot safely be encoded as a permanent property of the
lexeme.

## Reviewed source boundary

Evidence contract:

`pinned-gsd-direct-quote-attachment-identity-v1`

Source:

- Chinese GSD r2.18
- commit `e0d85a020182e264d6384be2a59c0f4879a1cc35`
- inherited structural candidate boundary from #378
- candidates: **90**

The 90-item boundary is still structural, not semantic. It intentionally
contains some quoted names, slogans, labels, and other clause-like analyses that
should not automatically become executable quotation constructions.

## Relation shape

### ccomp

- occurrences: **54**
- external governor VERB: **53**
- external governor ADP: **1**
- governor with overt subject: **46**
- quote after governor: **53**
- quote before governor: **1**
- unique governor identities: **29**

This is the strongest source-aligned subset for the current transitional
`clause.quoted-content` shape.

### xcomp

- occurrences: **17**
- external governor VERB: **17**
- governor with overt subject: **13**
- quote after governor: **15**
- quote before governor: **2**
- unique governor identities: **13**

The set includes genuine speech/reporting examples, but also slogans, purposes,
and quoted phrases whose UD xcomp analysis does not imply subject-control
semantics. It must not be routed into the existing xcomp control construction
without a separate review.

### parataxis

- occurrences: **16**
- VERB governor: **13**
- NOUN governor: **2**
- PART governor: **1**
- all governors have overt subjects
- all quotes follow the governor
- unique governor identities: **16**

Manual source context shows this subset is especially heterogeneous: direct
reporting examples coexist with names, labels, slogans, and independent quoted
material. `parataxis` is therefore not a quote-specific lexical frame.

### obj

- occurrences: **3**
- all external governors VERB
- unique governor identities: **3**

Only one of the three contexts is a clear reporting example (`說`). The other
two are quoted names/phrases. The old `QuotedClause[object]` ownership is not
supported.

## Governor identity overlap

There are **53** unique governor form+UPOS identities across the 90 candidates.

Only **5** identities occur under more than one attachment relation, but these
include several of the highest-frequency reporting predicates:

| governor | source relations | occurrences |
| --- | --- | ---: |
| 說/VERB | ccomp, obj, xcomp | 13 |
| 表示/VERB | ccomp, parataxis, xcomp | 6 |
| 是/VERB | ccomp, parataxis, xcomp | 4 |
| 為/VERB | ccomp, xcomp | 3 |
| 說道/VERB | ccomp, xcomp | 2 |

Pairwise shared governor identities:

- ccomp × xcomp: **5**
- ccomp × parataxis: **2**
- parataxis × xcomp: **2**
- ccomp × obj: **1**
- obj × xcomp: **1**
- obj × parataxis: **0**

The overlap count is numerically small because most lexical identities are
singletons, but the overlap is concentrated in core reporting verbs. That is
exactly where a lexeme-level attachment whitelist would be most damaging.

## Architecture consequence

### 1. Do not encode quotation attachment as a permanent reporting-verb property

`說`, `表示`, and `說道` demonstrate that the same governor identity can
appear with different UD attachment relations in otherwise quotation-like
contexts.

A model such as:

```text
說 -> ccomp quote
表示 -> parataxis quote
...```

would convert occurrence-level parser analyses into false lexical invariants.

### 2. Quote packaging and attachment should be orthogonal

The source evidence supports treating:

```text
「 Clause 」
```

as surface quotation packaging, while the external relation remains a separate
attachment decision.

This does not require exposing all four source relations in product grammar.
It only means the quotation wrapper itself must not permanently own
`object`, `ccomp`, `xcomp`, or `parataxis`.

### 3. The safest executable slice is the ccomp-like reporting path

The current live rule already requires a verbal `Predicate` with
`clausal-complement` valency. For that narrow path, the source gives:

- **54** structural candidates
- **53 / 54** governors are VERB
- **46 / 54** have overt matrix subjects
- **53 / 54** place the quote after the governor

Therefore the next executable cleanup can be narrow:

```text
Subject?
+ Predicate[clausal-complement]
+ QuotedClause
```

with two explicit interpretations:

- this rule models the ccomp-like reporting slice only;
- `QuotedClause` is quotation packaging and owns no object role.

The rule should retain its existing ID for structural-target compatibility, but
its Clause Model V2 target should be documented as `quotation.ccomp`, not
generic quotation.

### 4. xcomp/parataxis remain evidence frontiers

Do not map quoted xcomp examples into subject/object-control grammar merely
because UD calls them xcomp.

Do not add a generic parataxis reporting frame merely because 16 examples are
present.

Both need narrower occurrence-level review if product support becomes
important.

## Safety boundary

This audit changes no executable grammar.

It does not:

- create a reporting-verb whitelist;
- turn relation frequency into product sampling weight;
- claim all 90 structural candidates are direct speech;
- project quote attachment as a lexical capability;
- broaden Predicate;
- map quotation xcomp into control syntax.

The immediate safe implementation target is only the ccomp-like ownership
cleanup of the existing `clause.quoted-content` rule.
