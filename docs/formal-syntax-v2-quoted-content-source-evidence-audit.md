# Formal Syntax V2 quoted-content source evidence audit

## Question

Before rebuilding `clause.quoted-content`, determine what exact Chinese corner-quote
spans in pinned Chinese GSD actually encode.

Current executable shape:

```text
NounPhrase?
+ Predicate[clausal-complement]
+ QuotedClause[requiredFunctions: object]
```

This rule currently assumes three things at once:

1. matrix subject is nominal;
2. reporting predicate owns a clausal-complement frame;
3. quotation is an object-labelled recursive clause.

The source audit keeps those claims separate.

## Reviewed source contract

Evidence contract:

`pinned-gsd-corner-quote-span-attachment-v1`

The source is Chinese GSD r2.18 at commit
`e0d85a020182e264d6384be2a59c0f4879a1cc35`.

The audit pairs exact `「 ... 」` spans and finds tokens inside each span whose
syntactic head lies outside that span. A span with exactly one such token has one
reviewable boundary root.

## Full corner-quote inventory

Pinned source:

- sentences: **4,997**
- ordinary tokens: **123,289**
- `「`: **421**
- `」`: **423**
- paired `「 ... 」` spans: **418**
- spans with exactly one boundary root: **415**
- spans with multiple boundary roots: **3**
- spans with no boundary root: **0**

The 415 single-root spans are not all clauses. They include names, titles,
labels, slogans, terminology, and full quoted propositions.

Their root relations are highly heterogeneous. Major relations include:

- `obj`: **108**
- `ccomp`: **56**
- `nsubj`: **50**
- `nmod`: **41**
- `conj`: **26**
- `appos`: **23**
- `obl`: **20**
- `xcomp`: **19**
- `parataxis`: **16**
- `root`: **8**

Therefore quote punctuation is not a grammatical argument relation by itself.

## Clause-like structural proxy

To avoid treating quoted names and titles as `QuotedClause -> Clause`, the
audit uses a deliberately narrow structural proxy that the current Clause
inventory can plausibly realize without adding fragment grammar:

- a quoted boundary root whose UPOS is `VERB`; or
- a quoted boundary root with its own overt `nsubj/csubj`.

This is a parser-facing proxy, not a linguistic claim that every included span
is direct speech.

Results:

- clause-like quote roots: **132 / 415**
- externally attached clause-like roots: **124**
- standalone quoted roots inside this subset: **8**
- quote after external governor: **97**
- quote before external governor: **27**

Even in this narrower subset, attachment remains heterogeneous:

- `ccomp`: **54**
- `xcomp`: **17**
- `parataxis`: **16**
- `obj`: **3**
- plus smaller `acl/advcl/appos/csubj/... ` shapes.

The existing `QuotedClause[object]` assumption is therefore not supported by
the clause-like subset: only **3 / 132** use `obj`.

## Direct-quote structural candidate subset

For the current embedding question, the audit further isolates clause-like
quoted roots attached externally with one of:

`ccomp | xcomp | parataxis | obj`

This gives **90** structural candidates.

Attachment relations:

- `ccomp`: **54**
- `xcomp`: **17**
- `parataxis`: **16**
- `obj`: **3**

External governor UPOS:

- VERB: **86**
- NOUN: **2**
- ADP: **1**
- PART: **1**

Order:

- reporting/governing head before quote: **87 / 90**
- quote before governor: **3 / 90**

Matrix subject realization:

- governor with overt subject: **76 / 90**

The candidate set strongly supports a dominant verbal reporting-head + following
quotation shape, but it does **not** support collapsing all quote attachments
into one object relation or one finite-ccomp relation.

## Matrix subject ownership

Across all externally attached single-root quote spans:

- governor with overt subject: **166**
- without overt subject: **241**
- nominal subject relation: **157**
- clausal subject relation: **9**

So the live `NounPhrase?` matrix-subject slot is structurally too narrow in the
broad source inventory. If a quotation embedding rule survives the v2 rebuild,
its matrix subject should route through the shared `Subject` role rather than
a bare NounPhrase.

This does not establish the incidence of clausal subjects inside the final
90-item direct-quote candidate subset; that remains separate from the main
negative ownership result.

## Architecture consequences

### 1. Quotation punctuation is orthogonal to dependency relation

`QuotedClause` should describe quoted surface packaging, not permanently assign
the quote an `object` function.

### 2. The current object label should not be generalized

The 90 direct-quote structural candidates contain only **3 obj** attachments,
versus **54 ccomp**, **17 xcomp**, and **16 parataxis**.

Removing or replacing the old object label therefore requires an attachment-
aware design, not simply changing `object` to `complement`.

### 3. A single `Predicate[clausal-complement]` reporting rule is also too coarse

Most candidate governors are VERB (**86 / 90**), so the current transitional
VERB Predicate remains a useful narrow base. But the quoted root's source
attachment itself splits across ccomp, xcomp, parataxis, and obj.

A future executable quotation design should decide whether these are:

- separate quotation attachment constructions; or
- a quotation packaging axis layered over independently licensed reporting
  predicates and attachment relations.

It should not infer one generic lexical reporting frame from punctuation alone.

### 4. Current canonical order is a good dominant default, not a universal law

**87 / 90** candidates place the governing head before the quote, while **3**
place the quote first. The current head-before-quotation order is strongly
supported as a narrow default, but the minority order should not be erased from
the evidence record.

## Safety boundary

This audit changes no executable grammar.

It does not:

- remove `clause.quoted-content`;
- change `NounPhrase?` to `Subject?` yet;
- remove the legacy quotation `object` label yet;
- broaden Predicate;
- convert ccomp/xcomp/parataxis counts into product weights;
- treat every `「 ... 」` span as direct speech.

The safe next step is **not** a blind ownership rewrite. Quotation attachment
needs a narrower executable design that preserves the ccomp/xcomp/parataxis
split while keeping quote punctuation as surface packaging.
