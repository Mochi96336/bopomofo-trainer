# Reviewed standalone 好 / ADJ: targeted production reading repair

## One auditable regression, not a general G2P accuracy claim

In the archived 2,048-seed grammar-generation report
(`polyphonic-context-reviewed-roles.json` from workflow
`Polyphonic reading exposure`, run `38894259772`), seed **10** produced
`服務好` with standalone entry `word:好:ㄏㄠ4` selected as `ADJ`.
In that straightforward predicative-adjective context, the reading is
**ㄏㄠ3**. Of ten `好/ADJ` occurrences, six selected `ㄏㄠ4`.
Only `服務好` is used as the clear whole-utterance regression here;
other fragments come from sentences of mixed naturalness and must not be
reported as independently confirmed natural-sentence errors.

Authoritative reading senses:
- [MOE Concised ㄏㄠ3](https://dict.concised.moe.edu.tw/dictView.jsp?ID=19419):
  good/satisfactory and related predicative/adverbial senses.
- [MOE Concised ㄏㄠ4](https://dict.concised.moe.edu.tw/dictView.jsp?ID=19462):
  liking/fondness, plus nominal use.

## Narrow repair

Keep the original `(surface, reading)` catalog entry identities.
The existing production eligibility callback now checks one *selected*
role only: **standalone 好 / ADJ** accepts `ㄏㄠ3` and rejects `ㄏㄠ4`.
When the sampled standalone 好 has an ADJ profile, reading validity
follows that reviewed context, **not the learner's weakness**. In this
narrow context the legal catalog identity is 好:ㄏㄠ3, even if a learner
often makes tone-4 errors. Select the corresponding complete catalog
entry (reading and syllable tokens together) rather than rewriting
displayed Bopomofo or choosing pronunciation based on learner history.

A rejected 好:ㄏㄠ4/ADJ draw can be replaced with the compatible
好:ㄏㄠ3/ADJ entry while keeping the original written sentence.
If no valid same-word entry exists, fall back to the existing legal,
frequency/learner-weighted word selection. The learner's weakness may
influence which **legal words and sentences** appear, but can never
increase the chance of issuing an invalid pronunciation for a selected
context. A repaired 好:ㄏㄠ3 sentence contains a third-tone token,
not a fourth-tone practice target.

VERB, NOUN, ADV, unrecognized roles and multi-character entries remain
unchanged. All existing closed-class/pronominal eligibility survives.

The 2,048-seed audit and its exact-seed comparison will verify
that changed candidates originate from an excluded `好/ADJ` or
earlier reviewed role mismatch, without unrelated drift or
generation failure. Tests pin accepted and rejected entry IDs,
unreviewed roles, mismatched profile identity, and same-surface preservation.
A 1,024-seed forced conflict probe checks the *same contextual reading
decision* with and without a synthetic fourth-tone weakness. Any resulting
reduction in fourth-tone practice relative to substituting another word
is an **exposure tradeoff**, not a reason to intentionally abandon the
correct reading of 好.

**Important limits:** The audit samples the grammar composer with pinned
seeds, not user traffic or the full frequency-first runtime distribution.
The underlying UD lexical roles are projected from the written form;
an `ADJ` profile cannot substitute for independently reviewed semantics
in arbitrary sentences. Do not report six repaired pronunciation errors
or an accuracy gain from the six excluded candidate selections. Review
post-change full sentences and counterexamples before promoting this
Draft PR. Do not conflate lexical naturalness with pronunciation correctness.
