<p align="center">
  <img src="icon.svg" alt="WeChat Article Reference Importer logo" width="128" height="128">
</p>

<h1 align="center">zotero-wechat-importer</h1>

从微信公众号文章中提取学术文献线索，经 **PubMed** 和 **Crossref** 核验后导入 Zotero 的 Zotero 9 插件。

## 工作流程

1. 输入 `https://mp.weixin.qq.com/...` 文章链接，提取标题、公众号、日期和正文。
2. 使用 DeepSeek 从正文中识别明确提及、解读或引用的论文。
3. 用 PMID、DOI 或题名在 PubMed 与 Crossref 中检索并核验。
4. 只允许选择已核验记录，并通过 Zotero 内置翻译器导入当前文库或分类。

大语言模型只负责生成检索线索，不直接生成最终题录。未能在 PubMed 或 Crossref 找到可信匹配的线索会保留在列表中，但不能导入。

## 功能

- 提取微信公众号文章的标题、来源信息和正文；提取失败时可手动粘贴正文
- 使用 DeepSeek JSON Output 识别最多 30 条文献线索
- 优先按 PMID、DOI 核验，缺少标识符时按题名匹配
- 同时覆盖 PubMed 收录论文与 Crossref 中的其他学术出版物
- 显示微信原文中的依据，便于人工复核
- 按 PMID 和 DOI 检查当前 Zotero 文库中的重复记录
- 批量导入当前文库或选中的分类，不自动下载附件
- 适配浅色和深色界面

## 安装与使用

1. 从 Releases 下载 `zotero-wechat-importer-*.xpi`。
2. 在 Zotero 中打开“工具 → 插件”，通过齿轮菜单选择“从文件安装插件”。
3. 在 Zotero 左侧选择目标文库或分类。
4. 点击工具栏图标，或选择“工具 → 从微信公众号文章导入文献…”。
5. 输入微信公众号文章链接并点击“提取文章”。
6. 展开“DeepSeek API 设置”，填写 API Key。默认模型为 `deepseek-flash`。
7. 点击“AI 识别并检索文献”，人工核对结果后导入。

## DeepSeek 配置与隐私

插件调用官方 `https://api.deepseek.com/chat/completions` 接口，并使用 `response_format: {"type":"json_object"}`。接口和 JSON Output 用法参见 [DeepSeek Chat Completions 文档](https://api-docs.deepseek.com/api/create-chat-completion/) 与 [JSON Output 指南](https://api-docs.deepseek.com/guides/json_mode/)。

- 文章标题、来源链接和最多 60,000 字符正文会发送给 DeepSeek；请勿处理包含敏感信息的内容。
- API Key 默认只在当前窗口内使用。勾选保存后，会以明文保存在本机 Zotero 首选项中。
- API Key 不会写入项目文件，也不会发送到 DeepSeek 以外的服务。
- 文献核验会将检索词发送到 NCBI PubMed 和 Crossref。
- 插件不包含遥测或项目作者控制的中转服务器。

## 已知限制

- 微信可能要求访问验证，导致插件无法直接取得正文。此时可以手动粘贴文章内容。
- AI 可能漏掉文献或提取错误线索；导入前仍应人工检查。
- 当前版本不保存微信文章快照，也不自动下载论文全文。

## 从源码构建

macOS 或 Linux 需要 `bash`、`node`、`python3`、`zip` 和 `shasum`：

```bash
./scripts/check.sh
./scripts/build.sh
```

安装包生成在 `dist/` 目录。设计与信任边界见 [docs/design.md](docs/design.md)。

## License

[MIT](LICENSE)

微信名称与图标的商标权归腾讯所有；本项目与腾讯无隶属或背书关系。
