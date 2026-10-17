# WorkBuddy 开发上下文

> 本文件用于核验本项目是否符合 WorkBuddy 联动活动奖励条件。
> 内容为本次开发会话的**整理稿**（非逐字转录）：原始对话记录中含 McDonald's MCP Token，按参赛声明的信息安全要求已脱敏处理，Token 以 `<MCD_MCP_TOKEN>` 代替。

## 1. 基本信息

| 项 | 内容 |
| --- | --- |
| 开发工具 | WorkBuddy（Agent 模式） |
| 会话日期 | 2026-10-17 |
| 项目 | 麦麦老样子 · McD Repeat Smarter |
| 项目类型 | 麦当劳程序员节创意开发大赛参赛作品 |
| 工作目录 | `mcd-repeat-smarter/` |

## 2. 会话脉络

### 阶段 0：接任务与方向确认

1. 用户给出官方仓库 `M-China/mcd-developer-innovation-challenge`，要求用 WorkBuddy 开发参赛项目。
2. 我先做了**赛道调研**（拉 `RANKING.md` + 检索同类仓库），最初建议做"团餐拼单/AA 分账"，理由是看起来是空白。
3. 检索后发现这个判断是错的——`mcd-social-suite`、`mcd-meal-brain`、`mcd-group-order`、`mthli/mcd-order`、`mcd-catering-butler` 等已经占了这块。**我主动告知用户判断有误并重新筛选方向。**
4. 最终选定「麦麦老样子」：不做泛化推荐，做"重复点单 + 增量修改 + 真实核价 + 确认下单"。

### 阶段 1：先验证真实能力，再设计功能

在写任何业务代码前，先用一个零依赖 Python 探测器（`probe/mcd_probe.py`，仅标准库 urllib）打通 MCP：

- 确认传输方式、协议版本、会话头、认证头；
- 导出**全部 35 个真实 Tool**（比公开文档多，含文档未收录的 `query-survey-coupon`、`query-promotions`）；
- 用真实账号拉历史订单、真实菜单、真实核价、真实券。

这一步产出了几个直接影响实现的结论：

| 发现 | 对实现的影响 |
| --- | --- |
| `calculate-price` 返回「分」，`query-meals` 的 `currentPrice` 是「元」字符串 | 领域层统一存「分」整数 |
| 用户历史 10 单里最爱的 `随心配1+1`（9900010829）**已下架** | 必须做"商品身份重匹配 + 显式告知"，这是本项目最核心的差异化 |
| `精选超值随心配`(9900013291) 能完整复现用户习惯（鸡排 + 香芋派） | 候选生成要按"轮次结构"而不是按商品名 |
| 历史订单不返回轮次、不返回图片 | 子项匹配先全套餐搜索再反推轮次 |
| 含 `unselectedKey` 的特调组必须整组传 | 漏传会静默按全配计价 |

### 阶段 2~3：搭架构 + 打通核心闭环

按模块拆分实现：意图解析（规则引擎）→ 原方案匹配 → 增量修改解析 → 候选生成 → 官方核价 → 预算校验 → 确认状态管理 → 持久化。

**开发中真实修掉的 bug：**

1. `add` 分支排在 `locateTarget` 之后，导致"加一份麦乐鸡"被吞 → 调整分支顺序；
2. 备选方案生成不出来：在"已被修改的 items"上定位目标 → 改在原始方案 `baseItems` 上定位；
3. 子项匹配只在推断轮次内搜索，导致换了轮次的同名商品被误判 → 改为全套餐搜索；
4. `随心配1+1` 匹配不到 `人气经典随心配`（相似度 0.43）→ 修正包含关系的相似度算法，阈值 0.7 → 0.62；
5. 测试断言本身写错（用了能精确匹配的商品去测别名分支）→ 换商品修正。

### 阶段 4：UI 与交互打磨

- 建立完整设计系统（暖奶油底 + 克制的麦当劳红 + 金黄点缀，CSS 变量 + 组件类）；
- 关键界面：首屏"今天还是老样子？"、改了什么（两列对比）、候选方案（带 traceId）、确认抽屉（勾选才可下单）；
- 用 Puppeteer 驱动本机浏览器自动化走通主流程并截图，**浏览器控制台零报错**；
- 按截图实际效果修了移动端品牌名被压成竖排的问题，补了首屏三步说明。

### 阶段 5：测试与验证

- 79 个测试全绿（意图 13 / 匹配 17 / 规划 16 / 定价 11 / 存储 7 / API 15）；
- `tsc --noEmit` 无错误；`vite build` 成功（gzip 约 83 KB）；
- 下单安全闸门逐个验证：未确认 428、`confirmed:false` 428、伪造令牌 410、非法取餐方式 400、令牌一次性；
- 新增"副作用计数"测试：用计数网关证明未确认时 `createOrder` 调用次数为 0。

### 阶段 6：交付材料

`README.md`、`CONTEST_DECLARATION.md`（从官方仓库取原文，逐字节校验一致）、`MCP_INTEGRATION.md`、`mcp-config.example.json`、`.env.example`、`docs/COMPETITIVE_CHECK.md`、`scripts/probe-mcp.ts`、`scripts/screenshots.mjs`。

## 3. WorkBuddy 能力使用情况

| 能力 | 用途 |
| --- | --- |
| 文件读写与编辑 | 全部代码、文档、配置的生成与修改 |
| 终端命令执行 | `npm install` / `npm test` / `npm run build` / 启动服务 / 端口排查 |
| 网页检索与抓取 | 竞品调研、官方仓库文件核验（`RANKING.md`、`CONTEST_DECLARATION.md`） |
| 脚本编写与运行 | MCP 探测器（Python）、截图脚本（Node + puppeteer-core） |
| 截图查看 | 读取生成的 UI 截图并按视觉效果修正布局问题 |

## 4. 可复现的验证路径

```bash
cd mcd-repeat-smarter
npm install
cp .env.example .env      # 填入自己的 MCD_MCP_TOKEN
npm run mcp:probe         # 只读自检：Tool 数 / 菜单 / 历史订单 / 真实核价
npm test                  # 79 个测试
npm run build && npm start
```

## 5. 说明

- 整个项目从选题调研、MCP 能力核验、架构设计、编码、UI 打磨到测试与文档，均在 WorkBuddy 中完成。
- 项目中不含任何真实 Token、密钥或他人个人信息；`.env` 已被 `.gitignore` 排除。
- 竞品调研仅基于公开信息（官方排行榜 + 公开仓库说明），未审阅全部仓库源码，未核实部分在 `docs/COMPETITIVE_CHECK.md` 中标记为「未知」。
