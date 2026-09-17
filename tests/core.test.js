"use strict";

const assert = require("node:assert/strict");
const core = require("../content/wechat-core.js");

assert.equal(core.normalizeDOI("https://doi.org/10.1000/ABC.1."), "10.1000/abc.1");
assert.equal(core.normalizeDOI("javascript:alert(1)"), "");
assert.equal(core.normalizePMID("PMID: 12345678"), "12345678");
assert.ok(core.titleSimilarity("Single-cell analysis of lung cancer", "Single cell analysis of lung cancer.") > 0.9);
assert.ok(core.titleSimilarity("Lung cancer atlas", "Kidney disease cohort") < 0.3);

const candidates = core.normalizeCandidates(`\`\`\`json
{"references":[
  {"title":"Example study","authors":["A. Author"],"doi":"DOI: 10.1234/TEST","pmid":"12345678"},
  {"title":"Example study","doi":"10.1234/test"}
]}
\`\`\``);
assert.equal(candidates.length, 1);
assert.equal(candidates[0].doi, "10.1234/test");
assert.deepEqual(candidates[0].authors, ["A. Author"]);
assert.throws(() => core.normalizeCandidates('{"items":[]}'), /references/);
console.log("Core tests passed.");
