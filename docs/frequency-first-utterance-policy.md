# Frequency-first grammatical utterance policy

## Executable policy

Production uses `frequency-first-utterance-v3`. The selector is hierarchical:

1. Compile bounded lexical feasibility for the current catalog. Remove roots
   with zero potential lexical shapes from the root-family prior, then sample.
   A positive abstract shape count does not prove joint reading/binding or
   uniqueness feasibility; actual realization remains mandatory.
2. Filter each lexical frontier by syntax and **all** reviewed reading licenses.
   Within that complete licensed slot frontier, exclude every reading of a
   written-form/UPOS group that still has unresolved alternatives. Only explicit
   reviewed free alternants (哪/PRON and 和/CCONJ) are exempt. This happens before
   identity binding, used-word exclusion, zero weights or learner adaptation.
3. Draw a written form, then a permitted reading, then a compatible profile.
4. Assess the completed candidate for visible repetition, construction recency,
   and typing burden. Accept probabilistically or draw another complete candidate.
5. After four candidate draws, deliver the legal candidate with the highest
   acceptance probability, explicitly marked `bounded-best-effort`.

Each candidate generation has at most 64 structural attempts. A failure-only
second pass removes optional practice intents while retaining grammar, the
catalog, root-family policy, and reading licenses. If no legal candidate exists
in any bounded draw, selection fails closed; no word-list fallback exists.

`selection-policy.ts` owns constants and validation; `lexical-selection.ts`
owns written-form/reading/profile probability; `selection-scoring.ts` owns
learner and acceptance factors; `frequency-first-utterance.ts` coordinates
formal generation and bounded retries. Formal grammar never imports curriculum
weights.

## Lexical probability

For each eligible reading identity:

```text
readingWeight = reviewedFrequencyWeight * boundedLearnerBoost * writtenRecencyFactor
writtenFormWeight = mean readingWeight among its eligible readings
P(text | slot) = writtenFormWeight / sum of eligible writtenFormWeights
P(reading | text, slot) = readingWeight / sum of that text's readingWeights
P(profile | reading, slot) = 1 / number of compatible profiles
```

A form owns one ticket. Adding another identical-weight reading or another
compatible profile does not multiply that form's frequency mass. This is the expected reading weight under the explicit uniform licensed-reading
training prior. Text mass and conditional reading probability therefore compose
into one joint weight proportional to frequency times reading prior times learner
boost. There is no independent maximum aggregation. Reading probabilities are a training
allocation, not an assertion of pronunciation frequencies: NAER frequency is
written-form evidence, not reading-frequency evidence.

All reading gates precede weighting. An unsupported high-weight reading cannot
lend mass to a legal homograph or trigger a post-selection replacement in the
current product. Identity-bound repetitions such as A-not-A retain the same
reading identity. Other slots cannot reuse a written form within the sentence.

Frequency comes only from `commonnessBase.selectionWeight`; missing evidence
weighs 1, including fixtures. There is no parallel band-weight fallback.
Unlocked/enabled commonness tiers filter the catalog before this algorithm, so
adaptation cannot admit a disabled or locked entry.

## Learner evidence

Only expected-token correctness and accepted clean binding timing affect
adaptation. Actual wrong tokens and transition/confusion aggregates never feed
product selection. Evidence is scoped by practice mode and physical layout.

Cumulative diagnostics remain intact. Adaptation keeps independent bounded
windows per token:

- the last 32 correctness observations, gated at four observations;
- the last 24 accepted clean timing samples, gated at eight samples;
- timing compares the median of the newest eight samples with the 25th
  percentile of the retained timing window, rather than a lifetime single best;
- low-exposure tokens receive a bonus starting at 0.10 and decreasing to zero
  at eight cumulative attempts. This is exploration, not a claim of weakness.

For an observed token:

```text
errorContribution = recentErrorRate * 1.5
timingContribution = max(0, recentMedian / windowQuartile - 1) * 0.35
coverageContribution = 0.10 * max(0, 1 - cumulativeAttempts / 8)
tokenBoost = clamp(1 + the three contributions, 1, 1.45)
```

An unseen token gets only the coverage bonus. A reading's boost is the maximum
of its token boosts. The combined extension cap remains 1.50; production has
no archived transition extension. The policy does not prescribe a dosage for
repeating a target token multiple times within a word.

Imported old cumulative aggregates remain diagnostic evidence. They do not
pretend to contain recent adaptation samples: fresh windows start with new
observations. All bounds and the independent timing/correctness exclusions
continue to apply.

## Delivery quality and recency

The last 24 distinct entry IDs and written forms are retained in chronological
LRU order. Written-form recency affects every reading of that form. Its factor
is 0.72 for the newest form and decays linearly toward 1 over the retained
window. This is a term-count window, not a number of rounds.

Whole-sentence history retains eight visible lexical sequences, independent of
reading, profile and derivation IDs. Construction history retains four distinct combinations of Sentence family
and nested Clause families, classifying executable variants through the canonical
taxonomy. Transitive and BA statements therefore have different repetition
identities, while the two A-not-A executable variants share their family.
The newest repeated construction has factor 0.78, decaying toward 1 with age.

```text
burdenFactor = min(1, 12 / syllableCount, 40 / expectedKeystrokeCount)
acceptanceProbability = visibleSentenceRecency * constructionRecency * burdenFactor
```

Visible-sentence recency is 0.30 when repeated and 1 otherwise. The 12-syllable
and 40-keystroke targets are soft product defaults, not proficiency thresholds.
The grammar's 2..6 lexical-entry bounds still apply. A legal long candidate can
be delivered, particularly through bounded best effort; burden is never an
excuse to violate grammar or pronunciation licenses.

Word weights are applied during lexical selection; they are **not** multiplied
again at delivery. The production trace contains local entry weights, token
contributions, construction identity, syllable/keystroke counts, acceptance
factors, the number of draws and whether best effort was necessary. It has no
fictional whole-sentence `totalWeight` or claim to an exact global probability.

## Effective distribution

The root-family prior remains a curriculum prior, not corpus sentence frequency.
Nested Clause/phrase sampling and bounded failure recovery still affect output.
Repetition and burden acceptance intentionally modify realized family shares.
Do not infer final distribution from nominal priors alone. Strict tier-only
settings can exclude the closed-class vocabulary needed for questions: in the
64-delivery audit, tiers 3 and 4 alone realized only declaratives. This is a
conditional catalog limitation, not a promise of 26% questions in every scope.
The selector does not silently re-enable a disabled tier to satisfy a prior.

`npm run selection:audit` exercises `createProductState` with the real packaged
catalog, prepared execution, complete reading policy, and delivery recency for
the full catalog and each individual commonness tier. It advances delivery
history without inventing typing observations. The generated report includes:

- root availability, configured/conditioned first-attempt priors, delivered root
  and nested clause family counts;
- complete written-form, reading, tier and token exposure and distinct counts;
- overlapping frame-capability counts on selected profiles (not sentence-frame
  probabilities), and same-UPOS multi-reading context-review leads;
- repeated sentences, consecutive constructions, recent terms;
- syllable/keystroke distributions, candidate attempts and best effort;
- structural and availability fallback reasons;
- catalog/profile digests and policy version.

Generation failure or an unlicensed delivered reading fails the command. The
report is a current product-health diagnostic, not a locked historical snapshot
or evidence of human learning effectiveness. Run larger samples before changing
training priors; the routine gate uses 128 deliveries per scenario.

`npm run selection:exposure` additionally compares 256 identical fresh-user
seeds for baseline, weak tone 3, weak tone 4 and weak zhuyin token cohorts. The
synthetic cohort has 24 errors in a 32-observation recent window, with all other
inputs fixed. Every delivered reading is checked against the same licenses.
It reports target occurrences per 100 syllables, sentence coverage and changed
seeds. A non-positive target-exposure delta fails this deterministic health
check; this is not a significance test or an estimate of human improvement.

## Persistence and historical evidence

Product progress is schema 9, measurement epoch `coordination-v1`. Selection v2
migrates to v3 without resetting recency or measurements, because the stored
identities and observation semantics remain compatible. Written-form tier cuts
are computed on distinct forms, so adding a reading cannot move unrelated words
between tiers. Schema 8
selection v1 migrates entry history into written-form recency, preserving
measurements, completed rounds and recent summaries. Old derivation IDs and
empty template history cannot reconstruct visible/construction recency, so
those two small histories restart. Schemas 7 and 6 retain their earlier envelope
migrations; schema 6 still resets incompatible measurement evidence. Schemas
1..5 remain rejected.

The generic composer retains explicit `reading-identity` sampling for historical
comparison tools. The browser explicitly chooses `written-form` sampling.
Ordered post-draw reading repairs and geometric sentence scores belong only to
that historical compatibility surface; they do not determine product v3 output.
Same-version seed/catalog/progress replay is deterministic. Preserving v1's
exact sentences across this intentional version change is not a requirement.

The frozen Phase 1 grammar meter uses the checksum-verified `before-qian`
catalog snapshot and reading-identity sampling. Current-product audits use the
current catalog instead. Neither workflow mutates source to collect traces:
formal candidates expose their actual production path.
