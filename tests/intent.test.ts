import { describe, expect, it } from 'vitest';
import { cnToNumber, normalizeText, parseIntent } from '../server/domain/intent';

describe('文本归一化与数字解析', () => {
  it('把全角标点转成半角', () => {
    expect(normalizeText('还是老样子，不要薯饼')).toBe('还是老样子,不要薯饼');
  });

  it('解析中文数字', () => {
    expect(cnToNumber('二十五')).toBe(25);
    expect(cnToNumber('十五')).toBe(15);
    expect(cnToNumber('三十')).toBe(30);
    expect(cnToNumber('5')).toBe(5);
    expect(cnToNumber('12.5')).toBe(12.5);
    expect(cnToNumber('随便')).toBeUndefined();
  });
});

describe('场景 1：重复上次的点单', () => {
  it('识别「还是上次那份早餐」', () => {
    const r = parseIntent('还是上次那份早餐');
    expect(r.wantsRepeat).toBe(true);
    expect(r.changes.some((c) => c.type === 'keep')).toBe(true);
  });

  it('识别「照旧」「老规矩」', () => {
    expect(parseIntent('照旧').wantsRepeat).toBe(true);
    expect(parseIntent('老规矩来一份').wantsRepeat).toBe(true);
  });
});

describe('场景 2：保留原方案只做少量修改', () => {
  it('解析「不要 X，换个东西，预算不超过 25 元」', () => {
    const r = parseIntent('还是上次那份，不过今天不要薯饼，换个东西，预算不超过 25 元');
    expect(r.wantsRepeat).toBe(true);
    expect(r.budgetCents).toBe(2500);

    const change = r.changes.find((c) => c.target === '薯饼');
    expect(change).toBeDefined();
    // 「不要薯饼，换个东西」应升级为开放式替换，而不是简单删除
    expect(change?.type).toBe('replace');
    expect(change?.replacement).toBeUndefined();
  });

  it('解析「饮料换无糖的」并记住偏好', () => {
    const r = parseIntent('汉堡不变，饮料换无糖的，今天别超过 25 块');
    expect(r.budgetCents).toBe(2500);

    const change = r.changes.find((c) => c.target === '饮料');
    expect(change?.type).toBe('replace');
    expect(change?.replacement).toBe('无糖');
    expect(r.preferences).toContain('无糖');
  });

  it('解析明确的替换目标', () => {
    const r = parseIntent('把薯条换成玉米杯');
    const change = r.changes.find((c) => c.target === '薯条');
    expect(change?.type).toBe('replace');
    expect(change?.replacement).toBe('玉米杯');
  });

  it('解析新增商品', () => {
    const r = parseIntent('加一个麦乐鸡');
    expect(r.changes.some((c) => c.type === 'add' && c.target === '麦乐鸡')).toBe(true);
  });

  it('「不加酱」属于偏好，不能被当成新增商品', () => {
    const r = parseIntent('不加酱');
    expect(r.changes.some((c) => c.type === 'add')).toBe(false);
    expect(r.preferences).toContain('不加酱');
  });

  it('支持「25 元以内」这种语序', () => {
    expect(parseIntent('25 元以内').budgetCents).toBe(2500);
  });

  it('中文数字预算', () => {
    expect(parseIntent('预算二十五块').budgetCents).toBe(2500);
  });
});

describe('不猜测：无法解析时交给上层澄清', () => {
  it('有修改意图但没解析出具体目标时记录到 unrecognized', () => {
    const r = parseIntent('帮我改一下');
    expect(r.unrecognized.length).toBeGreaterThan(0);
  });

  it('普通陈述不产生虚假变更', () => {
    const r = parseIntent('今天有点饿');
    expect(r.changes).toHaveLength(0);
    expect(r.unrecognized).toHaveLength(0);
  });
});
