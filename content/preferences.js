var WeChatImporterPreferences = {
  providerIDs: ["deepseek", "qwen", "zhipu", "mimo"],

  init() {
    const provider = document.getElementById("wechat-importer-provider");
    if (!this.providerIDs.includes(provider.value)) provider.value = "deepseek";
    this.updateProviderVisibility();
  },

  updateProviderVisibility() {
    const selected = document.getElementById("wechat-importer-provider").value;
    for (const id of this.providerIDs) {
      document.getElementById(`wechat-importer-${id}-settings`).hidden = id !== selected;
    }
    document.getElementById("wechat-importer-test-status").textContent = "";
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
    const status = document.getElementById("wechat-importer-test-status");
    if (!provider.apiKey || !provider.baseURL || !provider.model) {
      status.textContent = "请完整填写 API Key、API 地址和模型名";
      return;
    }
    button.disabled = true;
    status.textContent = `正在连接 ${provider.label}...`;
    try {
      const body = Zotero.WeChatImporter.prepareChatBody({
        model: provider.model,
        messages: [{ role: "user", content: "Reply with exactly: OK" }],
        max_tokens: 128,
        stream: false
      }, provider);
      const data = await Zotero.WeChatImporter.sendChatRequest(provider, body, 30000);
      if (!data?.choices?.[0]?.message?.content) throw new Error("模型未返回文本");
      status.textContent = `连接成功：${provider.label} / ${provider.model}`;
    } catch (error) {
      const code = error?.status || error?.xmlhttp?.status;
      status.textContent = `连接失败：${code ? `HTTP ${code}` : error?.message || String(error)}`;
    } finally {
      button.disabled = false;
    }
  }
};
