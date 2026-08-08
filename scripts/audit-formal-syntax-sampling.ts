import { auditEqualRuleTicketDistribution } from "../src/curriculum/formal-syntax-taxonomy.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";

const audit = auditEqualRuleTicketDistribution(FORMAL_SYNTAX_RULES);

console.log(JSON.stringify(audit, null, 2));
