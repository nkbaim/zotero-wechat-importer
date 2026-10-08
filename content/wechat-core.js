(function (root) {
  "use strict";

  const STOP_WORDS = new Set([
    "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of",
    "on", "or", "the", "to", "with", "研究", "分析", "的", "与", "和"
  ]);

  function cleanString(value, maxLength = 2000) {
    return typeof value === "string"
      ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
      : "";
  }

  function normalizeDOI(value) {
    const doi = cleanString(value, 300)
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "")
      .replace(/[\s.,;]+$/, "")
      .toLowerCase();
    return /^10\.\d{4,9}\/\S+$/i.test(doi) ? doi : "";
  }

  function normalizePMID(value) {
    const match = cleanString(String(value || ""), 30).match(/\d{4,12}/);
    return match ? match[0] : "";
  }

  function titleTokens(value) {
    return new Set(
      cleanString(value, 1000)
        .toLocaleLowerCase()
        .match(/[\p{L}\p{N}]+/gu)
        ?.filter((token) => token.length > 1 && !STOP_WORDS.has(token)) || []
    );
  }

  function titleSimilarity(left, right) {
    const a = titleTokens(left);
    const b = titleTokens(right);
    if (!a.size || !b.size) return 0;
    let intersection = 0;
    for (const token of a) if (b.has(token)) intersection++;
    return (2 * intersection) / (a.size + b.size);
  }

  function parseJSONContent(content) {
    if (content && typeof content === "object") return content;
    const cleaned = cleanString(content, 100000)
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    if (!cleaned) throw new Error("模型返回了空内容");
    return JSON.parse(cleaned);
  }

  function normalizeCandidates(content) {
    const parsed = parseJSONContent(content);
    const raw = Array.isArray(parsed) ? parsed : parsed.references;
    if (!Array.isArray(raw)) throw new Error("模型返回结果中缺少 references 数组");

    const seen = new Set();
    const candidates = [];
    for (const entry of raw.slice(0, 30)) {
      if (!entry || typeof entry !== "object") continue;
      const title = cleanString(entry.title, 1000);
      const doi = normalizeDOI(entry.doi);
      const pmid = normalizePMID(entry.pmid);
      const query = cleanString(entry.query, 1000) || title;
      if (!title && !doi && !pmid && !query) continue;
      const key = doi || pmid || title.toLocaleLowerCase() || query.toLocaleLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push({
        title,
        authors: Array.isArray(entry.authors)
          ? entry.authors.map((author) => cleanString(author, 200)).filter(Boolean).slice(0, 20)
          : cleanString(entry.authors, 1000).split(/[,;，；]/).map((author) => author.trim()).filter(Boolean),
        journal: cleanString(entry.journal, 500),
        year: cleanString(String(entry.year || ""), 20),
        doi,
        pmid,
        query,
        evidence: cleanString(entry.evidence, 1500)
      });
    }
    return candidates;
  }

  function resultKey(record) {
    return normalizeDOI(record.doi) || normalizePMID(record.pmid)
      || cleanString(record.title, 1000).toLocaleLowerCase();
  }

  function weChatImageURL(value, articleURL) {
    if (!value) return "";
    try {
      const url = new URL(value, articleURL);
      if (url.protocol === "http:") url.protocol = "https:";
      return url.protocol === "https:" && !url.username && !url.password && !url.port
        && ["mmbiz.qpic.cn", "mmbiz.qlogo.cn"].includes(url.hostname)
        ? url.href : "";
    } catch (_error) {
      return "";
    }
  }

  function imageDataURL(buffer) {
    const bytes = new Uint8Array(buffer);
    let type = "";
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) type = "image/jpeg";
    else if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) type = "image/png";
    else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) type = "image/gif";
    else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) type = "image/webp";
    if (!type) throw new Error("图片格式不受支持（仅支持 JPEG、PNG、GIF、WebP）");
    let binary = "";
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    }
    return `data:${type};base64,${btoa(binary)}`;
  }

  const api = {
    cleanString,
    normalizeDOI,
    normalizePMID,
    titleSimilarity,
    parseJSONContent,
    normalizeCandidates,
    resultKey,
    weChatImageURL,
    imageDataURL
  };

  root.WeChatImporterCore = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
