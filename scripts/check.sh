#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"

node - <<'NODE'
const fs = require("node:fs");
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const updateManifest = JSON.parse(fs.readFileSync("updates.json", "utf8"));
const addonID = manifest.applications.zotero.id;
const latestUpdate = updateManifest.addons?.[addonID]?.updates?.[0];
if (!latestUpdate) throw new Error(`No update entry found for ${addonID}`);
if (latestUpdate.version !== manifest.version) {
  throw new Error(`Version mismatch: manifest ${manifest.version}, updates ${latestUpdate.version}`);
}
NODE
node --check bootstrap.js
node --check content/wechat-importer.js
node --check content/wechat-core.js
node --check content/wechat-import.js
node --check content/preferences.js
node tests/core.test.js
node tests/integration.test.js
python3 -c 'import xml.etree.ElementTree as ET; ET.parse("content/wechat-import.xhtml"); ET.parse("content/preferences.xhtml")'

required_files=(
  bootstrap.js manifest.json prefs.js icon.svg
  content/wechat-importer.js content/wechat-core.js content/wechat-import.xhtml
  content/wechat-import.js content/preferences.xhtml content/preferences.js
)
for file in "${required_files[@]}"; do test -s "$file"; done
echo "Checks passed."
