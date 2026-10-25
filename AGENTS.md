# Work instructions: bopomofo-trainer

## Current task contract: reduce incorrect Zhuyin readings

**Binding user constraint (reaffirmed 2026-10-21 and 2026-10-26):**
Focus only on reducing **incorrect target Zhuyin readings**. **DO NOT pursue more natural sentences**, do not improve grammar/lexical selection for semantic fluency, and do not turn observations about awkward generated text into a task.

The trainer exercises **Bopomofo keyboard tokens and their precise positions/transitions**. Generated sentences are containers for drills, **not** natural-language-generation quality targets. Grammatically supported but semantically odd sentences are acceptable for this task. See the established product boundary in `README.md`.

### Allowed within this task
- Audit actual selected **catalog reading identity** against traceable, independently reviewed Ministry of Education (MOE) target readings in attested contexts.
- Use attested natural text as **pronunciation evidence**, NOT as a requirement to generate natural-sounding sentences.
- Differentiate an exact whole-lexeme reading from a single-character reading and disambiguate only where verified context supports it.
- Compare accepted-correct / verified-wrong / ambiguous-or-abstained cases; report denominators and preserve legitimate phonetic reading coverage.
- Once a reading is established, use learner weakness **only to weight which verified items appear**, never to change the correct phonetic identity.
- Keep investigations separate from the shipping generator until a well-supported change is explicitly justified and verified.

### Explicitly out of scope unless user separately requests it
- Optimizing generated-sentence naturalness, semantic coherence, fluency, or aesthetic quality.
- Redesigning sentence templates, grammar, POS/lexical selection, corpus generation, or ranking to improve naturalness.
- Adding LLM sentence generation, models, broad grammar features, or naturalness acceptance/rejection as a workaround for wrong readings.
- Repeatedly expanding CI, reports, or proxy metrics when they do not directly move **verified wrong-reading reduction**.
- Treating reduction of flagged candidates, removal of polyphonic exercises, unchanged written sentences, or CI success as a measured reduction in wrong pronunciations.

### Stop rule before any change or recommendation
Ask internally: **Does this measurably reduce verified wrong pronunciations without hiding legitimate readings?** If not, do not pursue it under this task. An unnatural sentence may be noted as *out-of-scope context*, never converted into a new goal. Do not broaden the task without the user's explicit request.

### Reporting contract
Report briefly: (1) **verified reading corrections** with concrete examples and evidence; (2) **wrong-reading rate** with verified numerator/denominator or say *not yet measurable*; (3) legitimate reading coverage/abstentions and remaining uncertainty. Do not substitute naturalness or the number of commits/tests for these outcomes.

These instructions apply to this scoped reading-reliability work; they do not replace unrelated user-requested tasks.
