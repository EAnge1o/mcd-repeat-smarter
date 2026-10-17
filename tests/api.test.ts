import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../server/app';
import { DemoService } from '../server/mcp/demoService';

/**
 * 集成测试：用演示网关启动一个真实的 HTTP 服务，验证接口行为。
 * 关键覆盖点：在没有明确确认之前，绝不产生有副作用的操作。
 */

let server: Server;
let base: string;
let dataDir: string;

beforeAll(async () => {
  dataDir = await mkdtemp(path.join(tmpdir(), 'mcd-api-'));
  process.env.DATA_DIR = dataDir;

  const app = createApp(new DemoService());
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.DATA_DIR;
  await rm(dataDir, { recursive: true, force: true });
});

const postJson = (pathName: string, body: unknown) =>
  fetch(base + pathName, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const demoItems = [
  {
    productCode: '9900000001',
    name: '经典牛肉堡三件套',
    quantity: 1,
    isCombo: true,
    children: [
      { code: '1001', name: '经典牛肉堡', quantity: 1, round: '1', roundName: '主餐' },
      { code: '1004', name: '中薯条', quantity: 1, round: '2', roundName: '配餐' },
      { code: '1008', name: '可乐中杯', quantity: 1, round: '3', roundName: '饮料' },
    ],
  },
];

describe('健康检查与数据来源', () => {
  it('演示模式下明确告知是 demo', async () => {
    const res = await fetch(base + '/api/health');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.mode).toBe('demo');
  });

  it('历史订单可读', async () => {
    const res = await fetch(base + '/api/history');
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.orders.length).toBeGreaterThan(0);
    expect(body.source).toBe('demo');
  });
});

describe('增量调整闭环', () => {
  it('能基于最近一单生成候选并核价', async () => {
    const res = await postJson('/api/adjust', { message: '还是老样子，预算不超过 40 元' });
    const body = await res.json();

    expect(body.ok).toBe(true);
    expect(body.data.intent.budgetCents).toBe(4000);
    expect(body.data.candidates.length).toBeGreaterThan(0);

    const first = body.data.candidates[0];
    expect(first.price).toBeDefined();
    expect(first.price.source).toBe('demo');
    expect(first.price.priceCents).toBeGreaterThan(0);
    expect(first.withinBudget).toBe(true);
  });

  it('不存在的方案返回 404', async () => {
    const res = await postJson('/api/adjust', { message: '还是老样子', basePlanId: 'not-exist' });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('PLAN_NOT_FOUND');
  });

  it('空指令被拒绝', async () => {
    const res = await postJson('/api/adjust', { message: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('下单安全闸门', () => {
  it('未确认时必须拒绝（428）', async () => {
    const previewRes = await postJson('/api/order/preview', {
      storeCode: '1000001',
      beType: 1,
      items: demoItems,
    });
    const preview = await previewRes.json();
    expect(preview.ok).toBe(true);

    const res = await postJson('/api/order/confirm', {
      token: preview.data.token,
      takeWayCode: 'eat-in',
      // 故意不带 confirmed
    });
    expect(res.status).toBe(428);
    const body = await res.json();
    expect(body.error.code).toBe('CONFIRM_REQUIRED');
  });

  it('confirmed=false 同样被拒绝', async () => {
    const previewRes = await postJson('/api/order/preview', { storeCode: '1000001', beType: 1, items: demoItems });
    const preview = await previewRes.json();

    const res = await postJson('/api/order/confirm', {
      token: preview.data.token,
      takeWayCode: 'eat-in',
      confirmed: false,
    });
    expect(res.status).toBe(428);
  });

  it('伪造令牌被拒绝（410）', async () => {
    const res = await postJson('/api/order/confirm', { token: 'fake', takeWayCode: 'eat-in', confirmed: true });
    expect(res.status).toBe(410);
  });

  it('非法取餐方式被拒绝（400）', async () => {
    const previewRes = await postJson('/api/order/preview', { storeCode: '1000001', beType: 1, items: demoItems });
    const preview = await previewRes.json();

    const res = await postJson('/api/order/confirm', {
      token: preview.data.token,
      takeWayCode: 'teleport',
      confirmed: true,
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('INVALID_TAKEWAY');
  });

  it('令牌一次性：确认成功后不能重复使用', async () => {
    const previewRes = await postJson('/api/order/preview', { storeCode: '1000001', beType: 1, items: demoItems });
    const preview = await previewRes.json();

    const first = await postJson('/api/order/confirm', {
      token: preview.data.token,
      takeWayCode: 'eat-in',
      confirmed: true,
    });
    expect(first.status).toBe(200);

    const second = await postJson('/api/order/confirm', {
      token: preview.data.token,
      takeWayCode: 'eat-in',
      confirmed: true,
    });
    expect(second.status).toBe(410);
  });
});

describe('常用方案接口', () => {
  it('创建后可读取', async () => {
    const createRes = await postJson('/api/plans', {
      name: '集成测试方案',
      storeCode: '1000001',
      storeName: '测试门店',
      beType: 1,
      items: demoItems,
    });
    const created = await createRes.json();
    expect(created.ok).toBe(true);

    const listRes = await fetch(base + '/api/plans');
    const list = await listRes.json();
    expect(list.data.plans.some((p: { name: string }) => p.name === '集成测试方案')).toBe(true);
  });

  it('空方案被拒绝', async () => {
    const res = await postJson('/api/plans', { name: 'x', items: [] });
    expect(res.status).toBe(400);
  });
});

/**
 * 副作用闸门测试：用一个会计数的网关包住 DemoService，
 * 断言「用户没有明确确认」时 createOrder 一次都不会被调用。
 * 光看 HTTP 状态码还不够 —— 必须证明副作用函数本身没被执行。
 */
describe('未确认时绝不触发下单副作用', () => {
  let spyServer: Server;
  let spyBase: string;
  const calls = { createOrder: 0, calcPrice: 0 };

  beforeAll(async () => {
    const inner = new DemoService();
    const spied = {
      mode: inner.mode,
      findStores: inner.findStores.bind(inner),
      getMenu: inner.getMenu.bind(inner),
      getComboDetail: inner.getComboDetail.bind(inner),
      getHistory: inner.getHistory.bind(inner),
      getMyCoupons: inner.getMyCoupons.bind(inner),
      calcPrice: (...args: Parameters<typeof inner.calcPrice>) => {
        calls.calcPrice += 1;
        return inner.calcPrice(...args);
      },
      createOrder: (...args: Parameters<typeof inner.createOrder>) => {
        calls.createOrder += 1;
        return inner.createOrder(...args);
      },
    };

    const app = createApp(spied);
    await new Promise<void>((resolve) => {
      spyServer = app.listen(0, '127.0.0.1', () => resolve());
    });
    spyBase = `http://127.0.0.1:${(spyServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => spyServer.close(() => resolve()));
  });

  const post = (pathName: string, body: unknown) =>
    fetch(spyBase + pathName, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('预览阶段只核价、不下单', async () => {
    calls.createOrder = 0;
    const res = await post('/api/order/preview', { storeCode: '1000001', beType: 1, items: demoItems });
    expect(res.status).toBe(200);
    expect(calls.calcPrice).toBeGreaterThan(0);
    expect(calls.createOrder).toBe(0);
  });

  it('未确认 / confirmed=false / 伪造令牌，均未触发 createOrder', async () => {
    calls.createOrder = 0;

    const preview = await (
      await post('/api/order/preview', { storeCode: '1000001', beType: 1, items: demoItems })
    ).json();

    const noFlag = await post('/api/order/confirm', { token: preview.data.token, takeWayCode: 'eat-in' });
    expect(noFlag.status).toBe(428);

    const falseFlag = await post('/api/order/confirm', {
      token: preview.data.token,
      takeWayCode: 'eat-in',
      confirmed: false,
    });
    expect(falseFlag.status).toBe(428);

    const fakeToken = await post('/api/order/confirm', {
      token: 'not-a-real-token',
      takeWayCode: 'eat-in',
      confirmed: true,
    });
    expect(fakeToken.status).toBe(410);

    expect(calls.createOrder).toBe(0);
  });

  it('显式确认后才恰好调用一次 createOrder', async () => {
    calls.createOrder = 0;
    const preview = await (
      await post('/api/order/preview', { storeCode: '1000001', beType: 1, items: demoItems })
    ).json();

    const res = await post('/api/order/confirm', {
      token: preview.data.token,
      takeWayCode: 'eat-in',
      confirmed: true,
    });
    expect(res.status).toBe(200);
    expect(calls.createOrder).toBe(1);
  });
});
