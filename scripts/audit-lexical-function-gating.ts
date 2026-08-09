import { SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { auditLexicalFunctionGating } from "../src/syntax/lexical-function-audit.js";

const audit = auditLexicalFunctionGating(SYNTAX_PROFILES);
console.log(JSON.stringify(audit, null, 2));
