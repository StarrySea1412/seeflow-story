/* 四枚确定性小样 + 阅读进度条。零依赖，全部原生 DOM。 */
(() => {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmtT = (t) => {
    t = Math.max(0, Math.round(t));
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  };

  /* ── 阅读进度 ───────────────────────────── */
  const prog = $("#progress");
  if (prog) {
    const paint = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      prog.style.transform = "scaleX(" + (max > 0 ? h.scrollTop / max : 0) + ")";
    };
    addEventListener("scroll", paint, { passive: true });
    addEventListener("resize", paint, { passive: true });
    paint();
  }

  /* ── 公共：bigram（与 Python _grams 同构） ── */
  const norm = (text) => ((String(text).toLowerCase().match(/[\u4e00-\u9fff a-z0-9]+/g) || []).join(""));
  const grams = (text) => {
    const s = norm(text);
    const out = [];
    for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
    return out;
  };
  const bigram = (claim, corpus) => {
    const g = grams(claim);
    if (!g.length) return 0;
    const src = new Set(grams(corpus));
    let hit = 0;
    for (const x of g) if (src.has(x)) hit++;
    return hit / g.length;
  };

  /* ══════════════════════════════════════════
     DEMO 01 · 注意力预算台
     ══════════════════════════════════════════ */
  (() => {
    const root = $("#demo-attention");
    if (!root) return;
    const DUR = 1110;
    let seed = 20251021;
    const rnd = () => {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pool = [
      "我们先从今年的整体情况说起", "这一类产品今年变化其实挺大的", "参数上它给到了一个新的档位",
      "实际用下来感受还是比较明显", "价格这次也算有诚意", "不过缺点也不是没有",
      "这段素材是自购的", "我们继续看下一台机器", "拍视频和拍照的侧重点不太一样",
      "今年的竞争确实比往年激烈", "先说结论再展开", "这个奖项的评选标准在后面",
      "机身手感这一块我们单独说", "接口的布局和上代基本一致", "散热这次做了一个新的方案",
      "续航实测下来比标称少一些", "我们把它和另外两台放在一起比", "这一段是外景实拍"
    ];
    const special = [
      { t: 96, text: "就是我知道这个肯定有人会说它不好看" },
      { t: 158, text: "SIGMA BF 的外观先放一边，我们看下一台" },
      { t: 214, text: "这些按钮的位置我给大家指一下" },
      { t: 274, text: "全景无人机最大的变化在云台和头部的配合" },
      { t: 340, text: "如图，这一页是今年的评选规则" },
      { t: 470, text: "可以看到这个界面的右下角" },
      { t: 520, text: "我们看一下这一步的设置" },
      { t: 604, text: "这个价格我打在屏幕上了" },
      { t: 640, text: "我们测了 60 帧连续录制的情况" },
      { t: 700, text: "注意这里，画面里是过热提示" },
      { t: 760, text: "像这样的对比我们做了三组" },
      { t: 841, text: "富士 GFX100RF 的首发价格是 36900 元" },
      { t: 880, text: "屏幕上的这个数字是实测值" },
      { t: 980, text: "比如说这行参数" },
      { t: 1050, text: "这里还有个小细节" }
    ];
    const gold = [
      { t: 158, label: "外观" }, { t: 274, label: "解耦" },
      { t: 640, label: "过热" }, { t: 841, label: "价格" }
    ];    const subs = [];
    for (let t = 5; t < DUR - 4; t += 6 + rnd() * 8) {
      subs.push({ t: +t.toFixed(2), t_end: +(t + 4 + rnd() * 3).toFixed(2), text: pool[Math.floor(rnd() * pool.length)] });
    }
    special.forEach((s) => subs.push({ t: s.t, t_end: s.t + 4.5, text: s.text }));
    subs.sort((a, b) => a.t - b.t);
    const cuts = [];
    for (let i = 0; i < 42; i++) cuts.push(+(rnd() * DUR).toFixed(1));
    cuts.push(840.5);
    const dm = [];
    const bursts = [120, 274, 250, 400, 560, 680, 800, 940, 1020];
    bursts.forEach((c) => {
      const n = c === 274 ? 12 : 5 + Math.floor(rnd() * 9);
      for (let i = 0; i < n; i++) dm.push(+(c + (rnd() - 0.5) * 18).toFixed(1));
    });

    const elPoints = $("#attn-points"), elGap = $("#attn-gap");
    const elDeixis = $("#attn-deixis"), elScene = $("#attn-scene"), elDanmaku = $("#attn-danmaku");
    const outSub = $("#attn-sub"), outCuts = $("#attn-cuts"), outDm = $("#attn-danmaku-layer"), outPicks = $("#attn-picks");
    const outAxis = $("#attn-axis"), outList = $("#attn-list"), outNote = $("#attn-note");
    const outCand = $("#attn-cand"), outPicked = $("#attn-picked"), outHit = $("#attn-hit");

    const DM_RE = /这个|这些|这里|如下|可以看到|看这里|注意|如图|像这样|就像|屏幕|界面|按钮|设置里|菜单|这行|这一步|看一下|比如说/;
    const goldHtml = gold.map((g) =>
      `<div class="tl-gold" style="left:${(g.t / DUR * 100 - 0.5).toFixed(3)}%" data-label="${g.label}" title="视觉金标：${g.label} @${fmtT(g.t)}"></div>`
    ).join("");

    function danmakuScore(t) {
      const n = dm.filter((d) => Math.abs(d - t) <= 10).length;
      return n >= 5 ? Math.min(2, n / 5) : 0;
    }
    function nearCut(t) { return cuts.some((c) => Math.abs(c - t) <= 1); }
    function scoreOf(seg) {
      const d = elDeixis.checked && DM_RE.test(seg.text) ? 2 : 0;
      const s = elScene.checked && nearCut(seg.t) ? 1 : 0;
      const m = elDanmaku.checked ? danmakuScore(seg.t) : 0;
      return { d, s, m, total: d + s + m };
    }

    function drawTimeline() {
      outSub.innerHTML = subs.map((s) =>
        `<span style="left:${(s.t / DUR * 100).toFixed(3)}%;height:${clamp(6 + s.text.length / 3, 6, 30).toFixed(0)}px"></span>`
      ).join("");
      outCuts.innerHTML = cuts.map((c) => `<i style="left:${(c / DUR * 100).toFixed(3)}%"></i>`).join("");
      outDm.innerHTML = dm.map((d, i) =>
        `<i style="left:${(d / DUR * 100).toFixed(3)}%;top:${(26 + (i % 7) * 7).toFixed(0)}px"></i>`
      ).join("");
      outAxis.innerHTML = [0, 120, 240, 360, 480, 600, 720, 840, 960, 1080].map((t) =>
        `<b style="left:${(t / DUR * 100).toFixed(3)}%">${fmtT(t)}</b>`
      ).join("");
    }

    function render() {
      const max = +elPoints.value, gap = +elGap.value;
      $("#attn-points-v").textContent = max;
      $("#attn-gap-v").textContent = gap + "s";
      const cands = [];
      subs.forEach((s) => {
        const sc = scoreOf(s);
        if (sc.total > 0) cands.push({ t: +(s.t + (s.t_end - s.t) / 2).toFixed(2), text: s.text, ...sc });
      });
      cands.sort((a, b) => (b.total - a.total) || (a.t - b.t));
      const picked = [];
      for (const c of cands) {
        if (picked.length >= max) break;
        if (picked.every((p) => Math.abs(p.t - c.t) >= gap)) picked.push(c);
      }
      picked.sort((a, b) => a.t - b.t);
      const picksHtml = picked.map((p, i) =>
        `<div class="tl-pick" style="left:${(p.t / DUR * 100).toFixed(3)}%" data-n="${i + 1}"></div>`
      ).join("");
      outPicks.innerHTML = goldHtml + picksHtml;

      outCand.textContent = cands.length;
      outPicked.textContent = picked.length;
      const hit = gold.filter((g) => picked.some((p) => Math.abs(p.t - g.t) <= 10)).length;
      outHit.textContent = hit;
      const unreachable = gold.filter((g) => !cands.some((c) => Math.abs(c.t - g.t) <= 10));
      outNote.textContent = unreachable.length
        ? "未被任何信号触及的金标：" + unreachable.map((g) => fmtT(g.t) + "（" + g.label + "）").join("、") + "——没有人指、没有切点、没有弹幕。"
        : "四条金标附近都至少有一个候选点；能否被选中取决于预算与间隔。";

      outList.innerHTML = picked.length ? picked.map((p) => {
        const parts = [];
        if (p.d) parts.push("指代 2");
        if (p.s) parts.push("切点 1");
        if (p.m) parts.push("弹幕 " + p.m.toFixed(1));
        const total = p.d + p.s + p.m;
        return `<div class="pickrow"><b>${fmtT(p.t)}</b><span class="scorebar" title="得分 ${total.toFixed(1)}"><s style="width:${(p.d / 4 * 70).toFixed(0)}px"></s><s class="scene" style="width:${(p.s / 4 * 70).toFixed(0)}px"></s><s class="dm" style="width:${(p.m / 4 * 70).toFixed(0)}px"></s></span><span class="tx" title="${p.text.replace(/"/g, "&quot;")}">${p.text}</span><span class="parts">${parts.join(" + ")} = ${total.toFixed(1)}</span></div>`;
      }).join("") : `<p class="hintline">预算太小或间隔太大，没有点被选中。</p>`;
    }

    drawTimeline();
    [elPoints, elGap, elDeixis, elScene, elDanmaku].forEach((el) => el.addEventListener("input", render));
    render();
  })();

  /* ══════════════════════════════════════════
     DEMO 02 · 断言回查器 / 评测判定
     ══════════════════════════════════════════ */
  (() => {
    const root = $("#demo-verify");
    if (!root) return;
    const CORPUS = [
      { t: 520, text: "接下来我们看全画幅这一组" },
      { t: 540, text: "先看佳能 R6 Mark III 的机身和按键" },
      { t: 556, text: "它的传感器还是那块全画幅背照式" },
      { t: 572, text: "视频规格这次给得很满" },
      { t: 584, text: "R6 Mark III 这次给了 7K 30 帧的 RAW，Open Gate 模式" },
      { t: 596, text: "7K 60 帧 RAW 只能拍 16 比 9" },
      { t: 604, text: "7K 超采到 4K 30，无裁切 4K 120" },
      { t: 612, text: "同价位里这个规格上限是最高的" },
      { t: 624, text: "当然它也不是没有缺点" },
      { t: 637, text: "60 帧录制大概半小时会过热关机" },
      { t: 645, text: "其他格式可以长时间录，问题不大" },
      { t: 658, text: "再看尼康 ZR 这边" },
      { t: 672, text: "ZR 的首发价是 13999 元" },
      { t: 684, text: "它的 RAW 数据量很大，存储卡成本高" },
      { t: 696, text: "期待后续固件能把这个问题改一改" },
      { t: 712, text: "然后是索尼 FX2" },
      { t: 724, text: "FX2 本质上就是换壳的 A7M4" },
      { t: 736, text: "录制规格原地踏步，所以拿了挤牙膏奖" },
      { t: 748, text: "镜头这边，索尼 50-150 F2.0" },
      { t: 760, text: "光圈比 F2.8 更亮，体验极佳" },
      { t: 772, text: "而且比想象中轻" },
      { t: 786, text: "电影机颁给了 Alexa 35 Extreme" },
      { t: 798, text: "2K 可以到 660 帧" },
      { t: 900, text: "最后我们聊聊今年的评选标准" },
      { t: 912, text: "完全主观，只看视频功能" },
      { t: 926, text: "没有任何厂商赞助" }
    ];
    const PRESETS = [
      { text: "R6 III 支持 7K 30 RAW Open Gate，同价位规格最高", t: 602 },
      { text: "R6 III 支持 7K 30 RAW Open Gate，同价位规格最高", t: 900 },
      { text: "R6 III 的机身重量只有 620 克", t: 602 },
      { text: "R6 III 在 60 帧下约 30 分钟过热关机，其他格式可以长时间录制", t: 637 }
    ];
    const GOLD = { t: 961, text: "最佳镜头：索尼 50-150 F2.0，光圈比 2.8 亮，体验极佳且比想象中轻" };
    const PRED = { t: 961, text: "索尼 50-150 F2.0 是今年最佳镜头，光圈比 F2.8 更亮" };

    const state = { mode: "check", preset: 0, t: 602, text: PRESETS[0].text };
    const elMode = $("#vf-mode"), elWindow = $("#vf-window"), elThreshold = $("#vf-threshold");
    const elOffset = $("#vf-offset"), elClaim = $("#vf-claim");
    const elBadge = $("#vf-badge"), elNote = $("#vf-verdict-note"), elRatio = $("#vf-ratio");
    const elBar = $("#vf-bar"), elMark = $("#vf-threshold-mark"), elBest = $("#vf-best");
    const elGrams = $("#vf-grams"), elGold = $("#vf-gold"), elPresets = $("#vf-presets");
    const elClaimLabel = $("#vf-claim-label"), elHint = $("#vf-claim-hint"), elLen = $("#vf-claim-len");
    const elNumWarn = $("#vf-numwarn");

    /* bigram 的盲区：数字/单位编造时通用词仍然重叠。真实系统靠数字回填与审核员补位。 */
    const NUM_RE = /\d+(?:\.\d+)?/g;
    function numberBlindSpot(claim, corpus) {
      const nums = (claim.match(NUM_RE) || []).filter((s) => s.length >= 2);
      const src = norm(corpus);
      const missing = nums.filter((s) => !src.includes(s));
      if (!missing.length) return "";
      return "数字盲区：断言里的 " + [...new Set(missing)].join("、") +
        " 没有出现在窗口语料里，但二字组仍大量重叠——bigram 抓不到数字编造。" +
        "生产环境靠要点原话的数字比对、百分比一致性与审核员补这一刀。";
    }

    function setBadge(kind, text, note) {
      elBadge.className = "badge " + kind;
      elBadge.textContent = text;
      elNote.textContent = note;
    }
    function corpusIn(t, w) {
      return CORPUS.filter((s) => Math.abs(s.t - t) <= w);
    }
    function renderGrams(claim, corpus) {
      const g = grams(claim);
      const src = new Set(grams(corpus));
      const rows = g.slice(0, 60).map((x) =>
        `<span class="${src.has(x) ? "hit" : ""}">${x.replace(/ /g, "␣")}</span>`
      );
      elGrams.innerHTML = rows.length ? rows.join("") : "<span>（断言已清空）</span>";
    }

    function renderCheck() {
      const w = +elWindow.value, th = +elThreshold.value;
      const off = +elOffset.value;
      const t = state.t + off;
      state.text = elClaim.value;
      const claim = elClaim.value;
      $("#vf-window-v").textContent = "±" + w + "s";
      $("#vf-threshold-v").textContent = th.toFixed(2);
      $("#vf-offset-v").textContent = (off > 0 ? "+" : "") + off + "s";
      elClaimLabel.textContent = "断言 · t=" + Math.round(t) + "s";
      elLen.textContent = claim.trim().length + " 字";
      const local = corpusIn(t, w);
      elHint.textContent = "窗口内语料：" + local.length + " 条 · " + Math.round(t) + "±" + w + "s";
      const localText = local.map((s) => s.text).join(" ");
      const localRatio = bigram(claim, localText);
      let bestT = null, bestR = 0;
      CORPUS.forEach((s) => {
        const r = bigram(claim, s.text);
        if (r > bestR) { bestR = r; bestT = s.t; }
      });
      let verdict = "drop", note = "窗口与全轴都找不到依据，删除";
      if (localRatio >= th) { verdict = "keep"; note = "窗口内命中率达标，时间不动"; }
      else if (bestR >= th) { verdict = "repair"; note = "窗口不达标，但全轴找到更匹配的记录，时间改到 " + fmtT(bestT); }
      setBadge(verdict, verdict.toUpperCase(), note);
      elRatio.textContent = localRatio.toFixed(3);
      elBar.style.width = (clamp(localRatio, 0, 1) * 100).toFixed(1) + "%";
      elMark.style.left = (clamp(th, 0, 1) * 100).toFixed(1) + "%";
      elBest.textContent = bestT == null ? "—" : "t=" + bestT + "s / " + bestR.toFixed(3);
      renderGrams(claim, localText);
      const warn = numberBlindSpot(claim, localText);
      elNumWarn.style.display = warn ? "block" : "none";
      elNumWarn.textContent = warn;
    }

    function renderEval() {
      const w = +elWindow.value, th = +elThreshold.value;
      const off = +elOffset.value;
      const pt = PRED.t + off;
      $("#vf-window-v").textContent = "±" + w + "s";
      $("#vf-threshold-v").textContent = th.toFixed(2);
      $("#vf-offset-v").textContent = (off > 0 ? "+" : "") + off + "s";
      elClaimLabel.textContent = "预测 · t=" + Math.round(pt) + "s";
      elLen.textContent = PRED.text.length + " 字";
      elHint.textContent = "金标准 t=" + GOLD.t + "s · 时间差 " + Math.abs(pt - GOLD.t).toFixed(1) + "s";
      const r = bigram(GOLD.text, PRED.text);
      const timeOk = Math.abs(pt - GOLD.t) <= w;
      const contentOk = r >= th;
      const hit = timeOk && contentOk;
      setBadge(hit ? "keep" : "drop", hit ? "HIT" : "MISS",
        hit ? "时间窗与内容相似度同时成立，计为命中"
          : (!timeOk ? "时间差超出窗口（内容相似度 " + r.toFixed(3) + "）"
            : "内容相似度低于阈值（时间窗成立）"));
      elRatio.textContent = r.toFixed(3);
      elBar.style.width = (clamp(r, 0, 1) * 100).toFixed(1) + "%";
      elMark.style.left = (clamp(th, 0, 1) * 100).toFixed(1) + "%";
      elBest.textContent = "Δt=" + Math.abs(pt - GOLD.t).toFixed(1) + "s / " + (timeOk ? "窗内" : "窗外");
      renderGrams(PRED.text, GOLD.text);
      elNumWarn.style.display = "none";
    }

    function render() {
      if (state.mode === "check") renderCheck(); else renderEval();
    }

    elMode.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      state.mode = btn.dataset.mode;
      $$("button[data-mode]", elMode).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
      const evalMode = state.mode === "eval";
      elPresets.style.display = evalMode ? "none" : "";
      elGold.style.display = evalMode ? "block" : "none";
      elGold.textContent = evalMode ? "金标准：" + GOLD.text : "";
      elClaim.value = evalMode ? PRED.text : state.text;
      elClaim.readOnly = evalMode;
      elOffset.value = "0";
      render();
    });

    $("#vf-preset-btns").addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-preset]");
      if (!btn) return;
      state.preset = +btn.dataset.preset;
      state.t = PRESETS[state.preset].t;
      state.text = PRESETS[state.preset].text;
      elClaim.value = state.text;
      elOffset.value = "0";
      $$("button[data-preset]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.preset === state.preset)));
      render();
    });

    [elWindow, elThreshold, elOffset, elClaim].forEach((el) => el.addEventListener("input", render));
    render();
  })();

  /* ══════════════════════════════════════════
     DEMO 03 · 降级阶梯
     ══════════════════════════════════════════ */
  (() => {
    const root = $("#demo-ladder");
    if (!root) return;
    const BASE = { notes: 4, frames: 12, ocr: 96, subs: 618 };
    const state = { tier: "cloud" };
    const elOcr = $("#ladder-ocr"), elSlow = $("#ladder-slow"), elTimeout = $("#ladder-timeout");
    const elRet = $("#ladder-ret"), elMode = $("#ladder-mode"), elVerdict = $("#ladder-verdict"), elWarn = $("#ladder-warnings");

    function cloudAvailable() { return !elSlow.checked || elTimeout.checked; }

    function profile(tier) {
      switch (tier) {
        case "cloud": return { notes: 4, frames: 12, ocr: elOcr.checked ? 96 : 0, subs: 618, mode: "cloud-vlm" };
        case "local": return { notes: 4, frames: 12, ocr: elOcr.checked ? 96 : 0, subs: 618, mode: "local-vlm" };
        case "signals": return { notes: 0, frames: 12, ocr: elOcr.checked ? 96 : 0, subs: 618, mode: "signals" };
        default: return { notes: 0, frames: 0, ocr: 0, subs: 618, mode: "subtitle-only" };
      }
    }

    function card(value, base, label, loss) {
      const w = base ? clamp(value / base * 100, 0, 100) : 0;
      return `<div class="ret ${loss ? "loss" : ""}"><b>${value}</b><small>${label}</small><div class="bar"><i style="width:${w.toFixed(0)}%"></i></div></div>`;
    }

    function render() {
      let effective = state.tier;
      const warns = [];
      if (state.tier === "cloud" && !cloudAvailable()) {
        effective = "signals";
        warns.push({ k: "silent_downgrade", t: "视觉端点实测需要 36–52s，探测超时 15s：云视觉被静默降级到信号模式——不报错，只表现为「没有画面理解」。" });
      }
      if (state.tier === "local") {
        warns.push({ k: "local_missing", t: "本机未配置 Ollama。这一档需要自己部署本地视觉模型；能力清单与云视觉相同，速度取决于机器。" });
      }
      if (!elOcr.checked && effective !== "subs") {
        warns.push({ k: "ocr_missing", t: "未安装 PaddleOCR：画面文字轨为空。字幕与画面不一致时无法对账，视觉断言也失去同帧校验。" });
      }
      if (effective === "signals") {
        warns.push({ k: "signals_mode", t: "报告标注「信号模式」：语义画面笔记缺席，但证据帧、OCR、镜头切换、弹幕信号仍然保留。" });
      }
      if (effective === "subs") {
        warns.push({ k: "subtitle_only", t: "纯字幕：没有证据帧。所有画面判断都不会出现，报告只剩文字轨与时间戳。" });
      }
      if (effective === "cloud" && elSlow.checked && elTimeout.checked) {
        warns.push({ k: "slow_ok", t: "慢端点存活：90s 探测超时让它通过，视觉能力没有被超时值悄悄关掉。" });
      }

      const p = profile(effective);
      const ocrLabel = effective === "subs" ? "画面文字 OCR（未下载视频）"
        : elOcr.checked ? "画面文字 OCR" : "画面文字 OCR（未安装）";
      elRet.innerHTML =
        card(p.notes, BASE.notes, "语义画面笔记", p.notes === 0) +
        card(p.frames, BASE.frames, "证据帧", p.frames === 0) +
        card(p.ocr, BASE.ocr, ocrLabel, p.ocr === 0) +
        card(p.subs, BASE.subs, "字幕条目", false);
      elMode.textContent = p.mode;
      elVerdict.textContent = p.notes
        ? "语义 / 证据 / 文字三条轨齐全"
        : p.frames ? "证据还在，语义缺席" : "只剩文字轨";
      elWarn.innerHTML = warns.map((w) => `<div class="warnrow"><b>${w.k}</b> ${w.t}</div>`).join("");

      $$(".rung", root).forEach((r) => {
        const on = r.dataset.tier === state.tier;
        r.dataset.on = String(on);
        const st = $(".st", r);
        st.textContent = on ? "当前" : r.dataset.tier === "cloud" && !cloudAvailable() ? "探测失败" : "可选";
      });
    }

    $$(".rung", root).forEach((r) => r.addEventListener("click", () => {
      state.tier = r.dataset.tier;
      render();
    }));
    [elOcr, elSlow, elTimeout].forEach((el) => el.addEventListener("input", render));
    render();
  })();

  /* ══════════════════════════════════════════
     DEMO 04 · 覆盖账本
     ══════════════════════════════════════════ */
  (() => {
    const root = $("#demo-coverage");
    if (!root) return;
    const DUR = 15426;
    const elChunk = $("#cov-chunk"), elFail = $("#cov-fail"), elCache = $("#cov-cache"), elDisclose = $("#cov-disclose");
    const elChunks = $("#cov-chunks"), elWarn = $("#cov-warnings");
    const elReq = $("#cov-req"), elDone = $("#cov-done"), elFailed = $("#cov-failed");
    const elStatus = $("#cov-status"), elGate = $("#cov-gate"), elNote = $("#cov-note");

    function render() {
      const chunk = +elChunk.value, rate = +elFail.value, cache = +elCache.value;
      // 真机分段边界落在字幕条目上，每段实际跨度略大于标称值：15426/(len+2.5)
      // 在 60/120/150/300s 上复现实测的 244/125/101/51 段。
      const n = Math.max(1, Math.round(DUR / (chunk + 2.5)));
      let failed = Math.round(n * rate / 100);
      $("#cov-chunk-v").textContent = chunk + "s";
      $("#cov-fail-v").textContent = rate + "%";
      $("#cov-cache-v").textContent = cache + "%";

      const failSet = new Set();
      for (let i = 0; i < failed; i++) failSet.add(Math.min(n - 1, Math.floor((i + 0.5) * n / failed)));
      failed = failSet.size;
      const completed = n - failed;

      const cells = [];
      let cachedCount = 0;
      for (let i = 0; i < n; i++) {
        let cls = "done";
        if (failSet.has(i)) cls = "failed";
        // 缓存命中段按确定性哈希散布，不做「前 N 段全缓存」的假分布
        else if ((i * 37 + 11) % 100 < cache) { cls = "cached"; cachedCount++; }
        const a = Math.min(DUR, i * chunk), b = Math.min(DUR, (i + 1) * chunk);
        cells.push(`<div class="chunk ${cls}" title="第 ${i + 1} 段 · ${fmtT(a)}–${fmtT(b)}"></div>`);
      }
      elChunks.innerHTML = cells.join("");
      elReq.textContent = n;
      elDone.textContent = completed;
      elFailed.textContent = failed;
      elStatus.textContent = failed ? "partial" : "complete";
      elGate.textContent = failed ? "review" : "pass";

      const ranges = [];
      let start = null;
      for (let i = 0; i <= n; i++) {
        const bad = i < n && failSet.has(i);
        if (bad && start === null) start = i;
        if (!bad && start !== null) {
          const a = start * chunk, b = Math.min(DUR, i * chunk);
          ranges.push(fmtT(a) + "–" + fmtT(b));
          start = null;
        }
      }
      const warnRows = [];
      if (failed) {
        warnRows.push(`<div class="warnrow"><b>coverage_incomplete</b> 部分文字分段没有生成有效要点，报告覆盖不完整。</div>`);
        if (elDisclose.checked) {
          warnRows.push(`<div class="warnrow"><b>missing</b> 缺失区间：${ranges.slice(0, 4).join("、")}${ranges.length > 4 ? " 等 " + ranges.length + " 段" : ""}</div>`);
          warnRows.push(`<div class="warnrow"><b>reduce 提示</b> 「只能总结已给材料，明确覆盖不完整，不推测这些缺失内容。」</div>`);
        } else {
          warnRows.push(`<div class="warnrow" style="opacity:.6"><b>已压制</b> 覆盖表仍记录 ${failed} 段失败；报告不会提示，读者会以为它是完整的。</div>`);
        }
      } else {
        warnRows.push(`<div class="warnrow" style="color:#b7dcc7;background:rgba(121,178,148,.08);border-color:rgba(121,178,148,.25)"><b>coverage_complete</b> 所有分段均生成有效要点；质量门无覆盖类警告。</div>`);
      }
      if (n > 120) {
        warnRows.push(`<div class="warnrow"><b>budget</b> 分段数 ${n} 超过 120：map 并行与审核预算都会被拉长；长视频的瓶颈从模型变成时间。</div>`);
      }
      elWarn.innerHTML = warnRows.join("");
      elNote.textContent = `失败段按等距落点分布（不是随机）；本次 ${cachedCount}/${completed} 段走缓存，${ranges.length} 个缺口。真实任务：101 段 / 94 缓存 / 1 失败。`;
    }

    [elChunk, elFail, elCache, elDisclose].forEach((el) => el.addEventListener("input", render));
    render();
  })();
})();
