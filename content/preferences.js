window.WeChatImporterPreferences = {
  providerIDs: ["deepseek", "qwen", "zhipu", "mimo"],

  init() {
    const provider = document.getElementById("wechat-importer-provider");
    const saved = Zotero.Prefs.get("extensions.zotero-wechat-importer.provider", true);
    if (this.providerIDs.includes(saved)) provider.value = saved;
    else provider.value = "deepseek";
    this.updateProviderVisibility();
  },

  updateProviderVisibility() {
    const selected = document.getElementById("wechat-importer-provider").value;
    for (const id of this.providerIDs) {
      document.getElementById(`wechat-importer-${id}-settings`).hidden = id !== selected;
    }
    this.setStatus("", false);
  },

  openExternalLink(event) {
    event.preventDefault();
    Zotero.launchURL(event.currentTarget.href);
  },

  async testConnection() {
    const id = document.getElementById("wechat-importer-provider").value;
    const provider = {
      id,
      label: Zotero.WeChatImporter.providers[id].label,
      apiKey: document.getElementById(`wechat-importer-${id}-api-key`).value.trim(),
      baseURL: document.getElementById(`wechat-importer-${id}-base-url`).value.trim(),
      model: document.getElementById(`wechat-importer-${id}-model`).value.trim()
    };
    const button = document.getElementById("wechat-importer-test-button");
    if (!provider.apiKey || !provider.baseURL || !provider.model) {
      this.setStatus(`请完整填写 ${provider.label} 的 API Key、API 地址和模型名`, true);
      return;
    }
    button.disabled = true;
    button.label = "正在测试…";
    this.setStatus(`正在连接 ${provider.label}…`, false);
    try {
      const body = Zotero.WeChatImporter.prepareChatBody({
        model: provider.model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        max_tokens: 512,
        stream: false
      }, provider);
      const data = await Zotero.WeChatImporter.sendChatRequest(provider, body, 30000);
      const reply = Zotero.WeChatImporter.extractAssistantText(data);
      if (!reply) throw new Error("模型已响应，但未返回文本");
      this.setStatus(`连接成功：${provider.label} / ${provider.model}（${reply.replace(/\s+/g, " ").slice(0, 80)}）`, false, true);
    } catch (error) {
      this.setStatus(`连接失败：${error?.message || String(error)}`, true);
    } finally {
      button.disabled = false;
      button.label = "测试文本模型连接";
    }
  },

  setStatus(message, isError, isSuccess = false) {
    const status = document.getElementById("wechat-importer-test-status");
    status.textContent = message;
    status.style.color = isError
      ? "var(--fill-danger, #c62828)"
      : isSuccess
        ? "var(--fill-success, #2e7d32)"
        : "var(--fill-secondary, currentColor)";
  }
};
