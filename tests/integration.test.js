"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const preferences = new Map();
const requests = [];
const addedFiles = [];
const zotero = {
  Prefs: {
    get: (name) => preferences.get(name),
    set: (name, value) => preferences.set(name, value),
    clear: (name) => preferences.delete(name)
  },
  HTTP: {
    request: async (_method, url, options) => {
      requests.push({ url, options });
      return { responseText: '{"choices":[{"message":{"content":"OK"}}]}' };
    }
  },
  Libraries: {
    get: (id) => id === 2 ? { libraryType: "group", libraryTypeID: 42 } : { libraryType: "user" }
  },
  Attachments: { addAvailableFiles: async (items) => addedFiles.push(...items) },
  Promise: { delay: async () => {} },
  logError: () => {}
};
const context = {
  Zotero: zotero,
  URL,
  rootURI: "file:///test/",
  window: { addEventListener: () => {} },
  WeChatImporterCore: { resultKey: (item) => item.doi }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("content/wechat-importer.js", "utf8"), context);
vm.runInContext(fs.readFileSync("content/wechat-import.js", "utf8"), context);

async function main() {
  const prefix = "extensions.zotero-wechat-importer.";
  preferences.set(`${prefix}apiKey`, "old-key");
  preferences.set(`${prefix}model`, "deepseek-chat");
  zotero.WeChatImporter.migrateLegacySettings();
  assert.equal(preferences.get(`${prefix}deepseek.apiKey`), "old-key");
  assert.equal(preferences.get(`${prefix}deepseek.model`), "deepseek-chat");
  assert.equal(preferences.has(`${prefix}apiKey`), false);

  const endpoints = {
    deepseek: "https://api.deepseek.com/chat/completions",
    qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    zhipu: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    mimo: "https://api.xiaomimimo.com/v1/chat/completions"
  };
  for (const id of Object.keys(endpoints)) {
    preferences.set(`${prefix}provider`, id);
    preferences.set(`${prefix}${id}.apiKey`, `${id}-key`);
    const provider = zotero.WeChatImporter.getProviderConfig();
    assert.equal(provider.id, id);
    const body = zotero.WeChatImporter.prepareChatBody({ model: provider.model, max_tokens: 20 }, provider);
    assert.equal(id === "mimo" ? body.max_completion_tokens : body.max_tokens, 20);
    await zotero.WeChatImporter.sendChatRequest(provider, body);
    const request = requests.at(-1);
    assert.equal(request.url, endpoints[id]);
    assert.equal(request.options.headers[id === "mimo" ? "api-key" : "Authorization"],
      id === "mimo" ? `${id}-key` : `Bearer ${id}-key`);
    assert.equal(request.options.responseType, "json");
  }

  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { value: "", hidden: false, textContent: "", style: {} });
    return elements.get(id);
  };
  const preferenceContext = {
    document: { getElementById: element },
    Zotero: zotero
  };
  preferenceContext.window = preferenceContext;
  vm.runInNewContext(fs.readFileSync("content/preferences.js", "utf8"), preferenceContext);
  const ui = preferenceContext.WeChatImporterPreferences;
  preferences.set(`${prefix}provider`, "qwen");
  ui.init();
  assert.equal(element("wechat-importer-provider").value, "qwen");
  assert.equal(element("wechat-importer-qwen-settings").hidden, false);
  assert.equal(element("wechat-importer-deepseek-settings").hidden, true);
  element("wechat-importer-provider").value = "mimo";
  ui.updateProviderVisibility();
  assert.equal(element("wechat-importer-mimo-settings").hidden, false);
  assert.equal(element("wechat-importer-qwen-settings").hidden, true);
  await ui.testConnection();
  assert.match(element("wechat-importer-test-status").textContent, /请完整填写 MiMo/);
  element("wechat-importer-mimo-api-key").value = "test-key";
  element("wechat-importer-mimo-base-url").value = "https://api.xiaomimimo.com/v1";
  element("wechat-importer-mimo-model").value = "mimo-v2.6-pro";
  zotero.WeChatImporter.sendChatRequest = async () => ({ choices: [{ message: { content: "OK" } }] });
  await ui.testConnection();
  assert.match(element("wechat-importer-test-status").textContent, /连接成功：MiMo/);
  assert.equal(element("wechat-importer-test-button").disabled, false);

  const dialog = context.WeChatImport;
  assert.equal(dialog.getZoteroSelectURL({ libraryID: 2, key: "GROUPKEY" }),
    "zotero://select/groups/42/items/GROUPKEY");
  const existing = { doi: "10.1000/existing", title: "Existing", verified: true };
  const fresh = { doi: "10.1000/fresh", title: "Fresh", verified: true };
  dialog.selected = new Map([[existing.doi, existing], [fresh.doi, fresh]]);
  dialog.results = [existing, fresh];
  dialog.io = { libraryID: 1 };
  dialog.setBusy = () => {};
  dialog.renderResults = () => {};
  dialog.setStatus = (message) => { dialog.lastStatus = message; };
  dialog.checkExisting = async (record) => record === existing
    ? { libraryID: 1, key: "OLDKEY" }
    : null;
  dialog.importRecord = async () => ({ libraryID: 1, key: "NEWKEY" });
  await dialog.importSelected();
  assert.equal(addedFiles.length, 1);
  assert.equal(addedFiles[0].key, "NEWKEY");
  assert.equal(existing.zoteroURL, "zotero://select/library/items/OLDKEY");
  assert.equal(fresh.zoteroURL, "zotero://select/library/items/NEWKEY");
  assert.match(dialog.lastStatus, /成功 1，已存在 1，失败 0/);
  console.log("Integration tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
