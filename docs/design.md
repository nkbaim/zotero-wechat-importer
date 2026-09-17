# 设计说明

微信公众号正文和 DeepSeek 输出均视为不可信输入。界面只通过 `textContent` 渲染内容，不执行文章 HTML；DeepSeek 返回值需先解析为 JSON，再进行字段长度、数量和标识符规范化。

最终题录不由 DeepSeek 直接创建。插件依次使用 PMID、DOI 和题名在 PubMed/Crossref 核验线索。题名候选使用规范化词元的 Sørensen–Dice 相似度筛选；未核实记录不可选择。导入时再由 Zotero 的 `Translate.Search` 使用 PMID/DOI 解析规范题录。

```text
微信链接 ──> 正文 ──> DeepSeek（文献线索 JSON）
                         │
                         ├──> PubMed ──┐
                         └──> Crossref ├──> 已核实记录 ──> Zotero 标识符翻译器
                                      ┘
```

题名匹配阈值：PubMed `0.58`，Crossref `0.62`。标识符精确匹配不受题名阈值限制。
