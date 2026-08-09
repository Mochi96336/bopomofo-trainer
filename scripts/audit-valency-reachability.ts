import { SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { auditValencyReachability } from "../src/syntax/valency-reachability-audit.js";

const audit = auditValencyReachability(FORMAL_SYNTAX_RULES, SYNTAX_PROFILES);
console.log(JSON.stringify(audit, null, 2));
