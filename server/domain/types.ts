/**
 * 领域模型：麦麦老样子（McD Repeat Smarter）
 *
 * 设计原则：
 * 1. 餐品身份（productCode）与展示信息（name/image）分离，因为历史订单里的编码会失效。
 * 2. 金额一律用「分」的整数存储，避免浮点误差；展示层再换算成元。
 * 3. 每个数据对象都带 source 标记，UI 必须能区分 MCP 实时数据 / 用户保存数据 / 演示数据。
 */

/** 数据来源。mcp = 麦当劳 MCP 实时返回；user = 用户主动保存；demo = 内置演示数据。 */
export type DataSource = 'mcp' | 'user' | 'demo';

/** 点餐方式 → MCP 的 beType。1 到店自取，2 麦乐送，5 得来速，6 企业团餐。 */
export type BeType = 1 | 2 | 5 | 6;

/** 订单类型 → MCP 的 orderType。1 到店（含得来速），2 外送（含团餐）。 */
export type OrderType = 1 | 2;

export const beTypeToOrderType = (beType: BeType): OrderType => (beType === 1 || beType === 5 ? 1 : 2);

export const BE_TYPE_LABEL: Record<BeType, string> = {
  1: '到店自取',
  2: '麦乐送',
  5: '得来速',
  6: '企业团餐',
};

/** 特制选项（去酱、去冰、加浓缩等）。key 必须来自 MCP 返回的 selectedKey/unselectedKey。 */
export interface ModValue {
  code: string;
  key: string;
  quantity?: number;
  /** 仅用于展示，从 MCP 的 modification 定义里带出来 */
  name?: string;
}

/** 套餐子项（如随心配的「蓝区」里选的汉堡）。 */
export interface PlanChild {
  /** 门店内的商品编码 */
  code: string;
  name: string;
  quantity: number;
  /** 所属轮次 id（MCP rounds[].id），单品为空 */
  round?: string;
  /** 所属轮次展示名（如「蓝区」） */
  roundName?: string;
  modification?: ModValue[];
  /** 历史名称别名，用于替换后仍能响应用户的旧称 */
  aliasNames?: string[];
}

/** 方案里的一项餐品。可能是一个单品，也可能是一个含子项的套餐。 */
export interface PlanItem {
  productCode: string;
  name: string;
  quantity: number;
  /** 菜单图 URL，来自 MCP 的 query-meals；历史订单没有图片 */
  image?: string;
  /** 菜单参考单价（分）。仅作展示参考，最终金额必须以 calculate-price 为准。 */
  unitPriceCents?: number;
  /** 套餐子项；单品为空数组 */
  children: PlanChild[];
  /** 是否套餐（children 非空或 MCP 返回 rounds） */
  isCombo: boolean;
  /**
   * 历史名称（别名）。商品被换码或替换后，用户仍可能用旧名（如「薯饼」）提出修改，
   * 匹配时必须同时认这些别名，否则会出现「用户说了但系统说找不到」。
   */
  aliasNames?: string[];
}

/** 常用方案 / 待确认订单的共用载体。 */
export interface Plan {
  id: string;
  name: string;
  storeCode: string;
  storeName: string;
  beType: BeType;
  items: PlanItem[];
  createdAt: string;
  updatedAt: string;
  /** 方案来源：历史订单 / 用户保存 / 演示数据 */
  source: 'history' | 'user' | 'demo';
  /** 若来自历史订单，记录原始订单号（仅本地展示，不参与 MCP 调用） */
  sourceOrderId?: string;
  sourceOrderTime?: string;
  /** 场景标签：上班早餐 / 日常午餐 / 周末套餐 / 加班夜宵 */
  tag?: string;
  note?: string;
}

/** 历史订单（MCP order-list 归一化后） */
export interface HistoryOrder {
  orderId: string;
  createTime: string;
  storeCode: string;
  storeName: string;
  beType: BeType;
  orderStatus: string;
  /** MCP 返回的实付金额是「元」的字符串，可能为 "0"（券/积分全额抵扣） */
  paidYuan: string | null;
  items: PlanItem[];
}

/** 用户习惯画像：从真实历史订单统计得出，绝不臆造。 */
export interface HabitProfile {
  /** 统计所用的历史订单数 */
  sampleSize: number;
  /** 最常点的门店 */
  topStore?: { storeCode: string; storeName: string; count: number };
  /** 最常出现的单品/套餐 */
  topItems: { productCode: string; name: string; count: number }[];
  /** 最常选的套餐子项 */
  topChildren: { code: string; name: string; count: number; parentName: string }[];
  /** 最常点单的时段 */
  topHour?: { hour: number; label: string; count: number };
  /** 最近一单 */
  latestOrder?: HistoryOrder;
  /** 一句话总结，用于首屏文案（由真实统计生成） */
  headline: string;
}

/** 意图变更类型 */
export type ChangeType = 'keep' | 'remove' | 'replace' | 'add' | 'budget' | 'preference';

export interface IntentChange {
  type: ChangeType;
  /** 用户原始说法片段 */
  raw: string;
  /** 被操作的目标（用户口中的餐品名，如「薯饼」） */
  target?: string;
  /** 替换目标（如「玉米杯」） */
  replacement?: string;
  /** 预算金额（分），仅 type=budget */
  amountCents?: number;
  /** 偏好词（无糖/去冰/少酱），仅 type=preference */
  preference?: string;
}

export interface ParsedIntent {
  raw: string;
  /** 是否表达了「照旧 / 老样子」 */
  wantsRepeat: boolean;
  budgetCents?: number;
  changes: IntentChange[];
  preferences: string[];
  /** 解析器识别不了但可能是关键约束的片段，需要向用户澄清 */
  unrecognized: string[];
}

/** 餐品身份匹配状态 */
export type MatchStatus =
  | 'exact' // 编码仍在售
  | 'renamed' // 编码变了但同名商品在售（MCP 换码）
  | 'unavailable' // 已下架
  | 'substituted' // 已按同轮次替代
  | 'unmatched'; // 无法匹配，需用户确认

export interface MatchedChild {
  original: PlanChild;
  status: MatchStatus;
  current?: PlanChild;
  alternatives: { code: string; name: string; diffPrice?: string }[];
  reason: string;
}

export interface MatchedItem {
  original: PlanItem;
  status: MatchStatus;
  current?: PlanItem;
  children: MatchedChild[];
  /** 该餐品被替换/下架的说明，用于 UI 差异展示 */
  notes: string[];
}

/** MCP calculate-price 归一化结果 */
export interface PriceBreakdown {
  /** 实付（分） */
  priceCents: number;
  /** 原价（分） */
  originalPriceCents: number;
  /** 优惠（分） */
  discountCents: number;
  lines: {
    productCode: string;
    productName: string;
    quantity: number;
    subtotalCents: number;
    originalSubtotalCents: number;
  }[];
  takeWayList: { code: string; title: string; subtitle: string }[];
  /** MCP traceId，用于在界面上说明数据来自哪一次真实调用 */
  traceId?: string;
  fetchedAt: string;
  source: DataSource;
}

/** 变更动作（用于 UI 的「改了什么」） */
export interface AppliedChange {
  type: 'kept' | 'removed' | 'replaced' | 'added' | 'substituted' | 'unavailable' | 'preference';
  target: string;
  detail: string;
  before?: string;
  after?: string;
}

/** 候选方案 */
export interface CandidatePlan {
  id: string;
  label: string;
  /** 生成策略，用于解释「为什么给你这几个」 */
  strategy: 'minimal' | 'budget-fit' | 'swap-fit';
  items: PlanItem[];
  changes: AppliedChange[];
  price?: PriceBreakdown;
  /** null 表示未设置预算 */
  withinBudget: boolean | null;
  /** 可解释的说明行 */
  explain: string[];
  /** 是否达到了用户预算；若所有候选都超预算，UI 必须明确提示 */
  budgetNote?: string;
  /** 官方核价一致性校验的告警（有值就必须在界面上展示） */
  priceChecks?: string[];
}

/** 门店 */
export interface Store {
  storeCode: string;
  storeName: string;
  address: string;
  distance?: number;
  beCode?: string;
  businessStatus?: boolean;
  businessStartTime?: string;
  businessEndTime?: string;
  reservationTimeOptions?: { date: string; today: boolean; reservationOptionText: string }[];
}

/** 菜单商品 */
export interface MenuProduct {
  code: string;
  name: string;
  priceCents: number;
  originalPriceCents: number;
  image?: string;
  tags: string[];
  categories: string[];
}

/** 套餐详情 */
export interface ComboDetail {
  code: string;
  name: string;
  image?: string;
  supportModify: boolean;
  rounds: {
    id: number;
    name: string;
    quantity: number;
    minQuantity: number;
    maxQuantity: number;
    choices: {
      code: string;
      name: string;
      isDefault: boolean;
      diffPrice: string;
      diffPriceCents: number;
      supportModify: boolean;
      modification?: ModValue[];
    }[];
  }[];
}

/** 优惠券 */
export interface Coupon {
  id: string;
  code: string;
  title: string;
  subtitle?: string;
  image?: string;
}

/** 统一 API 响应信封，前端据此判断数据来源与错误。 */
export interface ApiOk<T> {
  ok: true;
  data: T;
  source: DataSource;
  /** 真实 MCP traceId（若有） */
  traceId?: string;
  /** 真实调用的工具名，便于在界面上标注数据出处 */
  tool?: string;
  fetchedAt: string;
}

export interface ApiErr {
  ok: false;
  error: {
    code: string;
    message: string;
    /** 可执行的下一步建议 */
    hint?: string;
  };
  fetchedAt: string;
}

export type ApiEnvelope<T> = ApiOk<T> | ApiErr;
