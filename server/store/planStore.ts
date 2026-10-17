/**
 * 常用方案持久化。
 *
 * 选择 JSON 文件而不是数据库的原因：
 * - 真实需求是「单用户本地的几十条方案」，引入数据库反而增加运行门槛。
 * - 采用「临时文件 + rename」的原子写，避免进程中断把文件写坏。
 * - 所有写操作串行化，避免并发请求互相覆盖。
 *
 * 数据目录通过 DATA_DIR 配置，默认 ./data，已在 .gitignore 中排除。
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Plan } from '../domain/types.js';

/** 每次调用时读取环境变量，便于测试用独立目录隔离。 */
function paths() {
  const dir = process.env.DATA_DIR || path.resolve(process.cwd(), 'data');
  return { dir, file: path.join(dir, 'plans.json') };
}

interface PlansFile {
  version: 1;
  plans: Plan[];
}

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDir(): Promise<void> {
  const { dir } = paths();
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function readAll(): Promise<Plan[]> {
  await ensureDir();
  const { file } = paths();
  if (!existsSync(file)) return [];
  try {
    const raw = await readFile(file, 'utf-8');
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw) as PlansFile | Plan[];
    // 兼容早期直接存数组的格式
    if (Array.isArray(parsed)) return parsed;
    return Array.isArray(parsed.plans) ? parsed.plans : [];
  } catch {
    // 文件损坏时不抛错，避免整个服务不可用；由上层提示用户
    return [];
  }
}

async function writeAll(plans: Plan[]): Promise<void> {
  await ensureDir();
  const payload: PlansFile = { version: 1, plans };
  const { file } = paths();
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf-8');
  await rename(tmp, file);
}

/** 串行化所有写操作 */
function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = writeQueue.then(task, task);
  writeQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export interface CreatePlanInput {
  name: string;
  storeCode: string;
  storeName: string;
  beType: Plan['beType'];
  items: Plan['items'];
  source?: Plan['source'];
  sourceOrderId?: string;
  sourceOrderTime?: string;
  tag?: string;
  note?: string;
}

export class PlanStore {
  async list(): Promise<Plan[]> {
    const plans = await readAll();
    return plans.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Plan | undefined> {
    const plans = await readAll();
    return plans.find((p) => p.id === id);
  }

  async create(input: CreatePlanInput): Promise<Plan> {
    const now = new Date().toISOString();
    const plan: Plan = {
      id: randomUUID(),
      name: input.name.trim() || '未命名方案',
      storeCode: input.storeCode,
      storeName: input.storeName,
      beType: input.beType,
      items: input.items,
      createdAt: now,
      updatedAt: now,
      source: input.source ?? 'user',
      sourceOrderId: input.sourceOrderId,
      sourceOrderTime: input.sourceOrderTime,
      tag: input.tag,
      note: input.note,
    };

    await enqueue(async () => {
      const plans = await readAll();
      plans.push(plan);
      await writeAll(plans);
    });

    return plan;
  }

  async update(id: string, patch: Partial<Pick<Plan, 'name' | 'items' | 'tag' | 'note'>>): Promise<Plan | undefined> {
    return enqueue(async () => {
      const plans = await readAll();
      const idx = plans.findIndex((p) => p.id === id);
      if (idx === -1) return undefined;
      const next: Plan = {
        ...plans[idx],
        ...patch,
        id: plans[idx].id,
        updatedAt: new Date().toISOString(),
      };
      plans[idx] = next;
      await writeAll(plans);
      return next;
    });
  }

  async duplicate(id: string): Promise<Plan | undefined> {
    return enqueue(async () => {
      const plans = await readAll();
      const src = plans.find((p) => p.id === id);
      if (!src) return undefined;
      const now = new Date().toISOString();
      const copy: Plan = {
        ...src,
        id: randomUUID(),
        name: `${src.name} 副本`,
        createdAt: now,
        updatedAt: now,
      };
      plans.push(copy);
      await writeAll(plans);
      return copy;
    });
  }

  async remove(id: string): Promise<boolean> {
    return enqueue(async () => {
      const plans = await readAll();
      const next = plans.filter((p) => p.id !== id);
      if (next.length === plans.length) return false;
      await writeAll(next);
      return true;
    });
  }
}

export const planStore = new PlanStore();
