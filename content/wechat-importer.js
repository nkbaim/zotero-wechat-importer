var WeChatImporter = {
  pluginID: "zotero-wechat-importer@duyang.dev",
  menuID: "wechat-reference-import-menuitem",
  menuLabel: "从微信公众号文章导入文献...",
  toolbarButtonID: "zotero-wechat-importer-toolbar-button",
  menuRegistrationID: null,
  rootURI,
  dialogURI: "chrome://zotero-wechat-importer/content/wechat-import.xhtml",

  providers: {
    deepseek: { label: "DeepSeek", baseURL: "https://api.deepseek.com", model: "deepseek-flash" },
    qwen: { label: "Qwen（通义千问）", baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
    zhipu: { label: "智谱 GLM", baseURL: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4.7-flash" },
    mimo: { label: "MiMo（小米）", baseURL: "https://api.xiaomimimo.com/v1", model: "mimo-v2.6-pro" }
  },

  getPref(name, fallback = "") {
    const value = Zotero.Prefs.get(`extensions.zotero-wechat-importer.${name}`, true);
    return value == null ? fallback : value;
  },

  getProviderConfig() {
    const selected = this.getPref("provider", "deepseek");
    const id = Object.hasOwn(this.providers, selected) ? selected : "deepseek";
    const defaults = this.providers[id];
    return {
      id,
      label: defaults.label,
      apiKey: String(this.getPref(`${id}.apiKey`)).trim(),
      baseURL: String(this.getPref(`${id}.baseURL`, defaults.baseURL)).trim(),
      model: String(this.getPref(`${id}.model`, defaults.model)).trim()
    };
  },

  migrateLegacySettings() {
    const root = "extensions.zotero-wechat-importer.";
    const oldKey = this.getPref("apiKey");
    if (oldKey && !this.getPref("deepseek.apiKey")) {
      Zotero.Prefs.set(`${root}deepseek.apiKey`, oldKey, true);
    }
    const oldModel = this.getPref("model");
    if (oldModel && this.getPref("deepseek.model", "deepseek-flash") === "deepseek-flash") {
      Zotero.Prefs.set(`${root}deepseek.model`, oldModel, true);
    }
    if (oldKey) Zotero.Prefs.clear(`${root}apiKey`, true);
    if (oldModel) Zotero.Prefs.clear(`${root}model`, true);
    Zotero.Prefs.clear(`${root}rememberKey`, true);
  },

  async sendChatRequest(provider, body, timeout = 120000) {
    const baseURL = provider.baseURL.replace(/\/+$/, "");
    let parsed;
    try {
      parsed = new URL(baseURL);
    } catch (_error) {
      throw new Error("请在插件设置中填写有效的 API 地址");
    }
    if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password) {
      throw new Error("API 地址必须是 HTTPS 地址");
    }
    const endpoint = baseURL.endsWith("/chat/completions")
      ? baseURL
      : `${baseURL}/chat/completions`;
    let response;
    try {
      response = await Zotero.HTTP.request("POST", endpoint, {
        timeout,
        headers: {
          "Content-Type": "application/json",
          ...(provider.id === "mimo"
            ? { "api-key": provider.apiKey }
            : { Authorization: `Bearer ${provider.apiKey}` })
        },
        body: JSON.stringify(body),
        responseType: "json"
      });
    } catch (error) {
      const status = error?.xmlhttp?.status || error?.status;
      throw new Error(`${provider.label} API 请求失败${status ? `（HTTP ${status}）` : ""}`);
    }
    const data = response.response ?? response.responseText;
    if (data == null) throw new Error(`${provider.label} API 返回空响应`);
    return typeof data === "string" ? JSON.parse(data) : data;
  },

  prepareChatBody(body, provider) {
    if (provider.id === "mimo") {
      body.max_completion_tokens = body.max_tokens;
      delete body.max_tokens;
    }
    if (provider.id === "zhipu" && /^glm-5\.3(?:-|$)/i.test(provider.model)) {
      body.thinking = { type: "enabled" };
      body.reasoning_effort = "low";
    } else if (["deepseek", "zhipu", "mimo"].includes(provider.id)) {
      body.thinking = { type: "disabled" };
    }
    return body;
  },

  extractAssistantText(data) {
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content.trim();
    if (Array.isArray(content)) {
      return content.map((part) => typeof part === "string" ? part : part?.text || "").join("").trim();
    }
    const fallback = data?.choices?.[0]?.text ?? data?.output_text;
    return typeof fallback === "string" ? fallback.trim() : "";
  },

  async startup() {
    this.migrateLegacySettings();
    this.menuRegistrationID = Zotero.MenuManager.registerMenu({
      pluginID: this.pluginID,
      menuID: this.menuID,
      target: "main/menubar/tools",
      menus: [{
        menuType: "menuitem",
        enableForTabTypes: ["library"],
        onShowing: (_event, context) => {
          context.menuElem?.setAttribute("label", this.menuLabel);
          context.setEnabled(Boolean(Zotero.getActiveZoteroPane()?.canEdit()));
        },
        onCommand: (_event, context) => {
          this.openImportWindow(context.menuElem?.ownerGlobal);
        }
      }]
    });

    if (!this.menuRegistrationID) {
      throw new Error("Failed to register the WeChat reference import menu");
    }

    for (const win of Zotero.getMainWindows()) this.scheduleToolbarButton(win);
  },

  scheduleToolbarButton(win) {
    win.setTimeout(() => {
      if (Zotero.WeChatImporter === this) this.addToolbarButton(win);
    }, 0);
  },

  addToolbarButton(win) {
    const doc = win.document;
    if (doc.getElementById(this.toolbarButtonID)) return;
    const toolbar = doc.getElementById("zotero-items-toolbar");
    if (!toolbar) return;

    const button = doc.createXULElement("toolbarbutton");
    button.id = this.toolbarButtonID;
    button.classList.add("zotero-tb-button");
    button.setAttribute("tabindex", "-1");
    button.setAttribute("tooltiptext", this.menuLabel);
    button.addEventListener("command", () => this.openImportWindow(win));

    const icon = doc.createXULElement("image");
    icon.classList.add("toolbarbutton-icon");
    icon.style.setProperty("list-style-image", `url("${this.rootURI}icon.svg")`);
    icon.style.width = "20px";
    icon.style.height = "20px";
    button.append(icon);

    const spacer = [...toolbar.children].find((element) => element.localName === "spacer");
    toolbar.insertBefore(button, spacer || null);
  },

  removeToolbarButton(win) {
    win.document.getElementById(this.toolbarButtonID)?.remove();
  },

  openImportWindow(ownerWindow) {
    const existing = Services.wm.getMostRecentWindow("zotero:wechat-importer");
    if (existing) {
      existing.focus();
      return;
    }

    const win = ownerWindow || Zotero.getMainWindow();
    const pane = win.ZoteroPane || Zotero.getActiveZoteroPane();
    const libraryID = pane.getSelectedLibraryID();
    const collection = pane.getSelectedCollection();
    const library = Zotero.Libraries.get(libraryID);
    const io = {
      libraryID,
      libraryName: library?.name || "Zotero",
      collectionID: collection?.id || null,
      collectionName: collection?.name || "",
      wrappedJSObject: null
    };
    io.wrappedJSObject = io;

    win.openDialog(
      this.dialogURI,
      "zotero-wechat-importer",
      "chrome,dialog=no,centerscreen,resizable=yes,width=1180,height=820",
      io
    );
  },

  shutdown() {
    if (this.menuRegistrationID) {
      Zotero.MenuManager.unregisterMenu(this.menuRegistrationID);
      this.menuRegistrationID = null;
    }
    for (const win of Zotero.getMainWindows()) this.removeToolbarButton(win);
    Services.wm.getMostRecentWindow("zotero:wechat-importer")?.close();
  }
};

Zotero.WeChatImporter = WeChatImporter;
