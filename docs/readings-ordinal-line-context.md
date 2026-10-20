# Scoped legal-first selection: 第N + standalone 行

## Contextual pronunciation, not learner-dependent truth

The original 2,048-seed grammar audit included seed 931:
`第三` immediately followed by `行:ㄒㄧㄥ2`. In the *numbered row*
reading of **第三行**, the correct 行 is `ㄏㄤ2`. This proves a narrow
local collocation, not that the entire generated example is natural.

The composer already visits lexical slots in surface order. It passes the
previously selected lexical entry to the reviewed reading policy,
clearing the previous-word context at punctuation and formal literals.
Other reviewed role policies from Draft #424 remain unchanged.

## Why the earlier in-place reading replacement was withdrawn

An earlier #425 version preserved the chosen written `行` and changed
only its catalog reading to `ㄏㄤ2`. The 2,048-seed audit then changed
only seed 931, retaining the exact sentence. **But it could make the
legal `行` much more likely merely because the invalid `ㄒㄧㄥ2`
identity had a large learner-error weight.** Language facts were
corrected, but the *selection probability* was not.

The replacement requires two separate decisions:

1. **Before the current lexical draw**, in exactly the locally reviewed
   context `第N` + standalone `行`, exclude all reading identities
   except `行:ㄏㄤ2`. Other noun candidates remain eligible.
2. Draw the current lexical identity using **only the valid identities'
   own learner and frequency weights**. If a valid `行:ㄏㄤ2` wins,
   emit it; if another legal noun wins, the selected *word* may change.

The pronunciation of an already chosen **`行` in this context** is
always `ㄏㄤ2`, irrespective of the user's weak Zhuyin tokens.
The user history can weight *which valid lexical identity appears* but
must never decide that `ㄒㄧㄥ2` is a valid numbered-row pronunciation.

This policy is scoped **only** to the immediately preceding atomic
ordinal such as `第三`, `第十二` or `第3`. Bare `三行`,
unrelated `行`, longer words such as `行動`, and all other reviewed
role constraints are untouched. The previous whole-sentence rejection
and forced written-word preservation are gone.

## Paired experiment and rollout controls

See [Draft PR #427](https://github.com/Mochi96336/bopomofo-trainer/pull/427)
for the exact 2,048-seed experiment. Compared to in-place correction,
scoped legal-first selection changed **12/2,048** fixed seeds. In all
12 cases, **only the one lexical slot immediately after an atomic 第N**
changed; no other lexical IDs changed. Eleven seeds previously had not
chosen `第N行`, showing why a changed probability distribution must
not be mislabeled an unrelated regression.

At seed 931 the preserved-word experiment emitted
`上第三行自己只是河北`; scoped legal-first emitted
`上第三類自己只是河北`, correctly selecting different written
words in the same slot. Neither full sentence is an independently
validated naturalness example. Changing these fixed RNG outcomes is
not proof of better or worse semantic quality.

CI must verify both full `check` (including browser) and a deterministic
2,048-seed audit: 0 illegal `第N行` readings, 0 changes **outside**
the ordinal-adjacent lexical position, and 0 generation failures.
A fixed-seed test that demands the original word always survive is
incompatible with removing the invalid reading's selection mass.

**Draft until code and outputs are reviewed; no automatic merge.**
