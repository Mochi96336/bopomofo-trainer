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
When this gate rejects a sampled reading, the composer *may* prefer
**another licensed reading of the same written lexical entry in the same
compatible grammar slot**. But this preference applies **only if replacing
the reading does not drop a learner-boosted expected token**. The selector
checks actual token identities in the rejected and licensed replacement
entries, using the existing minimum-sample-gated expected-token error and
timing boosts. For an ordinary clean learner history, `服務好` stays
`服務好` and obtains the exact `好:ㄏㄠ3` catalog entry and syllables.
If the learner is weak on tone 4, that correction would eliminate the
boosted `tone:4` target. Instead of overriding the learner's priority,
the selector uses its original legal frequency/error-weighted redraw,
where another legitimate fourth-tone lexeme may be selected.

This does not invent a reading, retain an invalid `ㄏㄠ4` adjective
or rewrite displayed Bopomofo independent of the catalog entry ID.
If same-word correction is unavailable, the existing weighted legal
frontier is also retained.

VERB, NOUN, ADV, unrecognized roles and multi-character entries remain
unchanged. All existing closed-class/pronominal eligibility survives.

The 2,048-seed audit and its exact-seed comparison will verify
that changed candidates originate from an excluded `好/ADJ` or
earlier reviewed role mismatch, without unrelated drift or
generation failure. Tests pin accepted and rejected entry IDs,
unreviewed roles and mismatched profile identity. A forced, deterministic
1,024-seed `tone:4` conflict probe also checks that the learner-target-aware
repair does not lose four-tone opportunities compared with the historical
legal redraw, while still retaining the original word when no token boost
would be lost. Results are synthetic and cannot be extrapolated to real
user effectiveness.

**Important limits:** The audit samples the grammar composer with pinned
seeds, not user traffic or the full frequency-first runtime distribution.
The underlying UD lexical roles are projected from the written form;
an `ADJ` profile cannot substitute for independently reviewed semantics
in arbitrary sentences. Do not report six repaired pronunciation errors
or an accuracy gain from the six excluded candidate selections. Review
post-change full sentences and counterexamples before promoting this
Draft PR. Do not conflate lexical naturalness with pronunciation correctness.
