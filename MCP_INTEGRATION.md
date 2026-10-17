# 麦当劳 MCP 集成说明

本文说明「麦麦老样子 / McD Repeat Smarter」实际调用了哪些麦当劳 MCP 能力、调用流程是什么、为什么必须用 MCP，以及当前 MCP 能力边界的真实情况。

文中所有结论都来自本项目对 `https://mcp.mcd.cn` 的实际调用，可用 `npm run mcp:probe` 复现（见第 8 节）。

---

## 1. 接入概览

| 项目 | 实际情况 |
| --- | --- |
| MCP Server | `https://mcp.mcd.cn`（麦当劳中国官方 MCP Server） |
| 传输方式 | Streamable HTTP（POST + `application/json`，兼容 `text/event-stream` 响应） |
| 协议版本 | `2025-03-26`，请求头 `MCP-Protocol-Version` |
| 会话 | 初始化响应返回 `Mcp-Session-Id`，后续请求需回带 |
| 认证 | `Authorization: Bearer <MCD_MCP_TOKEN>` |
| 限流 | 官方限制 600 次/分钟；客户端把 HTTP 429 映射为「调用过于频繁」并提示重试 |
| 客户端实现 | 零 SDK 依赖，`server/mcp/client.ts`（226 行，手写 JSON-RPC 2.0） |
| Token 位置 | 仅存在于服务端进程环境变量 `MCD_MCP_TOKEN`，浏览器与构建产物中不出现 |

**自检结果（2026-10-17 实测）**：MCP Server 当前共暴露 **35 个 Tool**，比公开文档列出的更多，其中包含 `query-survey-coupon`、`query-promotions` 等文档未收录的工具。本项目按需使用了其中 **7 个**。

---

## 2. 实际使用的 7 个 Tool

### 2.1 `query-nearby-stores` —— 门店检索

| 项 | 内容 |
| --- | --- |
| 入参 | `searchType`、`city`、`keyword`、`beType` |
| 出参 | 门店列表（`storeCode`、`storeName`、地址、营业状态等） |
| 本项目用途 | 门店切换器（`GET /api/stores`）。用户换店后，整个方案的核价会在新门店重新做一次 |
| 为什么必须用 | 门店编码是核价与下单的必要参数；不同门店的商品与价格不同，不能由前端猜 |

> 实测约束：`searchType=2`（按关键词）**必须同时传 `city` 与 `keyword`**，只传关键词会报错。这一条在公开文档里没有写清楚，是通过试错确认的。

### 2.2 `query-meals` —— 门店在售菜单

| 项 | 内容 |
| --- | --- |
| 入参 | `storeCode`、`orderType`、`beType` |
| 出参 | 分类结构 `categories[]` + 商品字典 `meals{}`（名称、图片、`currentPrice`、`originalPrice`） |
| 本项目用途 | ① 判断历史订单里的商品**今天还在不在售**；② 商品下架后按核心词重新匹配到在售同义商品；③ 生成候选方案时的可选项池 |
| 为什么必须用 | 这是「不伪造菜单」的唯一来源。项目里不存在任何硬编码菜单或价格 |

### 2.3 `query-meal-detail` —— 套餐详情

| 项 | 内容 |
| --- | --- |
| 入参 | `storeCode`、`orderType`、`beType`、`code`（套餐编码） |
| 出参 | `rounds[]`：每个轮次的 `id / name / minQuantity / maxQuantity / choices[]`；每个 choice 带 `diffPrice`、`selectedKey / unselectedKey` 等特制定义 |
| 本项目用途 | ① 还原「随心配」这类套餐的**分区结构**（蓝区/粉区…）；② 用户说「不要香芋派，换个别的」时，知道这一格有哪些合法替换项；③ 处理特制项（少冰、去酱） |
| 为什么必须用 | 套餐子项的合法性、加价、可选范围只有 MCP 知道；靠商品名猜会直接导致下单失败或价格错误 |

### 2.4 `order-list` —— 历史订单

| 项 | 内容 |
| --- | --- |
| 入参 | 无（读取当前 Token 对应用户的订单） |
| 出参 | 订单列表：`orderId`、`createTime`、`storeCode/Name`、`beType`、`orderStatus`、`orderProductList[]`（含 `comboItemList`）、`realTotalAmount` |
| 本项目用途 | ① 「还是上次那份」的数据底座；② 首屏习惯画像（最常点的商品/子项/时段/门店）的**唯一数据源**；③ 「最近的单」列表 |
| 为什么必须用 | 用户「老样子」指哪一份，只有真实订单能回答。项目里**没有任何预置历史订单** |

> 实测约束：历史订单**不返回套餐子项所属的轮次**，也不返回商品图片。因此子项匹配必须先在整个套餐的所有轮次里按名称搜索，命中后再反推轮次归属——这一点直接影响了 `server/domain/matcher.ts` 的实现。

### 2.5 `calculate-price` —— 官方核价

| 项 | 内容 |
| --- | --- |
| 入参 | `storeCode`、`orderType`、`beType`、`items[]`（套餐需带 `roundList: [{round, comboItemList:[{code, quantity}]}]`） |
| 出参 | `price`（实付，单位「分」）、`originalPrice`、`discount`、`productList[]` 明细、`takeWayList[]` 取餐方式、`traceId` |
| 本项目用途 | 每一个候选方案、每一次确认前预览，都必须单独调用一次；界面上的金额全部来自这里 |
| 为什么必须用 | 价格、优惠、加价、取餐方式都是官方业务规则，**项目里没有任何价格常量，也没有让模型生成价格** |

> 实测坑 1：`calculate-price` 的金额是**单位「分」的整数**，而 `query-meals` 的 `currentPrice` 是**单位「元」的字符串**（如 `"13.9"`）。两处混用会导致价格差 100 倍。本项目统一在领域层转成「分」整数存储（`yuanToCents()` / `asCents()`），只在渲染时换算。
>
> 实测坑 2：含 `unselectedKey` 的特调组**必须整组传**（保留传 `selectedKey`，去掉传 `unselectedKey`）。漏传不会报错，后端会静默按「全配」计价，导致价格偏高且难以察觉。

### 2.6 `query-my-coupons` —— 我的优惠券

| 项 | 内容 |
| --- | --- |
| 入参 | 无 |
| 出参 | 券列表（券码、标题、副标题、图片） |
| 本项目用途 | `GET /api/coupons`，用于展示当前账号可用的券；`calculate-price` 返回的 `discount` 会反映券的实际抵扣 |
| 为什么必须用 | 券与优惠是账号级、时效性极强的数据，只能实时读 |

> 能力限制：官方规则为**单笔订单仅支持使用 1 张优惠券**，因此本项目没有做多券叠加，也没有代用户选券——券的选择交给官方结算流程，避免出现「算得便宜、下单变贵」。

### 2.7 `create-order` —— 提交订单

| 项 | 内容 |
| --- | --- |
| 入参 | `storeCode`、`orderType`、`beType`、`takeWayCode`、`items[]`、`remark`（仅外送） |
| 出参 | `orderId`、`payUrl`（支付链接） |
| 本项目用途 | **仅在用户明确确认后**调用一次，见第 6 节 |
| 为什么必须用 | 这是唯一的下单通道；没有它，产品只能停在「准备好订单」而不能闭环 |

---

## 3. 端到端调用流程

### 3.1 场景 A：重复上次点单（"还是上次那份早餐"）

```
浏览器  POST /api/adjust { message: "还是上次那份" }
  │
  ├─ order-list            → 取最近一单（真实订单）
  │                           └─ 无订单时回退到用户保存的方案，两者都没有则明确告知
  ├─ query-meals           → 该门店当前在售清单
  ├─ query-meal-detail     → 逐套餐取轮次结构（判断子项是否还合法）
  ├─ matchPlan()           → 商品身份重匹配（exact / renamed / substituted / unavailable）
  ├─ calculate-price       → 对每个候选方案单独核价
  └─ verifyBreakdown()     → 覆盖性 / 合计一致性 / 零金额三类自检
  ↓
浏览器渲染「改了什么」＋候选方案（每个金额带 traceId）
```

### 3.2 场景 B：保留原方案，只改一点（"不要香芋派，换个东西，预算不超过 25 元"）

```
POST /api/adjust
  ├─ 规则引擎解析意图        → wantsRepeat / changes[{type:remove|replace|add|budget}] / budgetCents
  ├─ order-list 或本地方案    → 原方案（base）
  ├─ query-meals             → 在售清单
  ├─ query-meal-detail       → 目标子项所在轮次的全部候选（含 diffPrice 加价）
  ├─ buildCandidates()
  │    ├─ minimal   ：严格按你说的改，其余一字不动
  │    ├─ swap-fit  ：同轮次另一种搭配（让用户有得选）
  │    └─ budget-fit：仅在原方案超预算时生成
  ├─ calculate-price ×N      → 每个候选一次真实核价
  ├─ markBudget()            → 与用户预算比较，超预算必须显式说明，不静默突破
  └─ 返回 changes: kept / replaced / added / preference
```

### 3.3 场景 C：保存常用方案（"存成上班早餐"）

```
POST /api/plans  { items: PlanItem[], storeCode, storeName, beType, tag }
  └─ 落盘 data/plans.json（原子写：临时文件 + rename；写操作串行化）
       ↑ 存的是结构化餐品信息：productCode / name / quantity /
         children[{code, name, quantity, round}] / createdAt / source
       ↑ 不存价格（价格有时效性，用之前必须重新 calculate-price）
```

### 3.4 场景 D：下单前确认（唯一有副作用的链路）

```
① POST /api/order/preview
     └─ calculate-price（再核一次价，避免用过期价格下单）
     └─ 生成一次性令牌 token（5 分钟有效，绑定 storeCode/beType/items/priceCents/takeWayList）
② 用户在确认抽屉里核对门店、餐品、金额、取餐方式，并**勾选**「我已核对」
③ POST /api/order/confirm { token, takeWayCode, confirmed: true }
     └─ 校验 confirmed === true      否则 428 CONFIRM_REQUIRED
     └─ 校验令牌存在且未过期         否则 410 PREVIEW_EXPIRED
     └─ 校验 takeWayCode 在本次核价返回的 takeWayList 内  否则 400 INVALID_TAKEWAY
     └─ create-order
     └─ 令牌立即销毁（一次性）
```

---

## 4. 数据来源可追溯

每个数据对象都带 `source` 字段，前端必须据此显示徽标：

| source | 含义 | UI 表现 |
| --- | --- | --- |
| `mcp` | 麦当劳 MCP 实时返回 | 顶栏「实时数据」绿点；候选卡显示 `官方核价 · trace xxxxxxxx` |
| `user` | 用户自己保存的常用方案 | 「我的常用方案」分组，不显示为官方数据 |
| `demo` | 内置演示数据 | 顶栏「演示数据」+ 首屏黄色警示条，且所有金额标记为演示 |

`calculate-price` 返回的 `traceId` 会透传到前端，界面上可以直接看到「这个价格来自哪一次真实调用」，便于评审抽查。

**演示模式不会冒充真实数据**：`server/mcp/demoService.ts` 的每一个返回值都硬编码 `source: 'demo'`，`gateway.mode` 为 `demo` 时前端强制显示警示条；演示模式下的下单接口只返回模拟结果并明确标注「没有创建真实订单」。

---

## 5. 关键工程约束（真实踩过的坑）

| # | 现象 | 根因 | 本项目的处理 |
| --- | --- | --- | --- |
| 1 | 同一个套餐在两个接口里的价格差 100 倍 | `calculate-price` 用「分」，`query-meals` 用「元」字符串 | 领域层统一「分」整数，入口处归一化，渲染时才除以 100 |
| 2 | 核价返回 0 元 | 该商品当前已不在售（`query-meals` 里查不到），不是参数格式问题 | 核价前先做在售校验；核价结果为 0 视为异常并提示 |
| 3 | 用户说「不要香芋派」，系统说找不到 | 历史订单不带轮次，而早期实现只在«推断出的轮次»里搜索 | 改为在整个套餐的所有轮次里按名称搜索，命中后修正轮次归属 |
| 4 | 换个门店后价格不对 | 门店编码与会话状态被复用 | 切店即清空当前结果，所有核价用新 `storeCode` 重算 |
| 5 | 特制项去掉后价格偏高 | 含 `unselectedKey` 的组漏传会被静默按全配计价 | 特制组整组传递（保留传 `selectedKey`，去掉传 `unselectedKey`） |

---

## 6. 安全边界

1. **Token 只在服务端**：`server/mcp/client.ts` 是唯一读取 `MCD_MCP_TOKEN` 的地方；浏览器请求体、响应体、错误信息、日志里都不出现 Token（`McpError` 只带 kind/message/hint，不透传请求头）。
2. **不伪造历史订单**：历史订单只能来自 `order-list`；读不到就是读不到，界面明说「这个账号还没有可读取的订单」，不会用假数据把流程"演"通。
3. **不编造价格**：所有金额都对应一次真实的 `calculate-price` 调用（或演示模式下标注为 demo 的计算）。
4. **有副作用必须显式确认**：`create-order` 只能通过 `/api/order/confirm` 触发，且必须 `confirmed === true` + 有效一次性令牌。未勾选时按钮是 disabled 的，绕过 UI 直接调接口会得到 428。
5. **不使用非官方通道**：没有爬虫、没有绕过鉴权、没有复用他人 Token 的设计。

---

## 7. MCP 能力边界与已知限制

诚实记录当前做不到或做得不够好的地方：

| 项 | 现状 | 影响 |
| --- | --- | --- |
| 历史订单不含轮次 | `order-list` 的 `comboItemList` 只有 `productCode / name / quantity` | 子项轮次靠「按名称反查当前套餐结构」推断，极端情况下（同名商品出现在多个轮次）可能推断错，此时会标记为需用户确认 |
| 历史订单不含图片 | 历史订单没有 `image` 字段 | 「原方案」列的餐品没有图片，图片只在候选方案里出现（来自 `query-meals`） |
| 特制项还原不完整 | 历史订单不返回用户在**上次下单时**选的特制项 | 「老样子」还原的是餐品结构，不含上次的少冰/去酱等特制偏好；这类偏好目前只能通过本次自然语言提出 |
| 单笔仅 1 张券 | 官方规则 | 不做多券叠加，不做代选券 |
| 不支持"帮我改到这个价位"的反向求解 | 只能按用户明确说的改动执行 | 预算不满足时，明确说明原因并给出最接近的方案，不偷偷换掉用户要的东西 |
| 门店搜索需要 city + keyword | `searchType=2` 的接口约束 | 门店切换器强制要求先选城市再输关键词 |
| 演示模式数据是内置的 | `DEMO_MODE=true` 或无 Token 时启用 | 演示数据只用于体验流程，不能当作真实供应情况；UI 有强制警示 |
| 未使用的能力 | 35 个 Tool 中的积分商城、抽奖、派对/团餐、营养库、活动日历等 28 个 | 不属于本产品核心闭环，未接入，也未在文档中宣称支持 |

---

## 8. 如何自行验证

```bash
cp .env.example .env      # 填入 MCD_MCP_TOKEN
npm install
npm run mcp:probe         # 只读自检，不会创建订单
```

自检会依次输出：Tool 清单（当前 35 个）→ 门店在售商品数与样例 → 可读取的历史订单数与样例 → 一个含必选轮次套餐的真实核价明细（含 `traceId`）。

2026-10-17 的真实输出片段：

```
1. 服务端实际暴露的 Tool（tools/list）
共 35 个
2. 门店菜单（query-meals）
在售商品 102 个（orderType=1）
3. 历史订单（order-list）
可读取订单 10 单
4. 官方核价（query-meal-detail + calculate-price）
套餐：9900005456 麦辣鸡腿汉堡三件套
轮次：麦辣鸡腿汉堡 / 选择套餐内小食 / 选择套餐内饮料
合计 33.50 元（原价 33.50 元，优惠 0.00 元）
数据来源 source=mcp ｜ traceId=6e49dc0cdae58e8876891077361f39a1
```

---

## 9. 业务价值：为什么这些 Tool 组合起来才有意义

单看每个 Tool，都是「查菜单 / 查订单 / 算价格」这类基础能力。本项目的价值在于把它们串成一条**能落到真实下单的个性化链路**：

- `order-list` 让「老样子」有真实所指，而不是让模型编一个套餐；
- `query-meals` + `query-meal-detail` 让「改一点」有合法边界，用户说「换个别的」时给的是**这家店今天真能点**的选项；
- `calculate-price` 让「预算 25 元」变成可判定的结论，而不是一句听起来合理的估计；
- `create-order` 让整条链路闭环，但被两层闸门（一次性令牌 + 显式勾选）挡在用户确认之后。

少了任何一个，产品就会退化成「一个会聊天的菜单」。
