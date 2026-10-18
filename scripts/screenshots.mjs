/**
 * 截图脚本 —— 用真实浏览器跑一遍主流程并截图，供 README / 参赛材料使用。
 *
 * 说明：
 * 1. 需要先启动应用（npm run dev 或 npm run build && npm start）。
 * 2. 使用本机已安装的 Chrome / Edge，不下载浏览器（puppeteer-core）。
 * 3. 只截图，不提交订单 —— 最后一步停在「已勾选、按钮已激活」的状态。
 * 4. 默认门店如果当时不在营业时间，MCP 会返回「门店可能已关闭或不在营业时间」，
 *    这时用 --keyword 先切到一家营业中的门店再拍。
 *
 * 用法：
 *   npm run build && node scripts/screenshots.mjs   # 拍的是 dist/ 里的生产构建
 *   node scripts/screenshots.mjs --base http://127.0.0.1:5173  # 拍 dev 服务（HMR 实时）
 *   node scripts/screenshots.mjs --keyword 人民广场
 *   CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" node scripts/screenshots.mjs
 *
 * ⚠ 改完前端代码直接跑本脚本会拍到**旧界面**。默认 BASE 是 8787，那里服务的是 dist/
 * 静态产物，不 build 不会更新（这个坑已经踩过一次：拍完发现截图里的候选卡还是黄底，
 * 而源码早就改成黑底反白了）。要么先 build，要么显式 --base 指向 5173。
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf('base', 'http://127.0.0.1:8787').replace(/\/$/, '');
const OUT = resolve(argOf('out', 'docs/screenshots'));
const KEYWORD = argOf('keyword', '');

/** 一条普通用户会说出口的话，用于驱动主流程 */
const UTTERANCE = '不要薯条，换个别的，预算不超过 16 元';

const CANDIDATE_BROWSERS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const executablePath = CANDIDATE_BROWSERS.find((p) => existsSync(p));
if (!executablePath) {
  console.error('找不到可用的 Chrome / Edge，请用 CHROME_PATH 环境变量指定浏览器可执行文件路径。');
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shotPath = (name) => resolve(OUT, name);
const consoleErrors = [];

async function newPage(browser, viewport) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(1600);
  return page;
}

/** 点导航项。侧栏按钮的文本就是菜单名。 */
async function goTo(page, label) {
  const ok = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('aside button')].find((b) => (b.textContent ?? '').trim().startsWith(t));
    if (!btn) return false;
    btn.click();
    return true;
  }, label);
  if (!ok) throw new Error(`侧栏找不到「${label}」`);
  await sleep(700);
}

/**
 * 整页截图时把吸底操作栏改成文档流内的普通区块。
 * 原因：position: fixed 的元素在整页截图里只会停在首个视口底部，会压住中间的卡片，
 * 看起来像 UI 错位。这里只影响截图排版，不改变应用本身的行为。
 */
async function flattenActionBar(page) {
  const hasBar = await page.$('[data-region="actionbar"]');
  if (!hasBar) return;
  // 大屏时侧栏是 256px 固定宽度，静态化之后要把它让出来，否则会压到侧栏底下
  const wide = await page.evaluate(() => window.innerWidth >= 1024);
  await page.addStyleTag({
    content: `
      main{padding-bottom:8px!important}
      [data-region="actionbar"]{
        position:static!important;
        margin-top:8px;
        ${wide ? 'margin-left:256px;' : ''}
      }`,
  });
  await sleep(200);
}

/**
 * 按语义区块分段截图，而不是 fullPage 截成一整张。
 *
 * 为什么：概览页整页高达 3147 CSS px（@2x = 6294px / 608 KB），
 * 是其他桌面图的 3 倍多。它又排在 README 第一张，首屏就要拉，
 * 实测单张冷请求耗时 110 秒、传输中途被掐断（只收到 5%），
 * 表现为「打开仓库时第一张图总是转圈」。
 *
 * 这里改为按「Hero 输入区 / 消费概况 / 常用方案 / 最近订单」分别截图，
 * 每张都保持 @2x 清晰度，但体积回到 200 KB 量级。
 *
 * 锚点优先用 aria-label（结构稳定），只有 aria-label 找不到时才回退到
 * 标题文本 —— 文本回退会误命中侧栏导航按钮（它和区块标题文字相同），
 * 导致切分线落在页面顶部、切出半截标题，这是实际踩过的坑。
 */
async function captureSections(page, prefix, sections) {
  const geom = await page.evaluate((defs) => {
    const docH = document.documentElement.scrollHeight;
    const vh = window.innerHeight;
    const anchors = defs.map((d) => {
      let el = null;
      if (d.aria) el = document.querySelector(`[aria-label="${d.aria}"]`);
      if (!el && d.text) {
        const all = [...document.querySelectorAll('h1,h2,h3,span,p,div')];
        const hit = all.filter((e) => e.children.length === 0 && (e.textContent ?? '').trim() === d.text);
        // 排除侧栏/导航里的同名元素：只要正文主区域内的那个
        el = hit.find((e) => e.closest('main')) || hit[hit.length - 1] || null;
      }
      if (!el) return { y: null, why: 'anchor not found' };
      // 用最近的分块容器（section / panel）作为切分单位
      const sec = el.closest('section') || el.closest('.rounded-2xl') || el.parentElement;
      const r = sec.getBoundingClientRect();
      return { y: Math.round(r.top + window.scrollY), why: 'ok' };
    });
    return { docH, vh, anchors };
  }, sections.map((s) => ({ aria: s.aria ?? '', text: s.text ?? '' })));

  for (const [i, a] of geom.anchors.entries()) {
    const def = sections[i];
    if (def.top !== undefined) continue; // 起点固定，无需锚点
    if (a.why !== 'ok') console.warn(`  ! 锚点未命中: ${def.aria || def.text}`);
  }

  const out = [];
  // bound[i] = 第 i 张图的底边 = sections[i+1] 的顶边。
  // 用「严格取下一段自己的锚点」，不能从 i 开始找 —— 否则第 i 和第 i+1 段
  // 会取到同一个锚点，中间那段就被压成 120px（实际踩过）。
  const ys = geom.anchors.map((a) => a.y);
  const isY = (v) => v !== null && v !== undefined;
  for (let i = 0; i < sections.length; i++) {
    // 本段起点：首段为 0，其余为下一段锚点。
    // 往上多让 56px：区块锚点取的是 Panel 顶边，而标题文字在 Panel 内侧，
    // 贴着 0 切会让标题被上一段内容/吸顶栏压住（实际拍出来过）。
    const top = i === 0 ? 0 : Math.max(0, (isY(ys[i]) ? ys[i] : geom.docH) - 76);
    // 本段终点：下一段的锚点；末段为文档底
    const nxt = i + 1 < ys.length ? ys[i + 1] : geom.docH;
    const bottom = isY(nxt) ? Math.max(top + 120, nxt - 20) : geom.docH;
    if (bottom - top < 120) continue; // 区块太矮不单独出图
    const file = `${prefix}-${sections[i].file}.png`;
    await page.evaluate((y) => window.scrollTo(0, y), top);
    await sleep(260);
    await page.screenshot({
      path: shotPath(file),
      clip: { x: 0, y: top, width: page.viewport().width, height: bottom - top },
      captureBeyondViewport: true,
    });
    out.push({ file, from: top, to: bottom, h: bottom - top });
    console.log(`✓ ${file}  ${top}→${bottom} (${bottom - top}px)`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  return out;
}

/** 切换门店：输入关键词 → 搜索 → 选第一家 */
async function switchStore(page, keyword) {
  await goTo(page, '门店');
  await page.type('#kw', keyword);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => (x.textContent ?? '').trim() === '搜索');
    b?.click();
  });
  await page.waitForFunction(
    () => [...document.querySelectorAll('ul li button')].some((b) => (b.textContent ?? '').includes('餐厅')),
    { timeout: 30000 },
  );
  await sleep(500);
  const ok = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('ul li button')].find((b) => b.textContent?.includes('餐厅'));
    if (!btn) return false;
    btn.click();
    return true;
  });
  if (!ok) throw new Error('门店搜索结果里没有可选门店');
  // 切店会弹一个 3.2s 的 toast，等它消失再截图，否则会压在卡片上
  await page.waitForFunction(() => !document.querySelector('[role="status"]'), { timeout: 8000 }).catch(() => {});
  await sleep(600);
  return keyword;
}

async function submitUtterance(page, text) {
  await goTo(page, '开始点单');
  await page.click('textarea');
  await page.type('textarea', text, { delay: 4 });
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('改了什么'), { timeout: 90000 });
  await sleep(1000);
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
});

try {
  // ---------- 桌面 ----------
  const desktop = await newPage(browser, { width: 1440, height: 980, deviceScaleFactor: 2 });

  if (KEYWORD) await switchStore(desktop, KEYWORD);

  await goTo(desktop, '概览');
  await sleep(600);
  // 概览页整页 6294px 太大（README 第一张图拉不动），按区块分四张
  await captureSections(desktop, 'dashboard', [
    { file: 'hero', top: 0 },
    { file: 'spending', aria: '消费概况' },
    { file: 'plans', text: '常用方案' },
    { file: 'orders', text: '最近订单' },
  ]);

  await goTo(desktop, '订单记录');
  await desktop.screenshot({ path: shotPath('orders-desktop.png'), fullPage: true });
  console.log('✓ orders-desktop');

  await goTo(desktop, '常用方案');
  await desktop.screenshot({ path: shotPath('plans-desktop.png'), fullPage: true });
  console.log('✓ plans-desktop');

  await goTo(desktop, '开始点单');
  await desktop.screenshot({ path: shotPath('order-empty-desktop.png') });
  console.log('✓ order-empty-desktop');

  await submitUtterance(desktop, UTTERANCE);
  await flattenActionBar(desktop);
  await desktop.screenshot({ path: shotPath('order-desktop.png'), fullPage: true });
  console.log('✓ order-desktop');

  const clicked = await desktop.evaluate(() => {
    const b = [...document.querySelectorAll('[data-region="actionbar"] button')].find((x) =>
      (x.textContent ?? '').includes('去确认下单'),
    );
    if (!b) return false;
    b.click();
    return true;
  });
  if (!clicked) throw new Error('找不到「去确认下单」按钮');

  await desktop.waitForFunction(() => document.body.innerText.includes('应付'), { timeout: 45000 });
  await sleep(1400);
  await desktop.screenshot({ path: shotPath('confirm-desktop.png') });
  console.log('✓ confirm-desktop');

  // 勾选「已核对」，验证按钮从禁用变可用；到此为止，不点提交（避免真实下单）
  await desktop.evaluate(() => document.querySelector('input[type=checkbox]')?.click());
  await sleep(400);
  const submitEnabled = await desktop.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('确认下单'));
    return Boolean(btn && !btn.disabled);
  });
  if (!submitEnabled) throw new Error('勾选后「确认下单」按钮仍未激活');
  await desktop.screenshot({ path: shotPath('confirm-checked.png') });
  console.log('✓ confirm-checked（未提交订单）');

  // ---------- 移动端 ----------
  const mobile = await newPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

  if (KEYWORD) await switchStore(mobile, KEYWORD);

  await goTo(mobile, '概览');
  await sleep(600);
  // 移动端整页更夸张（@2x 高 7748px），同样分段
  await captureSections(mobile, 'dashboard-mobile', [
    { file: 'hero', top: 0 },
    { file: 'spending', aria: '消费概况' },
    { file: 'plans', text: '常用方案' },
    { file: 'orders', text: '最近订单' },
  ]);

  // 抽屉导航
  await mobile.evaluate(() => document.querySelector('header button[aria-label="打开导航"]')?.click());
  await sleep(500);
  await mobile.screenshot({ path: shotPath('nav-mobile.png') });
  console.log('✓ nav-mobile');
  await mobile.evaluate(() => document.querySelector('aside button[aria-label="关闭导航"]')?.click());
  await sleep(400);

  await submitUtterance(mobile, UTTERANCE);
  await flattenActionBar(mobile);
  await mobile.screenshot({ path: shotPath('order-mobile.png'), fullPage: true });
  console.log('✓ order-mobile');

  const mClicked = await mobile.evaluate(() => {
    const b = [...document.querySelectorAll('[data-region="actionbar"] button')].find((x) =>
      (x.textContent ?? '').includes('去确认下单'),
    );
    if (!b) return false;
    b.click();
    return true;
  });
  if (!mClicked) throw new Error('移动端找不到「去确认下单」按钮');

  await mobile.waitForFunction(() => document.body.innerText.includes('应付'), { timeout: 45000 });
  await sleep(1400);
  await mobile.screenshot({ path: shotPath('confirm-mobile.png') });
  console.log('✓ confirm-mobile（未提交订单）');
} finally {
  await browser.close();
}

const produced = readdirSync(OUT).filter((f) => f.endsWith('.png'));
if (consoleErrors.length > 0) {
  console.error('\n浏览器控制台报错：');
  for (const e of consoleErrors.slice(0, 10)) console.error(' -', e);
  process.exitCode = 1;
} else {
  console.log(`\n浏览器控制台无报错。共 ${produced.length} 张截图，输出到 ${OUT}`);
}
