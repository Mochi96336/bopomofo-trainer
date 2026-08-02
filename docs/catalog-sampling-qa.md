# Catalog sampling QA

Every entry in the shipped catalog has passed formal validation: the reading
parses into legal syllables, the entry satisfies the syntax legality gate, and a
grammar profile exists for it. None of that says the reading is the one a reader
would give the word, or that the grammatical role is the one the word has.

Those are judgements. The only way to know the rate at which they are wrong is
to look at a sample and count. This is how that is done, and how the result is
recorded so the next expansion can be compared against it.

## Why it exists

`docs/roadmap.md` accepts two known, unmeasured error sources: grammar roles
assigned directly from stable UD evidence, and CC-CEDICT heteronyms activating
each distinct reading as its own entry. "Unmeasured" is the operative word. A
catalog that grows without a baseline can only ever report the error rate it has
after growing, with no way to tell what the new batch contributed.

So the baseline is drawn **before** the next expansion, not after it.

## Drawing a sample

```bash
npm run qa:catalog-sample
```

Writes `data/qa/catalog-sample.csv` — the review sheet — and
`data/qa/catalog-sample.meta.json` beside it. The sheet is UTF-8 with a BOM so a
spreadsheet reads the Chinese rather than the system code page.

The draw is deterministic by seed, so the same catalog and seed always produce
the same rows: a sample nobody can reproduce cannot be reviewed in a pull
request, and one drawn afresh each run cannot be compared with the last.

```bash
npm run qa:catalog-sample -- --seed 2026-q3 --base 300 --per-level 40
```

The sheet holds two kinds of row, and the `selection` column says which is
which. They are not interchangeable.

`--base` draws a plain uniform sample of the catalog. These are the `base` rows,
and the catalog rate is computed from them and from nothing else.

`--per-level` then guarantees a floor for every level of every stratum, because
the levels that carry the risk are exactly the ones a uniform sample would barely
touch. These are the `floor` rows. They exist to locate problems, never to
measure the catalog — see below for why they cannot do the second job.

The two sets are merged and de-duplicated, so the sheet is smaller than their
sum.

## The strata

| Stratum | Levels | What it separates |
| --- | --- | --- |
| `readingSupport` | `moe-concised`, `moe-revised-fallback`, `manual-override`, `projection-disagrees`, `no-projection` | Which committed source, if any, carries the shipped reading |
| `heteronym` | `single-reading`, `multi-reading` | Whether the catalog ships more than one reading for the text |
| `cedict` | `unique-record`, `ambiguous-records`, `absent` | What CC-CEDICT says about the text's identity |
| `commonness` | `tier-1` … `tier-4` | The frequency band the learner meets it in |
| `grammarEvidence` | `none`, `weak-1-2`, `moderate-3-9`, `strong-10-plus` | How many observed dependencies stand behind the *least* supported role |
| `predicate` | `predicate`, `non-predicate`, `no-frame` | Whether the entry can head a clause |

`projection-disagrees` and `no-projection` are deliberately separate. A word no
committed source covers is a gap; a word a committed source covers *differently*
is an override, and those are not the same risk.

`grammarEvidence` grades an entry on its weakest role rather than on its total.
Summing across profiles let a well-evidenced role vouch for a thin one sitting
beside it: an entry with NOUN on twelve observed dependencies and PART on two
came out `strong-10-plus`, so the stratum treated it as a safe case while the
role actually at risk went unexamined. 1,494 entries were graded above their
weakest role that way, 427 of them as `strong-10-plus`. The minimum is also what
matches the question the reviewer is asked, since `role_verdict` is `wrong` if
*any* assignment is wrong — an entry is only well-evidenced when all of its roles
are. `predicate` stays an entry-level question: whether a word can head a clause
is true of the word if it is true of any profile it has.

## Reviewing

Fill in two columns per row, each `ok`, `wrong` or `unsure`:

- `reading_verdict` — is this the reading this word has, in this written form?
- `role_verdict` — see below; it needs a precise statement.

### What `role_verdict` is judging

The sheet shows what the entry was actually assigned, because a reviewer cannot
judge a role they were never told:

| Column | Meaning |
| --- | --- |
| `assigned_profiles` | Every runtime syntax profile, as `UPOS=evidence[frame,frame]`, `\|`-separated |
| `profile_count` | How many of them there are |

The number after each tag is that profile's own dependency count. It is there
because `grammarEvidence` reports only the weakest of them, and a reviewer
looking at a `weak-1-2` entry with three profiles needs to see which one is the
weak one.

Profiles are shown whole, not as two flattened sets. An earlier sheet carried
every distinct UPOS in one column and every distinct frame in another, which
cannot say which tag licensed which frame. `ADJ[intransitive] ADV[avalent]` and
`ADJ[avalent] ADV[intransitive]` produced identical columns, so a reviewer had no
way to see the second one was wrong — and the runtime composes from whole
profiles, so it is wrong in a way that reaches the learner.

Most entries have one profile, but 1,983 of them carry more than one distinct
UPOS and a few carry six. So the question has to be asked at the level of the
entry rather than of a profile:

> **`role_verdict` is `wrong` if any assigned UPOS or frame is one this word does
> not have.** It is `ok` only when every assignment listed is defensible.

That is the product-relevant question rather than the convenient one. The runtime
composes utterances from these profiles, so a single wrong assignment on an entry
is enough to put that word in a slot it does not belong in — whether or not its
other assignments are right.

The consequence is that the reported rate is "share of entries carrying at least
one wrong role assignment", not "share of assignments that are wrong". An entry
with six profiles has more chance to fail than one with a single profile;
`profile_count` is on the sheet so that can be looked at rather than guessed.

`unsure` is a real answer and should be used. A reviewer forced to guess produces
a number that reads as measurement and is not one. `notes` is free text; use it
whenever `wrong` needs an explanation to be actionable.

Review both columns for every row, even when one is obviously fine. Skipping the
easy ones biases the denominator — and so does skipping the hard ones, which is
the likelier habit; the scorer will not report a rate until the base sample is
finished.

## Scoring

```bash
npm run qa:catalog-score -- data/qa/catalog-sample.csv
```

Scoring refuses to run unless the sheet still matches the `.meta.json` drawn with
it. The digest covers every column except the verdicts and notes, so pairing a
sheet with the wrong metadata, or sorting the rows in a spreadsheet and saving,
is reported rather than silently scored against rows that are no longer the ones
that were drawn.

The inner manifest digest binds the seed, requested sample sizes, sheet digest
and `recordedSourceDigests`. A second `integrityDigest` covers the complete
metadata object, including the actual sample and catalog counts, every stratum
count and `drawnAt`. Editing one of those descriptive fields can therefore no
longer leave the scorer saying that the metadata agrees.

Two things are worth being exact about here. These source digests are **recorded,
not verified**: nothing recomputes them from the sources, and nothing could
usefully, because a sample may have been drawn against an older commit and
disagreement with the working tree is then expected rather than wrong. And a
digest stored beside the data it covers is evidence against an accident or a
mismatched pair, not against someone who means it — they can recompute it too.
The record that cannot be quietly rewritten is the commit history.

Reading and grammar role are reported apart and are never combined. They fail
for different reasons and are fixed in different places, and a single number
covering both would hide whichever is healthier behind whichever is not.

Two things come out, and only one of them is a measurement.

**The catalog rate** is counted over the `base` rows alone, with a 95% interval
beside it. Those rows are a uniform sample, so the count needs no weighting and
carries no selection bias. This is the number to quote — when there is one.

There are three things the scorer will say, and only the last is a measurement:

| State of the base sample | What is reported |
| --- | --- |
| Any row still blank | Progress and running counts, explicitly not a rate |
| All answered, some `unsure` | A range: `wrong / total` to `(wrong + unsure) / total` |
| All answered `ok` or `wrong` | The rate, with its interval |

The denominator is always the whole base sample, never the part of it that got
answered. Dropping the rest is what a complete-case rate does, and the rows it
drops are not missing at random: a reviewer works through the obvious words first
and leaves the doubtful ones blank or marks them `unsure`, so the survivors are
the rows least likely to be wrong. The result would be a number shaped exactly
like the real one — a percentage with a confidence interval — describing only the
rows that happened to get answered.

The `unsure` range is not a confidence interval and cannot be narrowed by drawing
more rows. It is the span between "every unsure turns out fine" and "none of them
do", and the only thing that closes it is answering them.

**The per-stratum rates** answer where a problem sits. Each level is counted over
the base rows plus the rows *that stratum's own floor* reached for, with a sample
size and an interval.

They are reported only after every sampled row in that verdict column is `ok` or
`wrong`. The catalog headline may become reportable earlier because it depends
only on the complete base sample; localisation cannot. Showing a level rate while
some floor rows are blank or `unsure` would silently remove the cases the reviewer
found hardest from that level's denominator and reintroduce complete-case bias.

Rows drawn only by a different stratum's floor are left out of that count. They
are on the sheet for being rare somewhere else, and rarity is assumed to travel
with error, so counting them here would raise whichever level of this stratum
they happen to sit in. Against a population where the fault was confined to one
stratum, counting every row put two innocent strata at 6.1% when their true rate
was around 1.3% — outside the interval the correct count gives. A diagnostic that
points at the wrong data source is worse than none.

Base membership and within-level floor membership are both decided by shuffle
rank alone, which is independent of anything a review will find, so their union
is still a uniform sample of the level.

### Why the floor rows cannot be reweighted into an estimate

It is tempting to take each level's rate and weight it by that level's share of
the catalog. That does not work here, and an earlier version of this tool did it
anyway.

Whether a floor row was drawn depends on **all six strata at once**. So inside
any one level, the floor rows over-represent whatever is rare on the other five
dimensions — and if error tracks rarity, which is the entire hypothesis, their
rate is inflated. Weighting by one dimension's catalog shares cannot undo a bias
the other five introduced.

Measured against a uniform reference sample under an error model correlated
across dimensions, that reweighting overstated a true 21.3% rate as anywhere from
22.3% to 29.5% depending on which dimension it weighted by — six mutually
inconsistent answers, with nothing to say which was the real one. Counting the
base rows gave 23.0%, inside its own confidence interval.

## Recording a result

The drawn sheet is committed unfilled and gains its verdicts in place, so the
diff of a review pull request is exactly the judgements that were made. Keep the
`.meta.json` beside it: the digests in that file are what tie the result to a
specific catalog state, and a rate without the catalog digest it was measured on
cannot be compared with anything.

When a new baseline is drawn — after an expansion, or with a new seed — copy the
finished sheet and its metadata aside under a dated name before overwriting them,
so the comparison has something to compare against. Drawing over a sheet that
already holds verdicts is refused unless `--force` is passed, so forgetting this
costs a message rather than the review.

## What this is not

It does not gate CI, and it should not. Sampling QA answers "how wrong is the
data", which is a question with a number for an answer and a judgement about
whether that number is acceptable. Wiring it to a threshold would turn a
judgement into a build failure and, worse, create pressure to review in whatever
way keeps the build green.

It also introduces no semantic model at runtime. Everything here is a review
protocol over data that already shipped.
