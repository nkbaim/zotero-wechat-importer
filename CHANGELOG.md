# Changelog

## [0.2.0] - 2026-09-30

### 新增

- 在 Zotero 独立设置页配置 DeepSeek、Qwen、智谱 GLM 和小米 MiMo，可测试当前模型连接。
- 导入题录后调用 Zotero 查找可用全文。
- 为已存在和新导入条目展示可复制的 Zotero URL。

### 调整

- 从导入窗口移除 API 设置，并迁移旧版已保存的 DeepSeek 配置。
- “已存在”状态与 Zotero URL 的样式对齐 zotero-pubmed-importer。

## [0.1.0] - 2026-09-17

### 新增

- 从微信公众号链接提取文章元数据和正文，并支持手动粘贴正文。
- 使用 DeepSeek JSON Output 提取论文线索。
- 使用 PubMed 和 Crossref 核验 PMID、DOI 与题名。
- 按 PMID/DOI 去重并批量导入 Zotero 当前文库或分类。

[0.2.0]: https://github.com/nkbaim/zotero-wechat-importer/releases/tag/v0.2.0
[0.1.0]: https://github.com/nkbaim/zotero-wechat-importer/releases/tag/v0.1.0
