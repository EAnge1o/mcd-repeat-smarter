import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PlanStore } from '../server/store/planStore';
import type { PlanItem } from '../server/domain/types';

const items: PlanItem[] = [
  { productCode: '1440', name: '麦辣鸡腿汉堡', quantity: 1, children: [], isCombo: false },
];

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'mcd-plans-'));
  process.env.DATA_DIR = dir;
});

afterEach(async () => {
  delete process.env.DATA_DIR;
  await rm(dir, { recursive: true, force: true });
});

describe('常用方案持久化', () => {
  it('创建后能读回', async () => {
    const store = new PlanStore();
    const created = await store.create({
      name: '上班早餐',
      storeCode: '1000001',
      storeName: '测试门店',
      beType: 1,
      items,
      tag: '上班早餐',
    });

    const list = await store.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('上班早餐');
    expect(list[0].items[0].productCode).toBe('1440');
    expect(created.id).toBe(list[0].id);
  });

  it('真正落盘：新建 store 实例仍能读到（模拟重启）', async () => {
    const first = new PlanStore();
    await first.create({ name: '日常午餐', storeCode: '1', storeName: 'S', beType: 1, items });

    const raw = await readFile(path.join(dir, 'plans.json'), 'utf-8');
    expect(raw).toContain('日常午餐');

    const second = new PlanStore();
    const list = await second.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('日常午餐');
  });

  it('更新方案内容', async () => {
    const store = new PlanStore();
    const p = await store.create({ name: '旧的', storeCode: '1', storeName: 'S', beType: 1, items });
    const updated = await store.update(p.id, {
      name: '新的',
      items: [{ productCode: '1401', name: '麦乐鸡5块', quantity: 2, children: [], isCombo: false }],
    });
    expect(updated?.name).toBe('新的');
    expect(updated?.items[0].quantity).toBe(2);
    expect(updated!.updatedAt >= p.createdAt).toBe(true);
  });

  it('复制方案会生成新 id', async () => {
    const store = new PlanStore();
    const p = await store.create({ name: '原始', storeCode: '1', storeName: 'S', beType: 1, items });
    const copy = await store.duplicate(p.id);
    expect(copy?.id).not.toBe(p.id);
    expect(copy?.name).toContain('副本');
    expect(await store.list()).toHaveLength(2);
  });

  it('删除方案', async () => {
    const store = new PlanStore();
    const p = await store.create({ name: '待删', storeCode: '1', storeName: 'S', beType: 1, items });
    expect(await store.remove(p.id)).toBe(true);
    expect(await store.list()).toHaveLength(0);
    expect(await store.remove(p.id)).toBe(false);
  });

  it('并发写入不会互相覆盖', async () => {
    const store = new PlanStore();
    await Promise.all(
      Array.from({ length: 8 }).map((_, i) =>
        store.create({ name: `方案${i}`, storeCode: '1', storeName: 'S', beType: 1, items }),
      ),
    );
    expect(await store.list()).toHaveLength(8);
  });

  it('文件损坏时不抛错，返回空列表', async () => {
    const { writeFile, mkdir } = await import('node:fs/promises');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'plans.json'), '{ 坏掉的 json', 'utf-8');
    const store = new PlanStore();
    expect(await store.list()).toEqual([]);
  });
});
