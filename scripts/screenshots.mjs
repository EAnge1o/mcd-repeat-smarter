/**
 * 截图脚本 —— 用真实浏览器跑一遍主流程并截图，供 README / 参赛材料使用。
 *
 * 说明：
 * 1. 需要先启动应用（npm run dev 或 npm run build && npm start）。
 * 2. 使用本机已安装的 Chrome / Edge，不下载浏览器（puppeteer-core）。
 * 3. 只截图，不提交订单 —— 最后一步停在「已勾选、按钮已激活」的状态。
 *
 * 用法：
 *   node scripts/screenshots.mjs
 *   node scripts/screenshots.mjs --base http://127.0.0.1:8787 --out docs/screenshots
 *   CHROME_PATH="C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" node scripts/screenshots.mjs
 */

import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';

const args = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const BASE = argOf('base', 'http://127.0.0.1:8787').replace(/\/$/, '');
const OUT = resolve(argOf('out', 'docs/screenshots'));

/** 一条普通用户会说出口的话，用于驱动主流程 */
const UTTERANCE = '还是上次那份，不过今天不要香芋派，换个东西，预算不超过 16 元';

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
  await sleep(1200);
  return page;
}

/** 点击文本匹配的按钮（页面上按钮文案会变，用文本找更稳） */
async function clickByText(page, text) {
  const handles = await page.$$('button');
  for (const h of handles) {
    const t = await page.evaluate((el) => el.textContent ?? '', h);
    if (t.includes(text)) {
      await h.click();
      return true;
    }
  }
  return false;
}

/**
 * 整页截图时把吸底操作栏改成文档流内的普通区块。
 * 原因：position: fixed 的元素在整页截图里只会停在首个视口底部，会压住中间的卡片，
 * 看起来像 UI 错位。这里只影响截图排版，不改变应用本身的行为。
 */
async function flattenActionBar(page) {
  await page.addStyleTag({
    content: '.actionbar{position:static!important;animation:none!important}.main{padding-bottom:24px!important}',
  });
}

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none'],
});

try {
  // ---------- 桌面端：首屏 → 调整结果 → 确认抽屉 ----------
  const desktop = await newPage(browser, { width: 1440, height: 950, deviceScaleFactor: 2 });
  await desktop.screenshot({ path: shotPath('home-desktop.png'), fullPage: true });
  console.log('✓ home-desktop');

  await desktop.type('textarea', UTTERANCE, { delay: 6 });
  await desktop.click('.composer__send');
  await desktop.waitForSelector('.cand', { timeout: 60000 });
  await sleep(1400);
  await flattenActionBar(desktop);
  await desktop.screenshot({ path: shotPath('adjust-desktop.png'), fullPage: true });
  console.log('✓ adjust-desktop');

  if (!(await clickByText(desktop, '去确认下单'))) throw new Error('找不到「去确认下单」按钮');
  await desktop.waitForSelector('.sheet', { timeout: 30000 });
  await sleep(2200);
  await desktop.screenshot({ path: shotPath('confirm-desktop.png') });
  console.log('✓ confirm-desktop');

  // 勾选「已核对」，验证按钮从禁用变可用；到此为止，不点提交（避免真实下单）
  await desktop.click('.confirm-check input');
  await sleep(400);
  const submitEnabled = await desktop.evaluate(() => {
    const btn = [...document.querySelectorAll('.sheet__foot button')].find((b) => (b.textContent ?? '').includes('确认下单'));
    return Boolean(btn && !btn.disabled);
  });
  if (!submitEnabled) throw new Error('勾选后「确认下单」按钮仍未激活');
  await desktop.screenshot({ path: shotPath('confirm-checked.png') });
  console.log('✓ confirm-checked（未提交订单）');

  // ---------- 移动端 ----------
  const mobile = await newPage(browser, { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mobile.screenshot({ path: shotPath('home-mobile.png'), fullPage: true });
  console.log('✓ home-mobile');

  await mobile.type('textarea', UTTERANCE, { delay: 6 });
  await mobile.click('.composer__send');
  await mobile.waitForSelector('.cand', { timeout: 60000 });
  await sleep(1400);
  await flattenActionBar(mobile);
  await mobile.screenshot({ path: shotPath('adjust-mobile.png'), fullPage: true });
  console.log('✓ adjust-mobile');

  // 移动端确认页：底部弹层形态，同样只到「已勾选」为止
  if (!(await clickByText(mobile, '去确认下单'))) throw new Error('移动端找不到「去确认下单」按钮');
  await mobile.waitForSelector('.sheet', { timeout: 30000 });
  await sleep(2200);
  await mobile.screenshot({ path: shotPath('confirm-mobile.png') });
  console.log('✓ confirm-mobile（未提交订单）');
} finally {
  await browser.close();
}

if (consoleErrors.length > 0) {
  console.error('\n浏览器控制台报错：');
  for (const e of consoleErrors.slice(0, 10)) console.error(' -', e);
  process.exitCode = 1;
} else {
  console.log('\n浏览器控制台无报错。截图已输出到', OUT);
}
