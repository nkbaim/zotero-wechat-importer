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
assert.equal(core.weChatImageURL("//mmbiz.qpic.cn/s/paper.jpg", "https://mp.weixin.qq.com/s/example"),
  "https://mmbiz.qpic.cn/s/paper.jpg");
assert.equal(core.weChatImageURL("https://evil.example/paper.jpg", "https://mp.weixin.qq.com/s/example"), "");
assert.equal(core.weChatImageURL("https://user:pass@mmbiz.qpic.cn/paper.jpg", "https://mp.weixin.qq.com/s/example"), "");
assert.equal(core.imageDataURL(Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]).buffer),
  "data:image/jpeg;base64,/9j/2Q==");
assert.throws(() => core.imageDataURL(Uint8Array.from([1, 2, 3]).buffer), /格式不受支持/);
console.log("Core tests passed.");
