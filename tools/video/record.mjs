// ミチシルベ デモ自動録画 (Backfull record.py の Playwright 版)
// 使い方: node tools/video/record.mjs [S1_opening ...]   引数なしで全ショット
// 出力: tools/video/out/<shot_id>.webm (1920x1080, カーソル・クリック輪・強調枠つき)
import { chromium } from "playwright";
import { readFileSync, existsSync, mkdirSync, renameSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));
const conf = JSON.parse(readFileSync(join(HERE, "shots.json"), "utf8"));
const BASE = process.env.BASE_URL || conf.base_url;
const OUT = join(HERE, "out");
mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));

// 偽カーソル+クリック輪+強調枠 (録画にマウスは映らないため描画する)
const OVERLAY = `
  (() => {
    const c = document.createElement('div');
    c.id = '__cur';
    c.style.cssText = 'position:fixed;z-index:999999;width:22px;height:22px;pointer-events:none;'
      + 'left:960px;top:540px;transition:left .45s cubic-bezier(.4,0,.2,1),top .45s cubic-bezier(.4,0,.2,1);';
    c.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M4 2 L4 19 L8.5 15.5 L11.5 21.5 L14 20 L11 14.5 L17 14 Z" fill="#fff" stroke="#000" stroke-width="1.4"/></svg>';
    document.documentElement.appendChild(c);
    window.__move = (x, y) => { c.style.left = x + 'px'; c.style.top = y + 'px'; };
    window.__ripple = (x, y) => {
      const r = document.createElement('div');
      r.style.cssText = 'position:fixed;z-index:999998;pointer-events:none;border:3px solid #ff9f1a;'
        + 'border-radius:50%;width:14px;height:14px;left:' + (x-7) + 'px;top:' + (y-7) + 'px;'
        + 'transition:all .5s ease-out;opacity:1;';
      document.documentElement.appendChild(r);
      requestAnimationFrame(() => { const s=58; r.style.width=s+'px'; r.style.height=s+'px';
        r.style.left=(x-s/2)+'px'; r.style.top=(y-s/2)+'px'; r.style.opacity='0'; });
      setTimeout(() => r.remove(), 700);
    };
    window.__box = (el) => {
      const b = el.getBoundingClientRect();
      const d = document.createElement('div');
      d.className = '__hl';
      d.style.cssText = 'position:fixed;z-index:999997;pointer-events:none;border:3px solid #ff9f1a;'
        + 'border-radius:8px;box-shadow:0 0 0 2000px rgba(0,0,0,.25);'
        + 'left:' + (b.left-6) + 'px;top:' + (b.top-6) + 'px;width:' + (b.width+12) + 'px;height:' + (b.height+12) + 'px;';
      document.documentElement.appendChild(d);
    };
    window.__unbox = () => document.querySelectorAll('.__hl').forEach(e => e.remove());
  })();
`;

async function locate(page, step) {
  if (step.sel) return page.locator(step.sel).first();
  return page.getByText(step.text, { exact: false }).first();
}

async function moveAndClick(page, loc) {
  const box = await loc.boundingBox();
  if (!box) throw new Error("element not visible");
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate(([x, y]) => window.__move(x, y), [x, y]);
  await sleep(0.55);
  await page.evaluate(([x, y]) => window.__ripple(x, y), [x, y]);
  await sleep(0.25);
  await loc.click();
}

for (const shot of conf.shots) {
  if (only.length && !only.includes(shot.id)) continue;
  console.log(`\n=== ${shot.id} (${shot.dur}s想定) ===`);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: OUT, size: { width: 1920, height: 1080 } },
    permissions: ["geolocation", "clipboard-write", "clipboard-read"],
    geolocation: { latitude: 36.075431, longitude: 136.219753 }, // 福井市中心部
    locale: "ja-JP",
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("  pageerror:", e.message));

  try {
    for (const step of shot.steps) {
      try {
        switch (step.op) {
          case "goto":
            await page.goto(BASE + step.path, { waitUntil: "networkidle" }).catch(() => {});
            await page.evaluate(OVERLAY);
            break;
          case "wait":
          case "pause":
            await sleep(step.s);
            break;
          case "click":
          case "clickText":
            await moveAndClick(page, await locate(page, step));
            if (step.s) await sleep(step.s);
            break;
          case "highlight": {
            const loc = page.locator(step.sel).first();
            await loc.evaluate((el) => window.__box(el));
            await sleep(step.s || 2);
            await page.evaluate(() => window.__unbox());
            break;
          }
          case "file": {
            const p = resolve(HERE, step.path);
            if (!existsSync(p)) throw new Error(`写真がありません: ${p}`);
            await page.locator(step.sel).setInputFiles(p);
            if (step.s) await sleep(step.s);
            break;
          }
          default:
            console.log("  不明なop:", step.op);
        }
      } catch (e) {
        if (step.optional) { console.log(`  (任意ステップをスキップ: ${e.message})`); }
        else throw e;
      }
    }
    const video = page.video();
    await ctx.close();
    const tmp = await video.path();
    const dest = join(OUT, `${shot.id}.webm`);
    renameSync(tmp, dest);
    console.log(`  → ${dest}`);
  } catch (e) {
    console.error(`  失敗: ${e.message}`);
    await ctx.close().catch(() => {});
  }
  await browser.close();
}
console.log("\n完了。mp4化: for f in tools/video/out/*.webm; do ffmpeg -y -i \"$f\" \"${f%.webm}.mp4\"; done");
