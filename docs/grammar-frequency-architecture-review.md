# Grammar, reading priors and exercise allocation

## Architectural finding

The v2 refactor made sampling consistent and measurable. It did not establish
that the grammar is a complete Mandarin grammar or that exercise frequencies
estimate language-use frequencies. Those are separate contracts.

The generator must distinguish:

1. **Grammatical capability:** permitted structural argument frames, marking,
   ordering and lexical realization.
2. **Reading license:** which exact pronunciation identities may realize a
   lexical use in that formal context. A license is not an occurrence count.
3. **Usage prior:** observed frequency at its actual identity scope: written
   form, lexical use, or reading. Missing reading-frequency evidence is unknown.
4. **Exercise allocation:** desired coverage, adaptation, variety and burden.
   This can deliberately differ from usage, but must have its own policy and
   measured outcome.

No definition, meaning judgment or inferred sense may substitute for missing
formal evidence. Productive open-class grammar must also distinguish
`not observed` from `forbidden`; a finite corpus is not an exhaustive grammar.

## Scan of 2b3b94e

- The runtime contains 13,695 reading identities and 13,472 written forms.
- `sentence.exclamative` requires an `InterjectionPhrase`, whose lexical rule
  requires INTJ. The packaged lexicon has zero INTJ profiles, despite a positive
  4% nominal exclamative prior. Structural-only reachability tests miss this.
- In 128 full-catalog sequential deliveries, 91 were declaratives, 27 questions
  and 10 requests; no exclamatives were delivered. These are finite sample
  counts, not estimates of natural Mandarin construction frequencies.
- Written and spoken NAER frequencies are separately log-normalized and mixed
  40/60, then mapped to weights with a 0.05 floor. The largest possible
  individual weight ratio is 20, whatever the original frequency ratio. This
  is a vocabulary-diversity policy, not a corpus-proportional probability.
- Distinct written-form weight sums by tier were approximately 22.3%, 24.0%,
  27.7%, 26.1%. These describe a hypothetical shared frontier, not actual
  delivered exposure, because syntax creates different conditional pools.
- All licensed readings with equal learner weights receive equal conditional
  probability. No reading-use frequency evidence supplies that equality.
- Tier quantiles still count reading identities. Adding a reading can move
  unrelated written forms to a different tier, despite written-form sampling
  correctly avoiding duplicated lexical mass.
- Root priors, lower structural alternatives, optional counts, lexical
  realization success, practice-intent recovery and bounded final acceptance
  jointly determine output. A positive root prior is not a delivery guarantee.

## Method

Keep the formal grammar and canonical construction taxonomy. Compile a
catalog-scoped feasibility view under the actual derivation bounds before
assigning root attempts. Zero possible lexical shapes is definitive exclusion;
positive abstract shape count is only potential feasibility, since lexical
uniqueness, bindings and contextual reading licenses still need realization.
The view must never infer impossibility from an unsuccessful random probe.

Written-form frequency owns written-form tiering and base mass. Reading priors
need an explicit scope and evidence state. A uniform allocation among licensed
readings may be used as a declared training prior, never labeled observed
reading frequency. Learner weighting should compose through normalized
conditional probabilities so its mass can be explained rather than inherited
from a `max` heuristic.

Grammatical capability should converge on explicit lexical-frame alternatives,
with argument ownership and same-occurrence construction certificates. General
observed dependency roles remain evidence, not exhaustive capability gates.
Independently reviewed source examples and targeted invalid mutations must
validate linguistic coverage in addition to self-generated cardinality tests.

## Work and evidence

- [x] Compile scoped lexical feasibility and condition active family mass.
- [x] Make tier boundaries invariant to reading multiplicity.
- [x] Separate declared reading allocation from unsupported usage-frequency claims.
- [x] Compose written-form mass and reading adaptation with a normalized model.
- [x] Audit effective root, frame, word, reading and token distributions together.
- [x] Document grammar coverage, argument ownership and remaining evidence gaps.
- [x] Verify migration, deterministic replay, production gates and browser backup.

Changes to the current product must be versioned separately from the frozen
historical reading-identity audits. No unreviewed attested-context research
branch is automatically activated.

## Grammar assessment and next boundaries

The tree is a useful bounded exercise grammar, with explicit categories,
cardinalities, feature propagation, valency and construction certificates. It
does not establish a complete linguistic analysis of Mandarin. Its strengths
are executable constraints and reproducibility; its weakest evidence is the
independence of linguistic validation from the grammar authoring process.

Most core clauses use an object-free `Predicate` and let `Clause` own subjects
and objects. An omitted object does not turn a transitive frame into an
intransitive lexical capability. BA, passive, comparative and locative paths
retain separate construction restrictions rather than flattening them into
ordinary verb weights. Selected profiles' frame labels are potentially
overlapping capabilities, so the audit reports them separately from actual
Clause-family occurrences.

Two visible legacy paths remain: `clause.topic-comment` and
`sentence.constituent-subject-question` use `VerbPhrase`, which can own its
objects. A safe migration needs explicit argument ownership and surface
omission for each construction, source-backed valid examples and independent
invalid counterexamples. Merely replacing the category with `Predicate` would
silently remove licensed objects and is not a sound structural cleanup.

Runtime profiles join several observations by written form and UPOS. Separate
function and frame arrays cannot prove that those properties co-occurred in one
usage. Existing same-occurrence capability certificates correctly preserve that
distinction for reviewed marked constructions. Extend that approach into
explicit frame alternatives rather than ANDing unrelated counts. Do not hard
gate productive subject/object use by its absence from a finite corpus.

Generated minimum/maximum/overflow fixtures validate implementation consistency.
They do not independently establish a rule's linguistic validity. The next
grammar expansion should add pinned source examples with reviewed attachment,
argument ownership and local minimal-pair mutations before adding constructions.
Longer and recursive trees should remain independently bounded and evaluated.

## Reading correctness is a separate unresolved evidence problem

The current reading gates encode reviewed restrictions; passing them means
permitted by those restrictions, not independently verified in every generated
context. Same written form and same UPOS can retain several noninterchangeable
readings. A dictionary's list of readings or their ordering cannot establish
either a context label or a numeric use prior. Learner weakness must not decide
which pronunciation is context-correct.

The current-product audit now reuses `buildSameUposReviewQueue` on delivered
sentences, with the actual selected profiles and reading IDs. The queue is a
review lead, not an error count; observing only one reading also does not prove
correctness. Reviewed free alternants, formally conditioned readings and
unresolved contextual readings need distinct evidence states. A blanket ban
based only on same-UPOS multiplicity would discard legitimate alternants.

Remote research #434 documents source-UPOS counterexamples and pending
independent review; #431's attested contexts remain ineligible. These branches
are not production fixes and have not been activated. The appropriate next
reading work is a reviewed context contract and an abstention policy with a
coverage denominator, followed by an independent held-out assessment. It is
not a guessed distribution from corpus POS or an unreviewed semantic model.

## v3 delivery observations

The original deterministic sample namespace is retained for comparison.
In 128 full-catalog sequential deliveries, v3 produced 87 declaratives, 33
questions and eight requests, with zero repeated visible sentences and zero
bounded-best-effort deliveries. This is an engineering observation, not
calibration against natural-language construction frequency.

Matched fresh-user cohorts of 256 seeds increased target occurrences per 100
syllables by 2.44 for tone 3, 5.11 for tone 4 and 0.97 for zhuyin ㄗ. These are
synthetic recent-error responses, not estimates of human learning improvement.
The full generated report records nominal and availability-conditioned first
root priors alongside actual deliveries, nested Clause families, selected
profile capabilities, complete written-form/reading/tier/token counts and
context-review leads. Counts from different identity scopes are never treated
as interchangeable frequencies.

Of the full-catalog sample's 544 lexical occurrences, tiers 1..4 supplied
303/79/84/78 (55.7%/14.5%/15.4%/14.3%). Function-word and construction frontiers
make this different from the hypothetical shared-frontier weight sums above.
Tier-only scopes 3 and 4 had only declarative roots potentially available;
tier 2 also admitted constituent questions. This is now visible before drawing.

The tier-1 sample observed multiple same-UPOS readings in three groups: 那/PRON,
給/VERB and 哪/PRON. The first two remain unreviewed context variation in this
queue (ten occurrences), while 哪 has a reviewed role-alternant contract.
Neither figure is a pronunciation-error rate. The full-catalog sample happened
not to observe two readings in one UPOS group; that does not clear the problem.

## Validation

`npm run check:pr` passed 1,435 Vitest tests, 76 Python tests, current-product
selection/exposure audits, catalog validation, typecheck, build and bundle
budget. Playwright passed 62 tests, including real-round backup restoration;
the simulation suite passed 43 tests. Explicit regression coverage checks
nonempty selection-v2 migration, inherited lexical requirements, synthetic
literal practice counts, reading-multiplicity-invariant tiers and the exact
joint word/reading distribution. Historical replay remains a separate frozen
population, not an accuracy label for the revised product.
