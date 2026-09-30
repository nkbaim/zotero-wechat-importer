#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_root"
./scripts/check.sh

version="$(node -p 'JSON.parse(require("node:fs").readFileSync("manifest.json", "utf8")).version')"
artifact="dist/zotero-wechat-importer-${version}.xpi"
artifact_path="$project_root/$artifact"
staging="$(mktemp -d)"
trap 'rm -rf "$staging"' EXIT

mkdir -p dist
rm -f "$artifact"
cp bootstrap.js manifest.json prefs.js icon.svg "$staging/"
cp -R content "$staging/"
find "$staging" -exec touch -t 198001010000 {} +
(
  cd "$staging"
  find . -type f -print | LC_ALL=C sort | zip -X -q "$artifact_path" -@
)
echo "Built $artifact"
shasum -a 256 "$artifact"
