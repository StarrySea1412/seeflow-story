// 拼接单文件站点：head + style + hero + 七章 + 结语 + footer + demos.js
// 用法：node build/build.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(root, p), "utf8");

const style = read("build/style.css");
const hero = read("build/hero.html");
const chapters = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "closing"]
  .map((n) => read(`build/${n}.html`)).join("\n");
const footer = read("build/footer.html");
const js = read("build/demos.js");

const head = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="dark"/>
<meta name="theme-color" content="#0b0d10"/>
<link rel="preload" href="assets/fonts/wenkai-regular.woff2" as="font" type="font/woff2" crossorigin/>
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect width='24' height='24' rx='4' fill='%230b0d10'/%3E%3Crect x='4.5' y='7' width='15' height='10' rx='1.6' fill='none' stroke='%238fb0c2' stroke-width='1.3'/%3E%3Ccircle cx='12' cy='12' r='2.1' fill='%23e0533c'/%3E%3Cpath d='M4.5 9.4h2.4M17.1 9.4h2.4M4.5 14.6h2.4M17.1 14.6h2.4' stroke='%238fb0c2' stroke-width='.9'/%3E%3C/svg%3E"/>
<meta name="description" content="让 Agent 亲眼看一眼：一个视频理解 Agent 的证据链。从注意力预算、证据结构、确定性校验到降级与评测——SeeFlow 的深度解剖，附四枚可玩小样。"/>
<meta name="author" content="StarrySea1412"/>
<meta property="og:title" content="让 Agent 亲眼看一眼 · 造物手记 VOL.05"/>
<meta property="og:description" content="字幕看不见的那一层，才是视频最贵的部分。七章拆一个会看画面、且能证明自己没看错的 agent。"/>
<meta property="og:type" content="article"/>
<meta property="og:image" content="assets/art/hero.webp"/>
<title>让 Agent 亲眼看一眼 · 造物手记 VOL.05</title>
<style>
${style}
</style>
</head>
<body>
<div class="progress" id="progress"></div>
`;

const tail = `
<script>
${js}
</script>
</body>
</html>
`;

const html = head + hero + "\n<main>\n" + chapters + "\n</main>\n" + footer + tail;
writeFileSync(join(root, "index.html"), html, "utf8");
console.log(`built index.html  ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
