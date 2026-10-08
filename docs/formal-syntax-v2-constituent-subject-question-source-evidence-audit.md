# Formal Syntax V2 constituent-subject-question source evidence audit

## Question

Before changing sentence.constituent-subject-question, determine what pinned
Chinese GSD actually supports for interrogative material in the subject role.

Current executable shape:

~~~text
questionPhrase
  allowed UPOS: PRON | NOUN | DET | NUM
  required function: subject
  questionType: constituent
+ VerbPhrase(predicate)
~~~

This currently assumes that a licensed interrogative form can itself be the
Subject, that the matrix predicate is verbal, and that the evidence supports a
root Sentence rather than only an embedded interrogative clause.

## Reviewed source contract

Evidence contract:

**pinned-gsd-licensed-wh-direct-subject-shape-inventory-v1**

The audit starts from the exact written forms currently licensed by
questionType:constituent:

誰 / 什麼 / 甚麼 / 哪 / 哪個 / 哪些 / 哪裡 / 哪兒 / 何 / 何人 / 何處 /
何時 / 幾 / 多少.

It then isolates the narrower subset where the interrogative token itself has a
base nsubj or csubj relation. This deliberately excludes cases where
interrogative material is only det or nummod inside a larger nominal subject.

## Reviewed pinned boundary

Pinned Chinese GSD r2.18:

- source sentences: **4,997**
- ordinary tokens: **123,289**
- licensed interrogative-form tokens: **74**
- direct interrogative-subject tokens: **9**
- recovered governing heads: **9 / 9**

Interrogative-form relation counts:

- nummod: **38**
- nsubj: **9**
- obj: **7**
- obl: **7**
- det: **5**
- nmod: **5**
- advmod / appos / conj: **1** each

Only three forms occur as direct subjects:

- 誰: **4**
- 何: **3**
- 什麼: **2**

Direct-subject UPOS:

- PRON: **6**
- PROPN: **3**

All 9 are nsubj. There are no reviewed nsubj:pass or csubj interrogative-token
subjects in this subset.

The direct-subject form+UPOS inventory is pinned by SHA-256:

**06f184453f6219f657136819c0bc5f884e80590511503d211379100e0e183220**

This exposes a source mismatch in the live rule. The source includes PROPN but
the rule does not; the rule allows NOUN / DET / NUM, but none occur in this
direct-token subject subset. This does not claim those categories are impossible
in Mandarin; it only shows that the current gate is not projected from this
pinned boundary.

## Governing predicate shape

The 9 governing heads are:

- VERB: **7**
- ADJ: **2**

There are **9** distinct governing-head form+UPOS identities, pinned by:

**5f6d8892c6d7653fe7586af848b2f0da167119386779c1c11d5c9ad13dc452ce**

Therefore the current VerbPhrase matrix slot is already too narrow: two reviewed
direct-subject occurrences have adjectival heads.

However, this subset has no nominal, copular, or AUX governing heads. It does
not justify an unconstrained universal matrix-predicate replacement.

## Argument and complement shape

Among the 9 governing heads:

- with direct object: **3**
- without direct object: **6**
- with indirect object: **0**
- with copula child: **0**
- with ccomp/xcomp child: **2**
- with an additional subject: **0**

This matters for ownership. Simply changing VerbPhrase to the transitional
object-free Predicate would fail to represent the three object-bearing source
shapes. Ordinary predicate-frame machinery should continue to own objects and
complements.

## Order and clause status

All 9 interrogative subjects precede their governing head:

- before head: **9**
- after head: **0**

No governing head has another subject.

But only **1 / 9** governing heads is root. The other **8 / 9** are embedded:

- ccomp: **3**
- csubj: **2**
- advcl: **1**
- appos: **1**
- parataxis: **1**

This is the strongest limit on the current evidence. Most reviewed occurrences
show an interrogative Subject inside a clause; they do not directly license a
dedicated root-level sentence.constituent-subject-question template.

## Migration consequences

### 1. The current lexical Subject gate should not be treated as evidence-backed

The broad PRON / NOUN / DET / NUM gate mixes direct interrogative subjects with
interrogative material that often lives inside a larger nominal phrase.

A future reconstruction must distinguish a direct interrogative Subject from a
Subject phrase containing interrogative material.

### 2. VerbPhrase is too narrow, but Predicate alone is not the answer

The two ADJ heads disprove a verb-only assumption. The object-bearing and
clausal-complement-bearing verbal heads also show why an isolated object-free
Predicate slot would merely move the ownership bug.

The cleaner architectural hypothesis is that interrogative subject realization
occupies the ordinary Subject position while ordinary Clause predicate frames
continue to own predication and argument structure.

### 3. Root evidence is too thin for an immediate behavior-changing rewrite

Only one direct interrogative-subject occurrence has a root governing head.
Pinned GSD therefore does not provide enough root examples by itself to infer a
broad standalone subject-question grammar or product distribution.

The safe outcome is to pin this boundary and keep the current executable rule
under review until root-question evidence is strengthened or a narrowly
justified structural reconstruction is available.

## Product boundary

This PR is measurement-only. It does not change the executable subject-question
rule, add PROPN licensing, remove NOUN / DET / NUM licensing, replace
VerbPhrase, create an interrogative Subject production, or infer curriculum
weights from source counts.
