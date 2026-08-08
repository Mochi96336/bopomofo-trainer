import {
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  SENTENCE_CONSTRUCTION_FAMILIES,
  sentenceConstructionFamilyPrior,
} from "../src/curriculum/formal-syntax-sampling-policy.js";
import { auditEqualRuleTicketDistribution } from "../src/curriculum/formal-syntax-taxonomy.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";

console.log(JSON.stringify({
  equalRuleTickets: auditEqualRuleTicketDistribution(FORMAL_SYNTAX_RULES),
  productPolicy: {
    version: PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.version,
    sentenceFamilyPriors: Object.fromEntries(SENTENCE_CONSTRUCTION_FAMILIES.map((family) => [
      family,
      sentenceConstructionFamilyPrior(family),
    ])),
  },
}, null, 2));
