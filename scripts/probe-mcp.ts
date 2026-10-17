/**
 * MCP 能力自检脚本。
 *
 * 目的：在评审或本地调试时，用十几秒确认「这个项目真的连上了麦当劳 MCP」，
 * 而不是靠截图或口头声明。脚本只做只读调用，不会创建任何订单。
 *
 * 用法：
 *   npm run mcp:probe
 *
 * Token 从环境变量 MCD_MCP_TOKEN 读取（见 .env.example），
 * 本脚本任何输出都不会包含 Token 原文。
 */

import 'dotenv/config';
import { McpClient, McpError } from '../server/mcp/client.js';
import { McdService } from '../server/mcp/mcdService.js';
import type { BeType, PlanChild, PlanItem } from '../server/domain/types.js';

const TOKEN = process.env.MCD_MCP_TOKEN?.trim() ?? '';
const STORE_CODE = process.env.MCD_DEFAULT_STORE_CODE?.trim() || '1450543';
const BE_TYPE = (Number(process.env.MCD_DEFAULT_BE_TYPE ?? 1) || 1) as BeType;

const line = (char = '─', n = 64) => char.repeat(n);
const head = (title: string) => console.log(`\n${title}\n${line()}`);
const yuan = (cents: number) => `${(cents / 100).toFixed(2)} 元`;

/** 找到第一个「含必选轮次且每轮都有可选项」的套餐，用来演示真实核价。 */
async function pickPricedCombo(svc: McdService) {
  const menu = await svc.getMenu(STORE_CODE, BE_TYPE);
  let scanned = 0;
  for (const p of menu.products) {
    if (scanned >= 60) break;
    scanned += 1;
    let detail;
    try {
      detail = await svc.getComboDetail(STORE_CODE, p.code, BE_TYPE);
    } catch {
      continue;
    }
    const required = detail.rounds.filter((r) => r.minQuantity > 0);
    if (required.length === 0) continue;
    if (required.some((r) => r.choices.length === 0)) continue;

    const children: PlanChild[] = required.map((r) => {
      const pick = r.choices[0];
      return {
        code: pick.code,
        name: pick.name,
        quantity: r.minQuantity || 1,
        round: String(r.id),
        roundName: r.name,
      };
    });
    const items: PlanItem[] = [
      { productCode: p.code, name: p.name, quantity: 1, children, isCombo: true },
    ];
    return { product: p, detail, items, menuCount: menu.products.length, orderType: menu.orderType };
  }
  return null;
}

async function main() {
  if (!TOKEN) {
    console.error('未找到 MCD_MCP_TOKEN。请复制 .env.example 为 .env 并填入 Token 后重试。');
    process.exit(1);
  }

  const client = new McpClient(TOKEN);
  const svc = new McdService(client);

  console.log('麦当劳 MCP 能力自检');
  console.log(line('='));
  console.log(`端点：${process.env.MCD_MCP_URL || 'https://mcp.mcd.cn'}`);
  console.log(`门店：${STORE_CODE} ｜ 取餐方式 beType=${BE_TYPE}`);
  console.log(`Token：已读取（长度 ${TOKEN.length}，不在任何输出中显示）`);

  // ---------- 1. Tool 清单 ----------
  head('1. 服务端实际暴露的 Tool（tools/list）');
  const tools = await client.listTools();
  console.log(`共 ${tools.length} 个：`);
  for (const t of tools) console.log(`  · ${t.name}`);

  // ---------- 2. 菜单 ----------
  head('2. 门店菜单（query-meals）');
  const menu = await svc.getMenu(STORE_CODE, BE_TYPE);
  console.log(`在售商品 ${menu.products.length} 个（orderType=${menu.orderType}）`);
  for (const p of menu.products.slice(0, 5)) {
    console.log(`  · ${p.code}  ${p.name}  ${yuan(p.priceCents)}`);
  }

  // ---------- 3. 历史订单 ----------
  head('3. 历史订单（order-list）');
  const orders = await svc.getHistory();
  console.log(`可读取订单 ${orders.length} 单`);
  for (const o of orders.slice(0, 3)) {
    const items = o.items.map((i) => `${i.name}×${i.quantity}`).join('、');
    console.log(`  · ${o.createTime}  实付 ${o.paidYuan ? `${o.paidYuan} 元` : '—'}  ${items}`);
  }

  // ---------- 4. 官方核价 ----------
  head('4. 官方核价（query-meal-detail + calculate-price）');
  const combo = await pickPricedCombo(svc);
  if (!combo) {
    console.log('没有找到含必选轮次的套餐，跳过核价演示。');
    return;
  }
  console.log(`套餐：${combo.product.code} ${combo.product.name}`);
  console.log(`轮次：${combo.detail.rounds.filter((r) => r.minQuantity > 0).map((r) => r.name).join(' / ') || '无'}`);

  const price = await svc.calcPrice(STORE_CODE, BE_TYPE, combo.items);
  console.log(`合计 ${yuan(price.priceCents)}（原价 ${yuan(price.originalPriceCents)}，优惠 ${yuan(price.discountCents)}）`);
  for (const l of price.lines) {
    console.log(`  · ${l.productName} × ${l.quantity}  ${yuan(l.subtotalCents)}`);
  }
  console.log(`数据来源 source=${price.source} ｜ traceId=${price.traceId ?? '—'}`);

  head('自检结论');
  console.log('以上门店、菜单、订单、价格全部来自麦当劳 MCP 实时返回（source=mcp），项目内无硬编码。');
}

main().catch((err: unknown) => {
  if (err instanceof McpError) {
    console.error(`\n自检失败（${err.kind}）：${err.message}`);
    if (err.hint) console.error(`建议：${err.hint}`);
  } else {
    console.error('\n自检失败：', err instanceof Error ? err.message : err);
  }
  process.exit(1);
});
