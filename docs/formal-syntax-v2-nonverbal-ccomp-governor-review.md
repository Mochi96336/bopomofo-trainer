# Formal Syntax V2 non-verbal ccomp governor review

## Question

The generic ccomp audit found **81 / 2,156** governing heads whose UPOS is not
VERB. This review asks whether those 81 occurrences justify broadening the
transitional `Predicate` category beyond VERB.

They do not form one coherent predicate class.

## Pinned inventory

Pinned Chinese GSD r2.18:

- total ccomp occurrences: **2,156**
- non-VERB governors: **81**
- distinct non-VERB governor form+UPOS identities: **51**

UPOS:

- ADP: **33**
- NOUN: **20**
- ADJ: **16**
- ADV: **6**
- PART: **3**
- NUM: **1**
- PRON: **1**
- PROPN: **1**

The full identity inventory is pinned by:

`2f301680e3014404217523135d3ea7d38d1ccfc85f6c0daf6c0c3abe83e747a7`

## 1. ADP does not justify Predicate broadening

All **33 / 33** ADP governors have the ccomp after the governor.

The dominant identities are:

- 由 / ADP: **16**
- 因為 / ADP: **11**

Together they account for **27 / 33** ADP cases. The remainder is a small tail
such as 如果, 只有, 諸如, 經過, 以, and 通過.

These are coverb, subordinator, or constructional attachment shapes. Treating
them as ordinary matrix predicates merely because UD attaches ccomp to them
would collapse predicate structure and embedding into one category.

**Decision:** do not add ADP to `Predicate`.

## 2. Twenty-one cases are already copular-shaped

A copula child is present on **21 / 81** non-verbal governors:

- NOUN: **13**
- ADJ: **4**
- PART: **3**
- NUM: **1**

These occurrences belong to the copular / nominal / adjectival predication
frontier, not to the VERB-based transitional Predicate core.

This does expose a separate modeling question because the current
`clause.copular` production has a NounPhrase predicate complement. Some
copula-bearing ADJ/PART/NUM source shapes are therefore outside that narrow
frame, but ccomp is not a reason to solve that by adding all of those UPOS
values to `Predicate`.

**Decision:** route future work through core predicate-frame review, not ccomp
Predicate expansion.

## 3. The non-copular NOUN tail is not one matrix-predicate class

After removing the 13 copula-bearing NOUN cases, **7** NOUN governors remain.

Four have the ccomp before the noun and are ordinary nominal heads containing
clausal material:

- 細節
- 爭論
- 理論
- 態度

Their source sentences are shapes such as “關於 X 是否…的爭論” or
“有關 X 會…的理論”. They are evidence for nominal complementation /
modification, not for a NOUN matrix predicate.

The three ccomp-after cases are also heterogeneous:

- 程度: an oblique “很大程度上因為…” attachment;
- 國旗: a root nominal followed by a causal/explanatory clause;
- 規定: one apparently verbal use tagged NOUN, with an overt subject and a
  following adjectival ccomp.

The isolated 規定/NOUN occurrence is worth retaining as a tagging /
lexical-category frontier, but one occurrence does not justify generic NOUN
Predicate licensing.

**Decision:** do not add NOUN to `Predicate`.

## 4. Most non-copular ADJ ccomp edges are clause-linking attachments

There are **12** ADJ governors without a copula child.

The ccomp-side case markers make the mixed source shape explicit. Reviewed
case forms include:

- 因為: 3
- 由於: 1
- 因: 1
- 儘管: 1
- 雖: 1
- 雖然: 1
- 在: 1
- 如: 1
- 比: 1
- 與 / 和: 4 combined

The causal, concessive, temporal/viewpoint, simile, and comparative cases are
not evidence that the adjective lexically selects a finite content complement.
Examples include 強大 + 因為…, 穩定 + 儘管…, 順利 + 因…, and 優惠 +
比…前.

**Decision:** generic ADJ + ccomp is not licensed from this inventory.

## 5. One narrow relational-adjective signature survives review

The repeated coherent subset is `有關 / ADJ`:

- occurrences: **3**
- governor is root: **3 / 3**
- ccomp precedes governor: **3 / 3**
- copula child: **0 / 3**
- ccomp case marker:
  - 與: **2**
  - 和: **1**
- embedded ccomp head:
  - ADJ: **2**
  - VERB: **1**

The source shapes are structurally equivalent to:

```text
Subject?
+ 與/和
+ finite clause
+ 有關
```

For example, the pinned UD edge for “很多健康問題與大腦血清素水平低有關”
is:

```text
問題 --nsubj--> 有關/ADJ
低/ADJ --ccomp--> 有關/ADJ
與/ADP --case--> 低/ADJ
水平/NOUN --nsubj--> 低/ADJ
```

The third occurrence likewise has 和/ADP as the case child of a verbal ccomp
head before 有關.

This is the only repeated non-copular ADJ identity in the 81-case frontier that
shows one stable relational pattern rather than a causal/concessive attachment.

### Why 一樣 is not folded into the same rule yet

`一樣 / ADJ` has one superficially similar 與-marked pre-adjectival ccomp,
but its ccomp also carries the nominalizing marker 的:

```text
與 她想像 的 不一樣
```

The repository already treats clause + 的 nominalization separately. Folding
that one occurrence into a simple finite `與/和 + ContentClause + ADJ`
construction would erase a real structural difference.

## Architecture consequence

The current `AdjectivePhrase` head already inherits valency-frame
requirements. Therefore, if the 有關 pattern is made executable, the cleaner
direction is **not**:

```text
Predicate += ADJ
```

It is a narrow adjectival embedding construction whose predicate remains an
AdjectivePhrase and whose construction owns the case-marked clausal complement.

Conceptually:

```text
Clause
├─ Subject?
├─ relational marker: 與 | 和
├─ ContentClause
└─ AdjectivePhrase[predicate, reviewed relational-ccomp capability]
```

The exact executable contract still needs a focused same-occurrence evidence
slice before implementation. In particular, the marker + ccomp + 有關 identity
must stay one occurrence-level capability rather than three aggregate profile
facts.

## Conclusion

The original **81 non-VERB governors are not 81 missing Predicate cases**.

The safe split is:

- ADP / ADV / PRON / PROPN tails: construction or attachment frontier;
- 21 copula-bearing cases: core copular/nominal/adjectival frame frontier;
- non-copular NOUN tail: nominal complementation plus isolated tagging cases;
- most non-copular ADJ cases: causal/concessive/etc. clause attachments;
- one narrow repeated candidate: **與/和 + ContentClause + 有關/ADJ**.

So the transitional `Predicate` category should remain VERB-only for now.
