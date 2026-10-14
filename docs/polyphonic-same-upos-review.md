# Multi-reading forms inside one UPOS: evidence and review queue

This is a **read-only next stage** after the reviewed-role product gate landed.
It never changes generated exercises, reads user progress, guesses a preferred
reading, or labels a generated sentence as correct or incorrect.

## What is different from the first reading gate?

The reviewed-role gate can protect exact written-form + grammatical-role
identities such as 和/CCONJ, 哪/PRON or 那/DET. But many lexemes still carry
two or more valid readings *inside one identical coarse UPOS*:

- 那 / PRON: demonstrative, interrogative and historical readings need sense
  and construction evidence; a global PRON whitelist would be unsafe.
- 為 / AUX: lexical/syntactic use and role within a particular sentence matters.
- 給 / VERB, 種 / NOUN, 好 / ADJ: a coarse POS alone cannot assign a sense.
- 比 / CCONJ: needs **syntax-profile validity** review as well as reading review;
  deciding that ㄅㄧ1 is inappropriate without checking why the token is
  treated as a coordinator would conflate two separate errors.

Some groups are *known legitimate variants*, e.g. 哪 / PRON can license both
ㄋㄚ3 and ㄋㄟ3. They are separated from the unreviewed queue, rather than
counted as errors.

## Reproducible report

```bash
npm run app:catalog
npm run readings:audit -- --policy reviewed-roles \
  --output data/generated/polyphonic-context-reviewed-roles.json
npx tsx scripts/audit-same-upos-polyphones.ts
```

The generated `data/generated/same-upos-polyphone-review.json` is
gitignored and uploaded as a workflow artifact. It includes one group per
(written form, actual selected UPOS) when at least two catalog reading
identities were observed under that same UPOS, deterministic representative
sentences, neighboring lexical entries, selected syntax-profile functions,
and counters for unresolved versus already-reviewed roles.

**The report does not represent a G2P accuracy score.** A profile's `functions`
are aggregate evidence projected from UD by surface text; they do not prove a
specific word sense in a specific sentence.

## How to review the evidence

For a selected generated sentence and reading identity, record separately:

1. **Reading correctness:** is the selected reading natural and supported in
   this exact utterance?
2. **Lexical sense:** which meaning does the surface realize, and what argument
   or collocation makes that sense possible?
3. **Syntax evidence:** was the selected UPOS/function actually warranted for
   this reading? Is the grammar construction itself plausible?
4. **Sentence naturalness:** even if the reading is correct, is the phrase
   natural enough for learners?

Allow labels `accepted`, `reading-mismatch`, `sense-mismatch`,
`syntax-role-mismatch`, `unnatural-combination`, `uncertain`. Multiple
negative labels can apply to one sentence. Store the original exact entry ID
and authoritative evidence; never overwrite a valid catalog identity.

Priority should be weighted by actual product exposure and independently
reviewed counterexamples, not raw model confidence. Once independently
labeled real/corpus examples exist, compare small contextual classifiers
against explicit collocation/grammar rules with a held-out evaluation set.
Teacher g2pW predictions are **candidates**, not gold labels.

## Evidence coverage limitation

These are 2,048 grammar samples from one fixed generation policy, **not**
complete coverage of all 182 ambiguous surfaces in the shipped practice
catalog. If an example like the second reading of 東西 or 說 did not occur,
that only means this seed batch did not exercise it. A later targeted sampler
must cover underobserved lexical senses before any universal disambiguator
is enabled.
