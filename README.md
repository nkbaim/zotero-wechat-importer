<p align="center">
  <img src="icon.svg" alt="WeChat Article Reference Importer logo" width="112" height="112">
</p>

<h1 align="center">zotero-wechat-importer</h1>

<p align="center">
  从微信公众号文章中识别学术论文，经 PubMed / Crossref 核验后导入 Zotero。
</p>

<p align="center">
  <a href="https://github.com/nkbaim/zotero-wechat-importer/releases/latest"><img src="https://img.shields.io/github/v/release/nkbaim/zotero-wechat-importer?display_name=tag" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/Zotero-9-cc2936" alt="Zotero 9">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/nkbaim/zotero-wechat-importer" alt="MIT License"></a>
</p>

## 这个插件解决什么问题？

不少微信公众号文章会解读或引用学术论文，但正文中的文献线索并不总是完整：可能只有题名、作者、期刊截图、DOI，或者只在某段话里提到研究结论。逐篇复制关键词、打开数据库检索、核对题录再导入 Zotero，过程很容易中断。

`zotero-wechat-importer` 把这条流程放进 Zotero：

```text
微信公众号链接 → 提取正文 → DeepSeek 识别文献线索
                              ↓
                    PubMed / Crossref 核验
                              ↓
                      Zotero 规范题录导入
```

DeepSeek **只负责提取检索线索**，不会直接生成最终题录。可导入记录必须经过 PubMed 或 Crossref 核验，并在导入时再次由 Zotero 的标识符翻译器解析。这可以降低大语言模型虚构题名、作者或 DOI 后被直接写入文库的风险。

## 界面

![微信公众号文献导入主界面](docs/images/main-window.png)

窗口顶部会显示当前导入目标。请在打开插件前，先在 Zotero 左侧选择正确的文库或分类。

## 核心功能

- 从 `https://mp.weixin.qq.com/` 文章链接提取标题、公众号、作者、日期和正文
- 微信页面触发访问验证时，允许手动粘贴正文继续处理
- 使用 DeepSeek JSON Output 提取最多 30 条明确提及或引用的论文线索
- 按 PMID、DOI 或题名在 PubMed 和 Crossref 中检索并核验
- 展示题名、作者、期刊、年份、标识符以及微信原文依据
- 区分 `PubMed`、`Crossref`、`已存在` 和 `未核实` 状态
- 按 PMID 和 DOI 检查当前目标文库中的重复条目
- 批量导入当前 Zotero 文库或当前选中的分类
- 支持 Zotero 浅色和深色外观

## 快速开始

### 1. 安装

1. 从 [最新版本页面](https://github.com/nkbaim/zotero-wechat-importer/releases/latest) 下载 `zotero-wechat-importer-*.xpi`。
2. 在 Zotero 中打开“工具 → 插件”。
3. 点击右上角齿轮按钮，选择“从文件安装插件”。
4. 选择下载的 XPI；如 Zotero 提示，请完全退出并重新启动。

本插件当前面向 **Zotero 9**。项目清单中的兼容范围为 Zotero `8.999` 至 `10.0.*`，其中 `8.999` 是 Zotero 9 系列的兼容性边界写法。

### 2. 准备 DeepSeek API Key

插件直接访问 DeepSeek 官方接口，需要用户自己的 API Key。插件不提供共享 Key，也没有项目作者控制的代理服务器。

打开插件并成功提取文章后：

1. 展开“DeepSeek API 设置”。
2. 填写 API Key。
3. 模型默认是 `deepseek-flash`；如 DeepSeek 调整模型名称，可在模型输入框中修改。
4. 不勾选保存时，Key 只保留在当前窗口；勾选后会以**明文**保存在本机 Zotero 首选项中。

### 3. 提取、核验并导入

1. 在 Zotero 左侧选择目标文库或分类。
2. 点击文献工具栏中的微信图标，或选择“工具 → 从微信公众号文章导入文献…”。
3. 粘贴以 `https://mp.weixin.qq.com/` 开头的文章链接，点击“提取文章”。
4. 检查提取出的正文；必要时可以修改或手动粘贴完整正文。
5. 配置 DeepSeek API Key，点击“AI 识别并检索文献”。
6. 根据题名、作者、原文线索、PMID/DOI 和核验来源人工复核结果。
7. 勾选需要的已核实记录，点击“导入所选文献”。

完整操作、状态解释和故障排查见：[使用手册](docs/usage.md)。

## 如何理解检索结果？

| 状态 | 含义 | 能否选择 |
| --- | --- | --- |
| `PubMed` | 在 PubMed 找到可信匹配 | 可以 |
| `Crossref` | 在 Crossref 找到可信匹配 | 可以 |
| `已存在` | 当前目标文库已有相同 PMID 或 DOI | 不可以 |
| `未核实` | 两个数据库均未找到达到匹配要求的记录，或检索失败 | 不可以 |

“原文线索”来自微信公众号正文，用于帮助判断 AI 为什么识别出该论文；它不是数据库核验结果，也不能代替用户最终确认。

## 数据与隐私

| 数据 | 发送到哪里 | 用途 |
| --- | --- | --- |
| 文章链接 | 微信公众平台 | 下载公开文章页面 |
| 文章标题、链接和最多 60,000 字符正文 | DeepSeek | 提取文献线索 |
| PMID、DOI、题名或检索短语 | NCBI PubMed、Crossref | 核验题录 |
| API Key | DeepSeek | API 鉴权 |

- 插件不包含遥测，不向项目作者发送文章、Key 或 Zotero 文库内容。
- API Key 默认不落盘；选择保存时会明文写入本机 Zotero 首选项。
- 可随时在“DeepSeek API 设置”中点击“清除已保存 Key”。
- 请勿把包含敏感、保密或未公开内容的正文发送给第三方模型服务。

## 当前边界

- 只支持 `mp.weixin.qq.com` 的 HTTPS 链接。
- 微信可能要求访问验证，导致自动提取失败；此时需要手动粘贴正文。
- AI 可能漏掉论文、拆错题名或生成错误线索，因此导入前仍需人工复核。
- 插件不会把微信公众号文章本身保存为 Zotero 网页条目。
- 插件只导入题录，不保存微信网页快照，也不自动下载论文全文或附件。
- 无法在 PubMed / Crossref 中核实，或无法由 Zotero 标识符翻译器解析的记录不会导入。

## 开发与构建

项目不依赖 npm 包。macOS 或 Linux 需要 `bash`、`node`、`python3`、`zip` 和 `shasum`：

```bash
./scripts/check.sh
./scripts/build.sh
```

构建产物位于 `dist/zotero-wechat-importer-<version>.xpi`。发布 `v*` 标签时，GitHub Actions 会校验标签与 `manifest.json` 版本一致、构建 XPI，并创建 GitHub Release。

项目结构：

```text
content/wechat-importer.js   Zotero 菜单、工具栏和窗口入口
content/wechat-import.xhtml  插件窗口结构
content/wechat-import.css    界面样式
content/wechat-import.js     微信提取、DeepSeek、检索、去重和导入流程
content/wechat-core.js       可独立测试的规范化、去重和题名匹配逻辑
tests/core.test.js           核心逻辑测试
scripts/check.sh             发布前检查
scripts/build.sh             可复现 XPI 构建
```

- [使用手册](docs/usage.md)
- [设计与安全说明](docs/design.md)
- [版本记录](CHANGELOG.md)
- [问题反馈](https://github.com/nkbaim/zotero-wechat-importer/issues)

## License 与商标

项目代码以 [MIT License](LICENSE) 发布。

微信名称与图标的商标权归腾讯所有；本项目与腾讯无隶属、合作或背书关系。
