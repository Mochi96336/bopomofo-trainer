import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { validateDongxiUdIntake, type DongxiUdCorpus } from "../src/readings/dongxi-ud-intake.js";

const source = "data/readings/dongxi-ud-gsd-attested-review-candidates.json";
const output = "data/generated/dongxi-ud-intake-summary.json";
const corpus = JSON.parse(await readFile(source, "utf8")) as DongxiUdCorpus;
const report = validateDongxiUdIntake(corpus);
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  source, output,
  ...report,
  warning: "Attested independent tokens and triage sense proposals do not establish verified readings, human naturalness judgments, or a held-out evaluation set.",
}, null, 2));
