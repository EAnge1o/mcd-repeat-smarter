/**
 * 自然语言增量修改解析器。
 *
 * 这是一个「确定性规则引擎」，不是大模型调用：
 * - 价格和业务规则绝不由模型生成，只由 MCP 与这里的确定性逻辑负责。
 * - 解析不出来的内容进入 unrecognized，由界面向用户澄清，绝不默默猜测。
 *
 * 支持的表达（示例见 tests/intent.test.ts）：
 *   "还是上次那份早餐"
 *   "还是老样子，不过今天不要薯饼，换个东西，预算不超过 25 元"
 *   "汉堡不变，饮料换无糖的，今天别超过 25 块"
 *   "把薯条换成玉米杯"
 *   "加一个麦乐鸡"
 */

import type { IntentChange, ParsedIntent } from './types.js';

const CN_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};

/** 中文数字 → 阿拉伯数字，支持「二十五」「十五」「三十」这类两位数。 */
export function cnToNumber(text: string): number | undefined {
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number.parseFloat(text);

  const chars = [...text];
  if (!chars.every((c) => c in CN_DIGITS || c === '十')) return undefined;
  if (!chars.includes('十')) {
    // 纯个位，如「五」
    if (chars.length === 1 && chars[0] in CN_DIGITS) return CN_DIGITS[chars[0]];
    return undefined;
  }

  const idx = chars.indexOf('十');
  const head = chars.slice(0, idx);
  const tail = chars.slice(idx + 1);

  let tens = 1;
  if (head.length === 1 && head[0] in CN_DIGITS) {
    tens = CN_DIGITS[head[0]];
  } else if (head.length > 1) {
    return undefined;
  }

  let ones = 0;
  if (tail.length === 1 && tail[0] in CN_DIGITS) {
    ones = CN_DIGITS[tail[0]];
  } else if (tail.length > 1) {
    return undefined;
  }

  return tens * 10 + ones;
}

/** 归一化：全角标点转半角、压缩空白，便于正则稳定匹配。 */
export function normalizeText(input: string): string {
  return input
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/\u3000/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BUDGET_PATTERN =
  /(?:不超过|不超出|别超过|不能超过|最多|预算(?:是|为)?|上限(?:是|为)?|控制在|不超过人民币)\s*(\d+(?:\.\d+)?|[一二两三四五六七八九十]+)\s*(?:元|块|元钱|块钱)?/g;

const BUDGET_SUFFIX_PATTERN =
  /(\d+(?:\.\d+)?|[一二两三四五六七八九十]+)\s*(?:元|块|块钱)\s*(?:以内|之内|以下|封顶)/g;

const REPEAT_PATTERN = /(还是|照旧|照常|老样子|老规矩|一样的|跟上次一样|再来一份|重复上次)/;

const REMOVE_PATTERN =
  /(?:不要|不想要|去掉|去一下|别要|别加|别放|不带|不吃|拿掉|删掉|取消|去除)\s*([^\s,，。;；、]+)/g;

const REPLACE_PATTERN =
  /(?:把)?\s*([^\s,，。;；、]{1,12}?)\s*(?:换成|换为|改换成|改成|改为|换)\s*([^\s,，。;；、]{1,12})/g;

const ADD_PATTERN =
  /(?<![不别没])(?:再加|再来|加|来|添|补)\s*(?:一个|一份|一份儿|个|份|杯|块)?\s*([^\s,，。;；、]{1,12})/g;

const PREFERENCE_PATTERN = /(无糖|零度|零糖|去冰|少冰|常温|去酱|少酱|不加酱|去盐|不加盐|去皮)/g;

/** 「饮料换无糖的」这类：换的目标是属性词而不是具体商品。 */
const ATTRIBUTE_WORDS = ['无糖', '零度', '零糖', '去冰', '少冰', '常温', '去酱', '少酱', '不加酱'];

const INTENT_HINTS = ['换', '改', '不要', '去掉', '加', '预算', '不超过'];

/** 「换个东西」「换别的」这类没有具体目标，属于开放替换，不能当成商品名。 */
const VAGUE_REPLACEMENTS = ['东西', '别的', '其他', '其它', '什么', '样', '口味', '款式', '一个'];

function cleanTarget(text: string): string {
  return text
    .replace(/^(那个|这个|一份|一个|一份儿|今天|然后|再)+/g, '')
    .replace(/(吧|啊|呢|哦|了|的|就行|就可以|谢谢)$/g, '')
    .trim();
}

export function parseIntent(rawInput: string): ParsedIntent {
  const raw = normalizeText(rawInput);
  const changes: IntentChange[] = [];
  const preferences: string[] = [];
  const unrecognized: string[] = [];

  // 1) 预算（两种语序都支持：不超过 25 元 / 25 元以内）
  let budgetCents: number | undefined;
  for (const re of [BUDGET_PATTERN, BUDGET_SUFFIX_PATTERN]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const n = cnToNumber(m[1]);
      if (n !== undefined && n > 0) {
        budgetCents = Math.round(n * 100);
        changes.push({ type: 'budget', raw: m[0], amountCents: budgetCents });
      }
    }
  }

  // 2) 是否表达「照旧」
  const wantsRepeat = REPEAT_PATTERN.test(raw);

  // 3) 替换（必须先于删除，否则「薯饼换成玉米杯」会被误判为删除）
  const replacedRaw: string[] = [];
  REPLACE_PATTERN.lastIndex = 0;
  let rm: RegExpExecArray | null;
  while ((rm = REPLACE_PATTERN.exec(raw)) !== null) {
    const target = cleanTarget(rm[1]);
    const replacement = cleanTarget(rm[2]).replace(/^(一个|一份|个|份|杯)/, '');
    if (!target || !replacement || target === replacement) continue;
    replacedRaw.push(rm[0]);

    const isVague = VAGUE_REPLACEMENTS.some((w) => replacement === w || replacement.endsWith(w));
    const isAttribute = ATTRIBUTE_WORDS.some((w) => replacement.includes(w));
    changes.push({ type: 'replace', raw: rm[0], target, replacement: isVague ? undefined : replacement });
    if (isAttribute) {
      const pref = ATTRIBUTE_WORDS.find((w) => replacement.includes(w));
      if (pref && !preferences.includes(pref)) preferences.push(pref);
    }
  }

  // 4) 删除 / 开放式替换
  REMOVE_PATTERN.lastIndex = 0;
  let dm: RegExpExecArray | null;
  while ((dm = REMOVE_PATTERN.exec(raw)) !== null) {
    const target = cleanTarget(dm[1]);
    if (!target) continue;
    // 已被替换规则覆盖的片段跳过
    if (replacedRaw.some((r) => r.includes(target))) continue;

    // 「不要薯饼，换个东西」→ 升级为开放式替换，需要系统给替代品
    const after = raw.slice(dm.index + dm[0].length, dm.index + dm[0].length + 12);
    const wantsSwap = /(换个|换一个|换掉|替换|替代)/.test(after);
    changes.push({ type: wantsSwap ? 'replace' : 'remove', raw: dm[0], target });
  }

  // 5) 新增
  ADD_PATTERN.lastIndex = 0;
  let am: RegExpExecArray | null;
  while ((am = ADD_PATTERN.exec(raw)) !== null) {
    const target = cleanTarget(am[1]);
    if (!target || target.length < 1) continue;
    // 跳过「加不加」「加热」这类非点餐语义
    if (/^(不加|加热|加速|油)$/.test(target)) continue;
    // 已有同目标的其他变更时不要重复
    if (changes.some((c) => c.target === target)) continue;
    changes.push({ type: 'add', raw: am[0], target });
  }

  // 6) 偏好
  PREFERENCE_PATTERN.lastIndex = 0;
  let pm: RegExpExecArray | null;
  while ((pm = PREFERENCE_PATTERN.exec(raw)) !== null) {
    if (!preferences.includes(pm[1])) preferences.push(pm[1]);
    changes.push({ type: 'preference', raw: pm[1], preference: pm[1] });
  }

  // 7) 保留下来的内容（用户明确说"不变"的部分）
  if (wantsRepeat) {
    changes.unshift({ type: 'keep', raw: raw.match(REPEAT_PATTERN)?.[0] ?? '老样子' });
  }

  // 8) 有修改意图但没解析出目标 → 交给界面澄清
  const hasChangeIntent = INTENT_HINTS.some((h) => raw.includes(h));
  const hasConcreteChange = changes.some((c) => c.target || c.type === 'budget');
  if (hasChangeIntent && !hasConcreteChange && raw.length > 0) {
    unrecognized.push(raw);
  }

  return {
    raw,
    wantsRepeat,
    budgetCents,
    changes,
    preferences,
    unrecognized,
  };
}
