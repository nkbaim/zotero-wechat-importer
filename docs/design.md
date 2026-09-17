# 设计与安全说明

本文面向希望理解、审查或修改插件的开发者。普通用户请阅读 [使用手册](usage.md)。

## 设计目标

插件需要在三个互相冲突的目标之间取得平衡：

1. 微信文章中的论文线索可能不完整，需要模型理解上下文；
2. 大语言模型可能产生幻觉，不能直接作为题录来源；
3. 导入 Zotero 的条目应尽量使用规范、可追踪的公开数据库记录。

因此，系统将“线索提取”和“题录确认”严格分开：DeepSeek 只生成候选，PubMed / Crossref 负责核验，Zotero 翻译器负责最终导入。

## 数据流

```text
mp.weixin.qq.com
       │ HTML
       ▼
本地 DOM 提取 ──> 可编辑正文 ──> DeepSeek JSON Output
                                      │ 候选题名/PMID/DOI
                       ┌──────────────┴──────────────┐
                       ▼                             ▼
                    PubMed                       Crossref
                       └──────────┬──────────────────┘
                                  ▼
                         已核实的规范数据库记录
                                  │ PMID / DOI
                                  ▼
                       Zotero Translate.Search
                                  │
                                  ▼
                         目标文库或目标分类
```

## 模块职责

| 文件 | 职责 |
| --- | --- |
| `bootstrap.js` | 注册 chrome content，管理插件生命周期 |
| `content/wechat-importer.js` | 注册工具菜单、工具栏按钮，确定目标文库/分类并打开窗口 |
| `content/wechat-import.xhtml` | 窗口结构和控件 |
| `content/wechat-import.css` | 浅色/深色界面样式 |
| `content/wechat-import.js` | 页面提取、DeepSeek 调用、PubMed/Crossref 查询、去重和导入 |
| `content/wechat-core.js` | DOI/PMID 规范化、候选清洗、题名相似度和结果键；可在 Node 中测试 |
| `tests/core.test.js` | 核心纯函数回归测试 |

## 信任边界

### 微信页面是不可信输入

- 只接受 `https://mp.weixin.qq.com/` 主机。
- 使用 `DOMParser` 解析页面，不执行页面脚本。
- 在提取正文前移除 `script`、`style` 和 `noscript`。
- UI 渲染统一使用 `textContent`，不把文章内容或模型输出写入 `innerHTML`。
- 正文少于 80 字符时拒绝分析，避免将验证页或空页面当成正文。

### DeepSeek 输出是不可信输入

- 请求启用 JSON Output，并在提示词中给出明确 JSON 结构。
- 只读取 `references` 数组，最多保留 30 条。
- 对所有字符串执行去空白和最大长度限制。
- DOI 必须通过 `10.<registrant>/<suffix>` 形式校验；PMID 只接受数字。
- 按 DOI、PMID 或规范化题名去重。
- 模型输出不能直接进入 Zotero。

### 外部数据库记录仍需约束

- PubMed 记录由 ESearch + ESummary 返回。
- Crossref 精确 DOI 查询失败后才退回题名检索。
- 所有远程文本通过 `textContent` 显示。
- 外部链接由插件根据 PMID 或已校验 DOI 构造，不直接信任模型生成 URL。

## 文献核验策略

每条候选按优先级处理：

1. **PMID 精确匹配**：`<pmid>[PMID]`。
2. **DOI 精确匹配**：PubMed 的 `[AID]` 查询；未命中时查询 Crossref `/works/<doi>`。
3. **题名匹配**：先尝试 PubMed 题名短语查询，再退回普通查询；PubMed 未匹配时检索 Crossref。

题名相似度使用规范化词元的 Sørensen–Dice 系数：

```text
score = 2 × |tokens(A) ∩ tokens(B)| / (|tokens(A)| + |tokens(B)|)
```

阈值：

- PubMed：`0.58`
- Crossref：`0.62`

标识符精确匹配不受题名阈值限制。阈值刻意偏保守；宁可显示“未核实”，也不把低置信度结果写入 Zotero。

## 重复检查

核验完成后和实际导入前，插件都会在目标文库中检查：

- `PMID is <value>`
- `DOI is <value>`

命中任意一个条件即标记为“已存在”。当前版本不使用题名模糊去重，因为题名变体、勘误和预印本/正式版本关系容易造成误判。

## Zotero 导入

导入使用 `Zotero.Translate.Search`：

1. 优先尝试 PMID；
2. 再尝试 DOI；
3. 使用当前窗口打开时记录的 `libraryID`；
4. 有目标分类时传入 `collections`；
5. `saveAttachments: false`，不下载附件。

数据库核验与 Zotero 翻译是两个独立步骤：即使 Crossref 能返回记录，Zotero 翻译器仍可能因为临时网络或元数据问题失败。

## API Key 与日志

- DeepSeek 地址固定为 `https://api.deepseek.com/chat/completions`。
- 默认不持久化 API Key。
- 用户主动勾选时，Key 以明文写入 Zotero 全局首选项：`extensions.zotero-wechat-importer.apiKey`。
- “清除已保存 Key”会删除该首选项。
- 错误日志只记录经过清洗的 HTTP 状态或错误消息，不记录请求头和 API Key。

## 网络与超时

| 请求 | 超时 |
| --- | ---: |
| 微信 HTML | 45 秒 |
| DeepSeek Chat Completions | 120 秒 |
| PubMed / Crossref JSON | 45 秒 |

多条候选按顺序查询，并在候选间加入短暂延迟，以减少对公共数据库的瞬时请求压力。

## 当前不做的事情

- 不绕过微信访问验证或反爬机制；
- 不解析正文图片中的题名、表格或参考文献；
- 不允许把未核实的模型输出直接保存成 Zotero 条目；
- 不保存微信网页条目或快照；
- 不下载论文 PDF；
- 不向项目作者服务器发送遥测；
- 不提供 DeepSeek 以外的 API Endpoint 配置。

## 测试与发布

`./scripts/check.sh` 会执行：

- `manifest.json` 与 `updates.json` 版本一致性检查；
- JavaScript 语法检查；
- `wechat-core.js` 单元测试；
- XHTML XML 解析检查；
- 发布所需文件存在性检查。

`./scripts/build.sh` 在临时目录中复制发布文件，统一时间戳后生成确定性的 XPI。推送 `v*` 标签时，GitHub Actions 会验证标签版本、构建 XPI 并发布到 GitHub Releases。
