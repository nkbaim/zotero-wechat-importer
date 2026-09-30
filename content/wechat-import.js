var WeChatImport = {
  io: null,
  article: null,
  results: [],
  selected: new Map(),
  busy: false,

  init() {
    this.io = window.arguments?.[0]?.wrappedJSObject || window.arguments?.[0];
    if (!this.io?.libraryID) throw new Error("No target Zotero library was provided");

    const target = [this.io.libraryName, this.io.collectionName].filter(Boolean).join(" / ");
    document.getElementById("target-label").textContent = `导入至：${target}`;
    document.getElementById("source-form").addEventListener("submit", (event) => {
      event.preventDefault();
      this.fetchArticle();
    });
    document.getElementById("analyze-button").addEventListener("click", () => this.analyzeAndSearch());
    document.getElementById("select-all").addEventListener("change", (event) => {
      this.selectAll(event.target.checked);
    });
    document.getElementById("import-button").addEventListener("click", () => this.importSelected());
    document.getElementById("close-button").addEventListener("click", () => window.close());
    this.updateControls();
    document.getElementById("url-input").focus();
  },

  validateWeChatURL(value) {
    let url;
    try {
      url = new URL(value);
    } catch (_error) {
      throw new Error("请输入完整的微信公众号文章链接");
    }
    if (url.protocol !== "https:" || url.hostname !== "mp.weixin.qq.com") {
      throw new Error("目前仅支持 https://mp.weixin.qq.com/ 的文章链接");
    }
    return url.href;
  },

  async fetchArticle() {
    if (this.busy) return;
    try {
      const url = this.validateWeChatURL(document.getElementById("url-input").value.trim());
      this.setBusy(true, "正在提取微信公众号文章...");
      const response = await Zotero.HTTP.request("GET", url, {
        timeout: 45000,
        headers: { Accept: "text/html,application/xhtml+xml" }
      });
      const html = response.responseText || response.response || "";
      this.article = this.parseArticle(html, url);
      document.getElementById("article-title").textContent = this.article.title || "（未识别标题）";
      document.getElementById("article-meta").textContent = [
        this.article.account,
        this.article.author,
        this.article.date
      ].filter(Boolean).join(" · ") || "已提取正文，可在下方检查或修改";
      document.getElementById("article-text").value = this.article.text;
      document.getElementById("article-card").hidden = false;
      document.getElementById("empty-state").hidden = true;
      document.getElementById("analyze-button").disabled = false;
      this.setStatus(`已提取正文 ${this.article.text.length.toLocaleString()} 字符`);
    } catch (error) {
      this.logError(error);
      this.setStatus(`提取失败：${this.errorMessage(error)}。可在正文框中手动粘贴文章内容。`);
      document.getElementById("article-card").hidden = false;
      document.getElementById("empty-state").hidden = true;
      document.getElementById("analyze-button").disabled = false;
    } finally {
      this.setBusy(false);
    }
  },

  parseArticle(html, url) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const content = doc.querySelector("#js_content, .rich_media_content");
    if (!content) throw new Error("页面中没有找到文章正文，可能触发了微信访问验证");

    for (const node of content.querySelectorAll("script, style, noscript")) node.remove();
    for (const node of content.querySelectorAll("br")) node.replaceWith(doc.createTextNode("\n"));
    for (const node of content.querySelectorAll("p, section, div, li, h1, h2, h3")) {
      node.append(doc.createTextNode("\n"));
    }
    const text = this.normalizeArticleText(content.textContent || "");
    if (text.length < 80) throw new Error("提取到的正文过短，可能不是有效文章页面");

    const meta = (property) => doc.querySelector(`meta[property="${property}"]`)?.content?.trim() || "";
    const namedMeta = (name) => doc.querySelector(`meta[name="${name}"]`)?.content?.trim() || "";
    const title = doc.querySelector("#activity-name")?.textContent?.trim() || meta("og:title") || doc.title || "";
    const account = doc.querySelector("#js_name, .profile_nickname")?.textContent?.trim() || namedMeta("author");
    const author = doc.querySelector("#js_author_name")?.textContent?.trim() || "";
    let date = doc.querySelector("#publish_time")?.textContent?.trim() || "";
    if (!date) {
      const timestamp = html.match(/\bct\s*=\s*["'](\d{10})["']/)?.[1];
      if (timestamp) date = new Date(Number(timestamp) * 1000).toISOString().slice(0, 10);
    }
    return { url, title: WeChatImporterCore.cleanString(title, 1000), account, author, date, text };
  },

  normalizeArticleText(text) {
    return text
      .replace(/\r/g, "")
      .replace(/[ \t\f\v]+/g, " ")
      .replace(/ *\n */g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  },

  async analyzeAndSearch() {
    if (this.busy) return;
    const provider = Zotero.WeChatImporter.getProviderConfig();
    const text = document.getElementById("article-text").value.trim();
    if (!provider.apiKey || !provider.baseURL || !provider.model) {
      this.setStatus(`请先在 Zotero 设置 → 微信公众号文献导入中配置 ${provider.label} 的 API Key、地址和模型`);
      return;
    }
    if (text.length < 80) {
      this.setStatus("正文过短，请先提取文章或手动粘贴完整正文");
      return;
    }

    this.results = [];
    this.selected.clear();
    this.renderResults();
    this.setBusy(true, `正在使用 ${provider.label} 识别文献线索...`);
    try {
      const candidates = await this.extractCandidates(provider, text);
      if (!candidates.length) {
        this.setStatus(`${provider.label} 未识别出可检索的文献线索`);
        return;
      }

      this.setStatus(`识别出 ${candidates.length} 条线索，正在 PubMed 和 Crossref 核验...`);
      for (let index = 0; index < candidates.length; index++) {
        const candidate = candidates[index];
        this.setStatus(`正在核验 ${index + 1} / ${candidates.length}：${candidate.title || candidate.query}`);
        let result;
        try {
          result = await this.resolveCandidate(candidate);
        } catch (error) {
          this.logError(error);
          result = this.unresolvedResult(candidate, this.errorMessage(error));
        }
        if (!this.results.some((item) => WeChatImporterCore.resultKey(item) === WeChatImporterCore.resultKey(result))) {
          this.results.push(result);
        }
        this.renderResults();
        if (index < candidates.length - 1) await Zotero.Promise.delay(250);
      }

      const verified = this.results.filter((item) => item.verified).length;
      this.setStatus(`核验完成：找到 ${verified} 篇，未核实 ${this.results.length - verified} 条`);
    } catch (error) {
      this.logError(error);
      this.setStatus(`分析失败：${this.errorMessage(error)}`);
    } finally {
      this.setBusy(false);
    }
  },

  async extractCandidates(provider, articleText) {
    const articleTitle = this.article?.title || document.getElementById("article-title").textContent || "";
    const sourceURL = this.article?.url || document.getElementById("url-input").value.trim();
    const prompt = [
      "请从下面的微信公众号文章中识别明确提及、解读或引用的学术论文。不要把一般话题扩写成论文，不要猜测不存在的标识符。",
      "只输出 JSON，格式必须是：",
      '{"references":[{"title":"论文原题名","authors":["作者"],"journal":"期刊","year":"年份","doi":"","pmid":"","query":"用于学术数据库检索的短语","evidence":"微信正文中支持该判断的简短原文"}]}',
      "不确定的字段使用空字符串；没有论文时返回 {\"references\":[]}；最多 30 条。",
      `微信文章标题：${articleTitle}`,
      `来源链接：${sourceURL}`,
      "正文：",
      articleText.slice(0, 60000)
    ].join("\n\n");
    const body = Zotero.WeChatImporter.prepareChatBody({
      model: provider.model,
      messages: [
        {
          role: "system",
          content: "你是严谨的学术文献线索抽取助手。所有输出必须是合法 JSON，且只能依据用户提供的正文。"
        },
        { role: "user", content: prompt }
      ],
      max_tokens: 6000,
      stream: false
    }, provider);
    if (provider.id === "deepseek") body.response_format = { type: "json_object" };
    const data = await Zotero.WeChatImporter.sendChatRequest(provider, body);
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${provider.label} 未返回分析内容`);
    return WeChatImporterCore.normalizeCandidates(content);
  },

  parseResponseJSON(response) {
    const body = response.responseText || response.response;
    return typeof body === "string" ? JSON.parse(body) : body;
  },

  async resolveCandidate(candidate) {
    const pubmed = await this.searchPubMed(candidate);
    if (pubmed) {
      const result = this.finalizeResult(pubmed, candidate);
      this.setExistingItem(result, await this.checkExisting(result));
      return result;
    }
    const crossref = await this.searchCrossref(candidate);
    if (crossref) {
      const result = this.finalizeResult(crossref, candidate);
      this.setExistingItem(result, await this.checkExisting(result));
      return result;
    }
    return this.unresolvedResult(candidate, "PubMed 和 Crossref 均未找到可信匹配");
  },

  async searchPubMed(candidate) {
    let term = "";
    if (candidate.pmid) term = `${candidate.pmid}[PMID]`;
    else if (candidate.doi) term = `"${candidate.doi}"[AID]`;
    else if (candidate.title) term = `"${candidate.title.replace(/["“”]/g, "")}"[Title]`;
    else term = candidate.query;
    if (!term) return null;

    const searchParams = new URLSearchParams({
      db: "pubmed",
      term,
      retmode: "json",
      retmax: "5",
      tool: "ZoteroWeChatImporter"
    });
    let searchData = await this.requestJSON(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`
    );
    let pmids = searchData.esearchresult?.idlist || [];
    if (!pmids.length && candidate.title && !candidate.pmid && !candidate.doi) {
      searchParams.set("term", candidate.title.replace(/["“”]/g, ""));
      searchData = await this.requestJSON(
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`
      );
      pmids = searchData.esearchresult?.idlist || [];
    }
    if (!pmids.length) return null;

    const summaryParams = new URLSearchParams({
      db: "pubmed",
      id: pmids.join(","),
      retmode: "json",
      tool: "ZoteroWeChatImporter"
    });
    const summaryData = await this.requestJSON(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`
    );
    const records = pmids.map((pmid) => this.normalizePubMed(summaryData.result?.[pmid])).filter(Boolean);
    if (candidate.pmid) return records.find((record) => record.pmid === candidate.pmid) || null;
    if (candidate.doi) {
      const doiMatch = records.find((record) => record.doi === candidate.doi);
      if (doiMatch) return doiMatch;
    }
    const ranked = records
      .map((record) => ({ record, score: WeChatImporterCore.titleSimilarity(candidate.title || candidate.query, record.title) }))
      .sort((left, right) => right.score - left.score);
    return ranked[0]?.score >= 0.58 ? ranked[0].record : null;
  },

  normalizePubMed(summary) {
    if (!summary?.uid) return null;
    const doi = (summary.articleids || []).find((id) => id.idtype === "doi")?.value || "";
    return {
      verified: true,
      source: "PubMed",
      pmid: String(summary.uid),
      doi: WeChatImporterCore.normalizeDOI(doi),
      title: summary.title || "（无题名）",
      authors: (summary.authors || []).map((author) => author.name).filter(Boolean),
      journal: summary.fulljournalname || summary.source || "",
      year: String(summary.pubdate || summary.sortpubdate || "").match(/\d{4}/)?.[0] || "",
      url: `https://pubmed.ncbi.nlm.nih.gov/${summary.uid}/`
    };
  },

  async searchCrossref(candidate) {
    if (candidate.doi) {
      try {
        const data = await this.requestJSON(
          `https://api.crossref.org/works/${encodeURIComponent(candidate.doi)}`
        );
        return this.normalizeCrossref(data.message);
      } catch (error) {
        if (error?.status !== 404) this.logError(error);
      }
    }
    const query = candidate.title || candidate.query;
    if (!query) return null;
    const params = new URLSearchParams({
      "query.bibliographic": query,
      rows: "5",
      select: "DOI,title,author,published,container-title,URL,type"
    });
    const data = await this.requestJSON(`https://api.crossref.org/works?${params}`);
    const records = (data.message?.items || []).map((item) => this.normalizeCrossref(item)).filter(Boolean);
    const ranked = records
      .map((record) => ({ record, score: WeChatImporterCore.titleSimilarity(query, record.title) }))
      .sort((left, right) => right.score - left.score);
    return ranked[0]?.score >= 0.62 ? ranked[0].record : null;
  },

  normalizeCrossref(item) {
    const doi = WeChatImporterCore.normalizeDOI(item?.DOI);
    const title = Array.isArray(item?.title) ? item.title[0] : item?.title;
    if (!doi || !title) return null;
    const dateParts = item.published?.["date-parts"]?.[0] || [];
    return {
      verified: true,
      source: "Crossref",
      pmid: "",
      doi,
      title: WeChatImporterCore.cleanString(title, 1000),
      authors: (item.author || []).map((author) => [author.given, author.family].filter(Boolean).join(" ")),
      journal: Array.isArray(item["container-title"]) ? item["container-title"][0] || "" : "",
      year: dateParts[0] ? String(dateParts[0]) : "",
      url: `https://doi.org/${encodeURIComponent(doi)}`
    };
  },

  finalizeResult(record, candidate) {
    return {
      ...record,
      evidence: candidate.evidence,
      candidateTitle: candidate.title,
      existing: false,
      selected: false
    };
  },

  unresolvedResult(candidate, reason) {
    return {
      verified: false,
      source: "未核实",
      pmid: candidate.pmid,
      doi: candidate.doi,
      title: candidate.title || candidate.query || "（无题名）",
      authors: candidate.authors,
      journal: candidate.journal,
      year: candidate.year,
      url: "",
      evidence: candidate.evidence,
      reason,
      existing: false
    };
  },

  async requestJSON(url) {
    const response = await Zotero.HTTP.request("GET", url, {
      timeout: 45000,
      headers: { Accept: "application/json" }
    });
    return this.parseResponseJSON(response);
  },

  async checkExisting(record) {
    for (const [field, value] of [["PMID", record.pmid], ["DOI", record.doi]]) {
      if (!value) continue;
      const search = new Zotero.Search();
      search.libraryID = this.io.libraryID;
      search.addCondition(field, "is", value);
      const item = (await search.search())
        .map((id) => Zotero.Items.get(id))
        .find((candidate) => candidate?.isRegularItem());
      if (item) return item;
    }
    return null;
  },

  setExistingItem(record, item) {
    record.existing = Boolean(item);
    record.zoteroURL = item ? this.getZoteroSelectURL(item) : "";
  },

  getZoteroSelectURL(item) {
    if (!item?.key) return "";
    const library = Zotero.Libraries.get(item.libraryID);
    if (library?.libraryType === "group") {
      return `zotero://select/groups/${library.libraryTypeID}/items/${item.key}`;
    }
    return `zotero://select/library/items/${item.key}`;
  },

  copyZoteroURL(url) {
    try {
      Zotero.Utilities.Internal.copyTextToClipboard(url);
      this.setStatus(`已复制 Zotero 链接：${url}`);
    } catch (error) {
      this.logError(error);
      this.setStatus(`复制失败：${this.errorMessage(error)}`);
    }
  },

  renderResults() {
    const body = document.getElementById("result-body");
    body.replaceChildren();
    for (const item of this.results) {
      const row = this.createElement("tr");
      if (!item.verified) row.classList.add("unresolved");
      if (item.existing) row.classList.add("existing");

      const selectCell = this.createElement("td");
      const checkbox = this.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.selected.has(WeChatImporterCore.resultKey(item));
      checkbox.disabled = !item.verified || item.existing;
      checkbox.setAttribute("aria-label", `选择 ${item.title}`);
      checkbox.addEventListener("change", () => {
        const key = WeChatImporterCore.resultKey(item);
        checkbox.checked ? this.selected.set(key, item) : this.selected.delete(key);
        this.updateControls();
      });
      selectCell.append(checkbox);

      const titleCell = this.createElement("td");
      const title = this.textElement("div", "title-text", item.title);
      if (item.url) {
        const link = this.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.textContent = item.title;
        title.replaceChildren(link);
      }
      titleCell.append(title, this.textElement("div", "author-text", this.formatAuthors(item.authors)));
      if (item.evidence) titleCell.append(this.textElement("div", "evidence-text", `原文线索：${item.evidence}`));

      const publicationCell = this.createElement("td");
      publicationCell.append(
        this.textElement("div", "journal-text", item.journal),
        this.textElement("div", "year-text", item.year)
      );

      const idCell = this.createElement("td");
      if (item.pmid) idCell.append(this.textElement("div", "identifier-text", `PMID ${item.pmid}`));
      if (item.doi) idCell.append(this.textElement("div", "identifier-text", `DOI ${item.doi}`));
      if (item.existing) {
        const existingMeta = this.createElement("div");
        existingMeta.className = "existing-meta";
        existingMeta.append(this.textElement("span", "existing-badge", "已存在"));
        if (item.zoteroURL) {
          const zoteroLink = this.createElement("a");
          zoteroLink.href = item.zoteroURL;
          zoteroLink.className = "zotero-url";
          zoteroLink.textContent = "Zotero URL";
          zoteroLink.title = `点击复制：${item.zoteroURL}`;
          zoteroLink.setAttribute("aria-label", `复制 Zotero 链接 ${item.zoteroURL}`);
          zoteroLink.addEventListener("click", (event) => {
            event.preventDefault();
            this.copyZoteroURL(item.zoteroURL);
          });
          existingMeta.append(zoteroLink);
        }
        idCell.append(existingMeta);
      }

      const statusCell = this.createElement("td");
      const badgeClass = item.verified ? "verified-badge" : "unresolved-badge";
      statusCell.append(this.textElement("span", badgeClass, item.source));
      if (item.reason) statusCell.append(this.textElement("div", "reason-text", item.reason));

      row.append(selectCell, titleCell, publicationCell, idCell, statusCell);
      body.append(row);
    }
    document.getElementById("results-section").hidden = this.results.length === 0;
    document.getElementById("empty-state").hidden =
      this.results.length > 0 || !document.getElementById("article-card").hidden;
    this.updateControls();
  },

  createElement(tag) {
    return document.createElementNS("http://www.w3.org/1999/xhtml", tag);
  },

  textElement(tag, className, text) {
    const element = this.createElement(tag);
    element.className = className;
    element.textContent = text || "";
    return element;
  },

  formatAuthors(authors) {
    if (!authors?.length) return "";
    return authors.length > 6 ? `${authors.slice(0, 6).join(", ")} 等` : authors.join(", ");
  },

  selectAll(checked) {
    for (const item of this.results) {
      if (!item.verified || item.existing) continue;
      const key = WeChatImporterCore.resultKey(item);
      checked ? this.selected.set(key, item) : this.selected.delete(key);
    }
    this.renderResults();
  },

  async importSelected() {
    if (!this.selected.size || this.busy) return;
    const records = [...this.selected.values()];
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const importedItems = [];
    this.setBusy(true, `正在导入 0 / ${records.length}...`);
    for (let index = 0; index < records.length; index++) {
      const record = records[index];
      this.setStatus(`正在导入 ${index + 1} / ${records.length}：${record.title}`);
      try {
        const existingItem = await this.checkExisting(record);
        if (existingItem) {
          this.setExistingItem(record, existingItem);
          skipped++;
        } else {
          const importedItem = await this.importRecord(record);
          importedItems.push(importedItem);
          this.setExistingItem(record, importedItem);
          imported++;
        }
      } catch (error) {
        failed++;
        this.logError(error);
      }
      this.selected.delete(WeChatImporterCore.resultKey(record));
      if (index < records.length - 1) await Zotero.Promise.delay(350);
    }
    let fullTextError = null;
    if (importedItems.length) {
      this.setStatus(`已导入 ${imported} 篇，正在使用 Zotero 查找可用全文...`);
      try {
        await Zotero.Attachments.addAvailableFiles(importedItems);
      } catch (error) {
        fullTextError = error;
        this.logError(error);
      }
    }
    this.renderResults();
    this.setBusy(false);
    this.setStatus(
      `导入完成：成功 ${imported}，已存在 ${skipped}，失败 ${failed}` +
      (fullTextError ? `；全文查找失败：${this.errorMessage(fullTextError)}` : "")
    );
  },

  async importRecord(record) {
    const identifiers = [];
    if (record.pmid) identifiers.push({ PMID: record.pmid });
    if (record.doi) identifiers.push({ DOI: record.doi });
    let lastError;
    for (const identifier of identifiers) {
      try {
        const translate = new Zotero.Translate.Search();
        translate.setIdentifier(identifier);
        const translators = await translate.getTranslators();
        if (!translators.length) continue;
        translate.setTranslator(translators);
        const items = await translate.translate({
          libraryID: this.io.libraryID,
          collections: this.io.collectionID ? [this.io.collectionID] : [],
          saveAttachments: false
        });
        if (items.length) return items[0];
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error(`没有可用于“${record.title}”的 Zotero 翻译器`);
  },

  setBusy(busy, status) {
    this.busy = busy;
    if (status) this.setStatus(status);
    for (const id of ["url-input", "fetch-button", "analyze-button"]) {
      const element = document.getElementById(id);
      if (element) element.disabled = busy;
    }
    this.updateControls();
  },

  setStatus(message) {
    document.getElementById("status-text").textContent = message || "";
  },

  updateControls() {
    const available = this.results.filter((item) => item.verified && !item.existing);
    const selectedCount = available.filter((item) => this.selected.has(WeChatImporterCore.resultKey(item))).length;
    const selectAll = document.getElementById("select-all");
    selectAll.disabled = this.busy || available.length === 0;
    selectAll.checked = available.length > 0 && selectedCount === available.length;
    selectAll.indeterminate = selectedCount > 0 && selectedCount < available.length;
    document.getElementById("selected-count").textContent = `已选择 ${this.selected.size} 篇`;
    document.getElementById("import-button").disabled = this.busy || this.selected.size === 0;
  },

  errorMessage(error) {
    if (error?.status) return `HTTP ${error.status}${error.statusText ? ` ${error.statusText}` : ""}`;
    return error?.message || String(error);
  },

  logError(error) {
    Zotero.logError(new Error(this.errorMessage(error)));
  }
};

window.addEventListener("load", () => WeChatImport.init(), { once: true });
