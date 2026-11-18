/** No reading-use counts are supplied by the written-form NAER evidence.
 * Equal licensed-reading priors are an explicit exercise allocation, not an
 * estimate of pronunciation prevalence. Learner weights modify this prior.
 */
export const READING_ALLOCATION_POLICY = {
  version: "uniform-licensed-reading-training-v1",
  basis: "training-policy",
  usageFrequencyEvidence: "unavailable",
  writtenFormAggregation: "prior-expectation",
} as const;
