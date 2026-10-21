// 线上验收：对发布后的 URL 跑一遍四枚小样的关键状态与资源 200 检查
import { createRequire } from "node:module";
const require = createRequire("D:/project/machine-skill/node_modules/");
const { chromium } = require("playwright");

const base = process.argv[2] || "https://starrysea1412.github.io/seeflow-story/";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const errors = [], failed = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => { if (r.status() >= 400) failed.push(r.status() + " " + r.url()); });

await page.goto(base, { waitUntil: "networkidle", timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const font = await page.evaluate(() => document.fonts.check('16px "LXGW WenKai"'));
const imgs = await page.evaluate(() => [...document.images].map((i) => i.getAttribute("src")));
for (const src of imgs) {
  const r = await page.request.get(new URL(src, base).href);
  if (!r.ok()) failed.push(r.status() + " (img) " + src);
}
await page.waitForTimeout(300);
const lazy = await page.evaluate(async () => {
  window.scrollTo(0, document.body.scrollHeight);
  await new Promise((r) => setTimeout(r, 800));
  return [...document.images].filter((i) => i.naturalWidth === 0).map((i) => i.src);
});
console.log("font:", font, "| images:", imgs.length, "| lazy-broken:", lazy.length ? lazy : "none");

await page.click('#vf-preset-btns button[data-preset="2"]');
await page.waitForTimeout(120);
const d2 = await page.evaluate(() => ({
  badge: document.querySelector("#vf-badge").textContent,
  warn: document.querySelector("#vf-numwarn").style.display,
}));
await page.click('.rung[data-tier="signals"]');
await page.waitForTimeout(80);
const d3 = await page.evaluate(() => document.querySelector("#ladder-mode").textContent);
const d4 = await page.evaluate(() => ({
  cells: document.querySelectorAll("#cov-chunks .chunk").length,
  req: document.querySelector("#cov-req").textContent,
}));
await page.click('#attn-points');
await page.$eval("#attn-points", (e) => { e.value = "8"; e.dispatchEvent(new Event("input", { bubbles: true })); });
const d1 = await page.evaluate(() => document.querySelector("#attn-picked").textContent);
console.log("D1 picked:", d1, "| D2:", JSON.stringify(d2), "| D3:", d3, "| D4:", JSON.stringify(d4));
console.log("pageerrors:", errors.length ? errors : "none");
console.log("http failures:", failed.length ? failed : "none");
await browser.close();
