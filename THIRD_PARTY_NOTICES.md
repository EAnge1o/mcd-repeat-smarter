# Third-party notices

本项目在 `public/fonts/` 下分发了第三方字体分片。分发它们是因为标题层的
点阵字形是这套设计的基础，去掉会改变整个视觉方向。

---

## Fusion Pixel Font（融合像素字体）

本项目使用 **Fusion Pixel Font 12px Proportional Simplified Chinese** 的 21 个
WOFF2 分片，共约 548 KB，存放于 `public/fonts/`。

| 项目 | 内容 |
| --- | --- |
| 原字体 | Fusion Pixel Font，作者 TakWolf 及贡献者 |
| 上游仓库 | https://github.com/TakWolf/fusion-pixel-font |
| 上游版本 | 2026.08.11 |
| **字体授权** | **SIL Open Font License 1.1** |
| 分发包 | `@vp-tw/cjk-web-fonts-fusion-pixel-font@0.0.1`（非官方 WOFF2 打包，由 vp-tw 维护） |
| 分包授权 | 打包层的构建工具与文档为 MIT；**字体文件与生成的子集仍为 OFL-1.1** |

**本项目只收录标题层实际出现字符命中的分片**，不是完整字库。分片集合由
`scripts/build-pixel-font.py` 从上游 CSS 的 `unicode-range` 反推得出。

Fusion Pixel Font 由多个 OFL 授权的字体项目合并而成 —— 上游六个锁定归档的
完整授权文本保留在分发包的 `LICENSE.font.txt` 与 `LICENSES/` 中。

OFL-1.1 允许自由使用、修改与再分发，包括嵌入到网页与软件中；要求保留版权
声明与授权文本，且不得单独售卖字体本身。本项目符合上述要求。

---

## Google Fonts

`index.html` 通过 Google Fonts CDN 引入：

- **Noto Sans SC** — SIL Open Font License 1.1（正文）
- **DM Mono** — SIL Open Font License 1.1（订单号等宽字符串）

---

本文件只覆盖项目分发的第三方资源。项目本身的授权见仓库根目录的说明。