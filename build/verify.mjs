// 本地无头验收：起静态服务 → 逐小样推状态 → 截图 + 收集 pageerror / console error
// 用法：node build/verify.mjs
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire("D:/project/machine-skill/node_modules/");
const { chromium } = require("playwright");

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = join(root, "shots");
await mkdir(shots, { recursive: true });

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".webp": "image/webp", ".woff2": "font/woff2", ".png": "image/png", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split("?")[0]);
    const file = join(root, p === "/" ? "index.html" : p);
    const body = await readFile(file);
    res.writeHead(200, { "content-type": MIME[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}/`;
console.log("serving", base);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
page.on("requestfailed", (r) => errors.push("requestfailed: " + r.url()));

await page.goto(base, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

/* 字体与资源 */
const fontOk = await page.evaluate(() => document.fonts.check('16px "LXGW WenKai"'));
const imgs = await page.evaluate(() => [...document.images].map((i) => ({ src: i.getAttribute("src"), ok: i.naturalWidth > 0, w: i.naturalWidth })));
const broken = imgs.filter((i) => !i.ok);
console.log("font loaded:", fontOk, "| images:", imgs.length, "| broken:", broken.map((b) => b.src).join(",") || "none");

/* 首屏截图 */
await page.screenshot({ path: join(shots, "00-hero.png"), clip: { x: 0, y: 0, width: 1440, height: 900 } });

/* D1 注意力预算台：默认 / 极端 */
async function shotDemo(sel, name, mutate) {
  const el = await page.$(sel);
  await el.scrollIntoViewIfNeeded();
  if (mutate) await mutate();
  await page.waitForTimeout(180);
  const box = await el.boundingBox();
  await page.screenshot({ path: join(shots, name), clip: { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(1440, box.width + 16), height: Math.min(2000, box.height + 16) } });
}

await shotDemo("#demo-attention", "01-attn-default.png");
await shotDemo("#demo-attention", "02-attn-extreme.png", async () => {
  await page.$eval("#attn-points", (e) => { e.value = "1"; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.$eval("#attn-gap", (e) => { e.value = "120"; e.dispatchEvent(new Event("input", { bubbles: true })); });
});
const attnState = await page.evaluate(() => ({
  cand: document.querySelector("#attn-cand").textContent,
  picked: document.querySelector("#attn-picked").textContent,
  hit: document.querySelector("#attn-hit").textContent,
  note: document.querySelector("#attn-note").textContent,
  picks: document.querySelectorAll(".tl-pick").length,
  gold: document.querySelectorAll(".tl-gold").length,
}));
console.log("attn extreme:", JSON.stringify(attnState));
await shotDemo("#demo-attention", "03-attn-loose.png", async () => {
  await page.$eval("#attn-points", (e) => { e.value = "10"; e.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.$eval("#attn-gap", (e) => { e.value = "10"; e.dispatchEvent(new Event("input", { bubbles: true })); });
});

/* D2 断言回查器：四个预设 + 极端阈值 + 评测模式 */
await shotDemo("#demo-verify", "04-verify-real.png");
const vf = async (label) => {
  const s = await page.evaluate(() => ({
    badge: document.querySelector("#vf-badge").textContent,
    note: document.querySelector("#vf-verdict-note").textContent,
    ratio: document.querySelector("#vf-ratio").textContent,
    best: document.querySelector("#vf-best").textContent,
  }));
  console.log("verify " + label + ":", JSON.stringify(s));
};
await vf("preset0");
for (const i of [1, 2, 3]) {
  await page.click(`#vf-preset-btns button[data-preset="${i}"]`);
  await page.waitForTimeout(90);
  await shotDemo("#demo-verify", `0${4 + i}-verify-preset${i}.png`);
  await vf("preset" + i);
}
await page.click('#vf-preset-btns button[data-preset="0"]');
await page.$eval("#vf-threshold", (e) => { e.value = "0.60"; e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.$eval("#vf-window", (e) => { e.value = "5"; e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(90);
await shotDemo("#demo-verify", "08-verify-strict.png");
await vf("strict");
await page.$eval("#vf-offset", (e) => { e.value = "120"; e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(90);
await shotDemo("#demo-verify", "09-verify-drift.png");
await vf("drift");
await page.$eval("#vf-threshold", (e) => { e.value = "0.22"; e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.$eval("#vf-window", (e) => { e.value = "20"; e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.$eval("#vf-offset", (e) => { e.value = "0"; e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.click('#vf-mode button[data-mode="eval"]');
await page.waitForTimeout(90);
await shotDemo("#demo-verify", "10-verify-eval.png");
await vf("eval");
await page.$eval("#vf-offset", (e) => { e.value = "120"; e.dispatchEvent(new Event("input", { bubbles: true })); });
await page.waitForTimeout(90);
await shotDemo("#demo-verify", "11-verify-eval-miss.png");
await vf("eval-drift");

/* D3 降级阶梯：四档 + 探测超时 + 无 OCR */
async function ladder(tier, name, opts = {}) {
  await page.click(`.rung[data-tier="${tier}"]`);
  await page.evaluate((o) => {
    for (const [id, v] of Object.entries(o)) {
      const el = document.querySelector(id);
      if (el.checked !== v) { el.checked = v; el.dispatchEvent(new Event("input", { bubbles: true })); }
    }
  }, opts);
  await page.waitForTimeout(90);
  await shotDemo("#demo-ladder", name);
  const s = await page.evaluate(() => ({
    mode: document.querySelector("#ladder-mode").textContent,
    ret: [...document.querySelectorAll("#ladder-ret .ret b")].map((b) => b.textContent),
    warns: [...document.querySelectorAll("#ladder-warnings .warnrow b")].map((b) => b.textContent),
  }));
  console.log("ladder " + tier + ":", JSON.stringify(s));
}
await ladder("cloud", "12-ladder-cloud.png", { "#ladder-ocr": true });
await ladder("cloud", "13-ladder-timeout15.png", { "#ladder-ocr": true, "#ladder-timeout": false });
await ladder("signals", "14-ladder-signals.png", { "#ladder-ocr": true });
await ladder("signals", "15-ladder-noocr.png", { "#ladder-ocr": false });
await ladder("subs", "16-ladder-subs.png", { "#ladder-ocr": true });
await ladder("cloud", "17-ladder-back.png", { "#ladder-ocr": true, "#ladder-timeout": true });

/* D4 覆盖账本：默认 / 高失败 / 关闭披露 / 极短分段 */
async function cov(name, vals) {
  await page.evaluate((v) => {
    for (const [id, val] of Object.entries(v)) {
      const el = document.querySelector(id);
      if (el.type === "checkbox") { el.checked = val; } else { el.value = String(val); }
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, vals);
  await page.waitForTimeout(110);
  await shotDemo("#demo-coverage", name);
  const s = await page.evaluate(() => ({
    req: document.querySelector("#cov-req").textContent,
    done: document.querySelector("#cov-done").textContent,
    failed: document.querySelector("#cov-failed").textContent,
    status: document.querySelector("#cov-status").textContent,
    cells: document.querySelectorAll("#cov-chunks .chunk").length,
    warns: [...document.querySelectorAll("#cov-warnings .warnrow b")].map((b) => b.textContent),
  }));
  console.log("cov " + name + ":", JSON.stringify(s));
}
await cov("18-cov-default.png", { "#cov-chunk": 150, "#cov-fail": 1, "#cov-cache": 93, "#cov-disclose": true });
await cov("19-cov-heavy.png", { "#cov-chunk": 150, "#cov-fail": 20, "#cov-cache": 40, "#cov-disclose": true });
await cov("20-cov-nodisclose.png", { "#cov-chunk": 150, "#cov-fail": 12, "#cov-cache": 60, "#cov-disclose": false });
await cov("21-cov-tiny.png", { "#cov-chunk": 60, "#cov-fail": 5, "#cov-cache": 0, "#cov-disclose": true });

/* 窄屏 */
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true });
mobile.on("pageerror", (e) => errors.push("mobile pageerror: " + e.message));
await mobile.goto(base, { waitUntil: "networkidle" });
await mobile.evaluate(() => document.fonts.ready);
await mobile.screenshot({ path: join(shots, "22-mobile-hero.png") });
for (const [sel, name] of [["#demo-attention", "23-mobile-attn.png"], ["#demo-verify", "24-mobile-verify.png"], ["#demo-coverage", "25-mobile-cov.png"]]) {
  const el = await mobile.$(sel);
  await el.scrollIntoViewIfNeeded();
  await mobile.waitForTimeout(150);
  const box = await el.boundingBox();
  await mobile.screenshot({ path: join(shots, name), clip: { x: 0, y: Math.max(0, box.y), width: 390, height: Math.min(900, box.height) } });
}
const overflow = await mobile.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
console.log("mobile horizontal overflow px:", overflow);

/* 全页长截图（桌面） */
await page.evaluate(() => window.scrollTo(0, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: join(shots, "26-full.png"), fullPage: true });

console.log("ERRORS:", errors.length ? JSON.stringify(errors, null, 1) : "none");
await browser.close();
server.close();
