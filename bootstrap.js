var chromeHandle;

function install() {}

async function startup({ id, rootURI }) {
  await Zotero.initializationPromise;
  const normalizedRootURI = rootURI.endsWith("/") ? rootURI : `${rootURI}/`;
  const addonManagerStartup = Cc["@mozilla.org/addons/addon-manager-startup;1"]
    .getService(Ci.amIAddonManagerStartup);
  chromeHandle = addonManagerStartup.registerChrome(
    Services.io.newURI(`${normalizedRootURI}manifest.json`),
    [["content", "zotero-wechat-importer", "content/"]]
  );

  const context = { rootURI: normalizedRootURI };
  context._globalThis = context;
  Services.scriptloader.loadSubScript(
    `${normalizedRootURI}content/wechat-importer.js`,
    context
  );
  Zotero.PreferencePanes.register({
    pluginID: id,
    src: `${normalizedRootURI}content/preferences.xhtml`,
    scripts: [`${normalizedRootURI}content/preferences.js`],
    label: "微信公众号文献导入",
    image: `${normalizedRootURI}icon.svg`
  });
  await Zotero.WeChatImporter.startup();
}

function onMainWindowLoad({ window }) {
  Zotero.WeChatImporter?.scheduleToolbarButton(window);
}

function onMainWindowUnload({ window }) {
  Zotero.WeChatImporter?.removeToolbarButton(window);
}

function shutdown(_data, reason) {
  if (reason === APP_SHUTDOWN) return;
  Zotero.WeChatImporter?.shutdown();
  delete Zotero.WeChatImporter;
  chromeHandle?.destruct();
  chromeHandle = null;
}

function uninstall() {}
