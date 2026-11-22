import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { setFlagsFromString } from "node:v8";

setFlagsFromString("--no-incremental-marking");

const { run } = await import("./solve.js");

// In the Docker sandbox these are /input and /output; under the local
// process driver the harness hands the same directories over in the
// environment instead of mounting them, so read them from there first.
const inputDir = process.env.MAKEFUN_INPUT_DIR ?? "/input";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

const cases: Array<{ input: unknown }> = JSON.parse(readFileSync(inputDir + "/cases.json", "utf8"));
const answers: unknown[] = [];
for (let k = 0; k < cases.length; k++) {
  // Each case is answered on its own, with no state kept between cases:
  // run builds every answer from the one case it is given.
  answers.push(run(cases[k].input));
}
mkdirSync(outputDir, { recursive: true });
writeFileSync(outputDir + "/answers.json", JSON.stringify(answers));
