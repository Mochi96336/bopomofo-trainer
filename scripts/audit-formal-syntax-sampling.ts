import {
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  sentenceConstructionFamilyPrior,
} from "../src/curriculum/formal-syntax-sampling-policy.js";
import {
  auditEqualRuleTicketDistribution,
  type SentenceConstructionFamily,
} from "../src/curriculum/formal-syntax-taxonomy.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";

const sentenceFamilies: readonly SentenceConstructionFamily[] = [
  "statement.declarative",
  "statement.complex",
  "question.polar",
  "question.a-not-a",
  "question.alternative",
  "question.constituent",
  "request",
  "exclamative",
];

console.log(JSON.stringify({
  equalRuleTickets: auditEqualRuleTicketDistribution(FORMAL_SYNTAX_RULES),
  productPolicy: {
    version: PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.version,
    sentenceFamilyPriors: Object.fromEntries(sentenceFamilies.map((family) => [
      family,
      sentenceConstructionFamilyPrior(family),
    ])),
  },
}, null, 2));
