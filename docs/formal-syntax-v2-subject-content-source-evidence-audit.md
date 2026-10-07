# Formal Syntax V2 subject-content source evidence audit

## Question

Before rebuilding `clause.subject-content`, determine what pinned Chinese GSD
actually supports for clausal subjects.

The current executable rule is:

```text
ContentClause(requiredFunctions: ["subject"])
+ VerbPhrase(requiredFunctions: ["predicate"])
```

That shape makes two assumptions that need to be separated:

1. the clausal subject is represented by a structural embedding role rather than
   by a permanent lexical/function property on material inside the clause;
2. the matrix predication is verbal.

This audit measures both without changing executable grammar.

## Reviewed source contract

Evidence contract:

`pinned-gsd-csubj-shape-inventory-v1`

A reviewed occurrence is an ordinary pinned Chinese GSD token whose dependency
relation, after removing a subtype, is exactly `csubj`.

That includes:

- `csubj`: **369**
- `csubj:pass`: **6**

The `csubj` dependent is treated as the head of the clausal subject. Its
governor is treated as the matrix head for this source inventory.

This is a syntactic source-shape contract. It is not a claim that every `csubj`
occurrence belongs to one productive Mandarin construction, and the six passive
occurrences remain visible as a separate subtype.

## Reviewed pinned boundary

Pinned Chinese GSD r2.18:

- source sentences: **4,997**
- ordinary tokens: **123,289**
- clausal-subject occurrences: **375**
- recovered matrix heads: **375 / 375**
- clausal-subject head before matrix head: **375 / 375**
- clausal-subject head after matrix head: **0 / 375**
- clausal subjects with their own overt subject: **203**
- clausal subjects without their own overt subject: **172**
- matrix heads with an additional subject besides the `csubj`: **1**
- matrix heads without an additional subject: **374**
- matrix root: **181**
- matrix non-root: **194**

Clausal-subject head UPOS:

- VERB: **311**
- NOUN: **34**
- ADJ: **25**
- PART: **3**
- ADP: **1**
- PRON: **1**

Matrix-head UPOS:

- VERB: **269**
- NOUN: **60**
- ADJ: **28**
- NUM: **4**
- PART: **4**
- PROPN: **4**
- ADP: **2**
- ADV: **1**
- AUX: **1**
- PRON: **1**
- X: **1**

Matrix-head relation:

- root: **181**
- parataxis: **71**
- ccomp: **59**
- xcomp: **20**
- advcl: **19**
- acl:relcl: **11**
- csubj: **10**
- conj: **3**
- appos: **1**

There are **213** matrix `form+UPOS` identities. The reviewed identity-count
map is pinned by deterministic SHA-256:

`7c19504965afca794265feccd3a57b57e7a60dd4bcf767076165f60dd9609227`

## Consequences for the current grammar

### 1. A clausal subject is a structural subject alternative

All 375 reviewed clausal-subject heads precede their matrix heads, and 374 of
375 matrix heads do not also carry another subject.

This strongly supports treating clausal subjecthood as an argument relation,
not as a special peer Clause frame whose identity is "subject-content".

The natural V2 ownership point is therefore the existing structural `Subject`
role: a later migration can investigate a clausal `Subject` alternative beside
the existing nominal `Subject -> NounPhrase` rule.

That would let the ordinary matrix predicate-frame rules keep ownership of the
matrix predication instead of rebuilding a second set of verbal, adjectival,
nominal, and other subject-content Clause rules.

### 2. Matrix predication is not verb-only

Only **269 / 375** reviewed matrix heads are VERB.

The remaining frontier includes **60 NOUN** and **28 ADJ** heads plus a small
tail of other UPOS values. Therefore replacing legacy `VerbPhrase` with the
transitional verbal `Predicate` category would still be too narrow.

A safe migration must preserve the existing matrix predicate-frame choice and
change how its subject is realized, rather than create a new universal verbal
matrix predicate slot.

### 3. The subject clause itself is not uniformly verbal

Most clausal-subject heads are VERB (**311 / 375**), but the source also
contains nominal and adjectival heads.

The existing `ContentClause -> Clause` recursion is directionally more
appropriate than a VERB-only subject-clause category because it can preserve
the internal Clause frame instead of collapsing clausal subjects to lexical
verb heads.

This audit does not yet establish whether every non-verbal `csubj` analysis
should become product grammar. Those shapes remain source evidence to review
during the executable migration.

### 4. Surface realization inside the subject clause is independent

Only **203 / 375** clausal subjects have an overt subject of their own.

That alternation belongs to the embedded clause's normal argument-realization
machinery. It must not be turned into two lexical classes of clausal subject.

### 5. Passive clausal subjects remain explicit

The six `csubj:pass` occurrences are counted but not silently folded into a
generic active subject-content capability.

Any executable rewrite must demonstrate how passive marking and the clausal
subject relation compose before claiming that the same product path covers both.

## Migration direction

The evidence rules out the tempting rewrite:

```text
SubjectClause + Predicate
```

if `Predicate` remains the current verbal predicate core.

The narrower architectural hypothesis to test next is:

```text
Subject
├─ argument.subject.noun
│  └─ NounPhrase
└─ argument.subject.clause
   └─ ContentClause
```

with ordinary Clause predicate-frame rules continuing to own the matrix
predication.

If that structural alternative is executable, the legacy
`clause.subject-content` peer rule can then be retired rather than rewritten as
another complete matrix-clause template.

That implementation must still pass a deterministic product migration audit:
adding a second `Subject` production may otherwise accidentally give clausal
subjects near-peer sampling mass. Grammar legality and curriculum incidence
must remain separate, as in the comparative migration.

## Product boundary

This audit changes no executable grammar or product sampling.

It does not:

- make every `csubj` source occurrence a productive grammar path;
- add `ContentClause` to `Subject` yet;
- retire `clause.subject-content` yet;
- project the 213 matrix identities into a runtime capability;
- infer product frequency from source frequency;
- merge passive and active clausal-subject behavior without an executable
  composition contract.

The next safe step is a structural migration prototype for a clausal
`Subject` alternative, followed by deterministic migration measurement before
any behavior-changing merge.
