// Tạo ảnh chia sẻ 1200x630 cho từng trang (web/public/og/*.png) từ cảnh 3D thật của website.
// Cần: backend đang chạy với site đã build (mặc định http://127.0.0.1:8787) và Playwright.
//   node tools/make-og.js        rồi chạy lại `npm run build` trong web/ để ảnh vào site/
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const seo = JSON.parse(fs.readFileSync(path.join(root, 'web/scripts/seo.json'), 'utf8'));
const brand = fs.readFileSync(path.join(root, 'web/src/assets/brand.webp')).toString('base64');
const BASE = process.env.BASE || 'http://127.0.0.1:8787';
const outDir = path.join(root, 'web/public/og');
fs.mkdirSync(outDir, { recursive: true });

const card = (p, img) => `<!doctype html><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap">
<style>
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:'Nunito',system-ui,sans-serif;color:#0B2A6F;position:relative;
background:radial-gradient(60% 80% at 82% 40%,${p.tint}33,transparent 70%),radial-gradient(50% 60% at 5% 100%,#7B4DFF22,transparent 70%),linear-gradient(135deg,#F7F5F0,#EEEAE2)}
body::before{content:"";position:absolute;inset:0;background:radial-gradient(circle,${p.tint}55 1.5px,transparent 1.8px) 0 0/30px 30px;-webkit-mask-image:linear-gradient(90deg,transparent 35%,#000);mask-image:linear-gradient(90deg,transparent 35%,#000)}
.l{position:absolute;left:64px;top:56px;right:600px;bottom:56px;display:flex;flex-direction:column}
.b{display:flex;align-items:center;gap:12px;font-weight:900;font-size:30px;letter-spacing:-.02em}.b img{height:44px}.b i{font-style:normal;color:#FF6A2B;margin-left:6px}
h1{margin:auto 0 0;font-size:68px;line-height:1.04;letter-spacing:-.03em;font-weight:900}
h1 span{color:${p.tint === '#5B6279' ? '#FF6A2B' : p.tint}}
p{margin:20px 0 0;font-size:27px;line-height:1.35;color:#5B6279;font-weight:700;max-width:520px}
.f{margin-top:34px;display:flex;gap:12px;align-items:center}
.pill{background:#0B2A6F;color:#fff;border-radius:999px;padding:11px 22px;font-weight:800;font-size:22px}
.pill.o{background:#FF6A2B}
.s{position:absolute;right:-30px;top:-10px;width:700px;height:640px;background:url(data:image/png;base64,${img}) center/cover;border-radius:60px 0 0 60px;
-webkit-mask-image:linear-gradient(90deg,transparent,#000 22%);mask-image:linear-gradient(90deg,transparent,#000 22%)}
</style>
<div class="s"></div>
<div class="l"><div class="b"><img src="data:image/webp;base64,${brand}">3RDHub<i>Vietnam</i></div>
<h1>${p.head.replace(/(\S+(?:\s+\S+)?[.?])$/, '<span>$1</span>')}</h1><p>${p.sub}</p>
<div class="f"><span class="pill o">3rdhubvietnam.tech</span><span class="pill">3RDVN Technology</span></div></div>`;

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { localStorage.setItem('3rd-theme', 'light'); localStorage.setItem('3rd-lang', 'vi'); });
  const shots = {};
  for (const [slug, p] of Object.entries(seo.pages)) {
    if (!shots[p.shot]) {
      const pg = await ctx.newPage();
      await pg.goto(BASE + p.shot, { waitUntil: 'load' });
      await pg.waitForTimeout(4500);
      shots[p.shot] = (await pg.screenshot({ clip: { x: 690, y: 90, width: 750, height: 640 } })).toString('base64');
      await pg.close();
    }
    const pg = await ctx.newPage();
    await pg.setViewportSize({ width: 1200, height: 630 });
    await pg.setContent(card(p, shots[p.shot]), { waitUntil: 'networkidle' });
    await pg.waitForTimeout(400);
    await pg.screenshot({ path: path.join(outDir, (slug || 'home') + '.png') });
    await pg.close();
    console.log('og:', slug || 'home');
  }
  await b.close();
})();
