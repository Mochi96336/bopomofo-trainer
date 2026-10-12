# Formal Syntax V2 有關 relational-ccomp evidence

## Question

Does the written form `有關/ADJ` itself justify a finite-clause complement
construction?

No. The relevant evidence is a much narrower same-occurrence signature.

## All 有關/ADJ occurrences

Pinned Chinese GSD r2.18 contains **14** occurrences of `有關/ADJ`.

Dependency relations:

- amod: **8**
- root: **4**
- ccomp: **1**
- parataxis: **1**

Only **3 / 14** occurrences have a direct ccomp child.

This is important because the same written form is frequently used as an
ordinary modifier:

```text
有關部門
有關項目
有關個案
```

Therefore lexical identity alone is not a valid construction license.

## Reviewed same-occurrence signature

A source occurrence enters the reviewed subset only when all of these are true:

1. governor is exactly `有關/ADJ`;
2. governor is root;
3. governor has exactly one direct ccomp child;
4. ccomp precedes 有關;
5. ccomp has exactly one `case` child whose written form is 與 or 和;
6. governor has no copula child.

Pinned result:

- reviewed occurrences: **3**
- 與: **2**
- 和: **1**
- ccomp head UPOS:
  - ADJ: **2**
  - VERB: **1**
- matrix overt subject: **2 / 3**
- embedded ccomp overt subject: **3 / 3**

Occurrence identity digest:

`5012d1d6fa764e8ae03549d81336376a48eb149a061c08b317ebae0e1bb28a56`

The three reviewed source shapes correspond to:

```text
很多健康問題 與 [大腦血清素水平低] 有關
至於…的決定，則 與 [經濟不景] 有關
這個轉變，可能 和 [義勇軍…推翻清朝，以及…殉職] 有關
```

In UD, 與/和 is the `case` child of the ccomp head rather than a lexical
property of 有關.

## Architecture consequence

The construction evidence is jointly owned by:

```text
有關/ADJ(root)
+ direct preposed ccomp
+ 與/和 case on that same ccomp
```

Those facts must remain one same-occurrence capability. They must not be
reconstructed from independent aggregate facts such as:

- the lexeme has an ADJ profile;
- the lexeme was observed as a predicate somewhere;
- the lexeme has aggregate ccomp valency somewhere;
- 與 or 和 exists somewhere in the corpus.

That would incorrectly license the eight amod uses and other unrelated 有關
occurrences.

## Candidate executable direction

If a later PR projects the reviewed capability onto an identity-safe active
profile, the structural prototype should keep adjectival predicate ownership:

```text
Clause
├─ Subject?
├─ marker: 與 | 和
├─ ContentClause
└─ AdjectivePhrase[reviewed relational-ccomp capability]
```

This is preferable to broadening the transitional VERB-only `Predicate`
category to ADJ.

The exact production remains deferred until the runtime capability projection
is reviewed and the active lexicon identity is proven unambiguous.

## Product boundary

This evidence PR changes no executable grammar, capability projection, or
sampling policy.
