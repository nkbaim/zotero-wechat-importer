# Changelog

## [0.3.0] - 2026-10-08

### 新增

- 从微信公众号正文提取图片并提供预览与勾选；仅将主动选择的图片和正文交给所选视觉模型，图片中的论文信息仍须经 PubMed / Crossref 核验。
- 各服务新增“看图模型”设置，并增加图片数量、大小和读取失败提示。
- 重新设计文章提取页面，改善原文检查、图片选择和导入结果的布局。

### 调整与修复

- 图片识别默认关闭，提取新文章时清空图片选择。
- 点击 Zotero URL 后显示“已复制”反馈。
- 调整工作区纵向滚动，避免识图模式下已核实文献列表被遮挡或无法滚动。

## [0.2.1] - 2026-09-30

### 调整

- 插件显示名称和 Zotero 设置页名称改为 WeChat Papers；设置页内标题改为“AI 模型设置”，加宽“当前服务”下拉框，并新增“关于”。
- README 和使用手册更新模型设置入口与说明。

### 修复

- 修复切换模型服务商后配置面板仍显示 DeepSeek 的问题，并恢复已保存的服务商选择。
- 修复“测试当前模型连接”按钮不可用的问题，显示连接结果或错误信息。

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

[0.2.1]: https://github.com/nkbaim/zotero-wechat-importer/releases/tag/v0.2.1
[0.3.0]: https://github.com/nkbaim/zotero-wechat-importer/releases/tag/v0.3.0
[0.2.0]: https://github.com/nkbaim/zotero-wechat-importer/releases/tag/v0.2.0
[0.1.0]: https://github.com/nkbaim/zotero-wechat-importer/releases/tag/v0.1.0
