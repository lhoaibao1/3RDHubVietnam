// Tạo bộ favicon + ảnh chia sẻ mạng xã hội từ logo robot. Chạy: node make_assets.js  -> thư mục assets/
const { chromium } = require('playwright'); const fs = require('fs');
const mark = (bg, pad) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">${bg}<g transform="translate(32 32) scale(${1 - pad}) translate(-32 -32)"><rect x="11" y="17" width="42" height="30" rx="13" fill="none" stroke="#fff" stroke-width="4.4"/><rect x="22.5" y="25.5" width="5.6" height="13" rx="2.8" fill="#fff"/><path d="M35.5 35a6.6 6.6 0 0 1 11 0" stroke="#FF6A2B" stroke-width="4.4" fill="none" stroke-linecap="round"/></g></svg>`;
const ROUND = '<rect width="64" height="64" rx="15" fill="#0B2A6F"/>', FULL = '<rect width="64" height="64" fill="#0B2A6F"/>';
(async () => {
  fs.writeFileSync('assets/favicon.svg', mark(ROUND, 0).replace('width="100%" height="100%"', 'width="64" height="64"'));
  const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
  async function png(file, svg, size) {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
    await p.screenshot({ path: file, omitBackground: true });
  }
  await png('assets/apple-touch-icon.png', mark(FULL, .12), 180);
  await png('assets/icon-192.png', mark(FULL, .14), 192);
  await png('assets/icon-512.png', mark(FULL, .14), 512);
  for (const s of [16, 32, 48, 64]) await png(`assets/fav-${s}.png`, mark(ROUND, 0), s);
  // ảnh chia sẻ 1200x630
  await p.setViewportSize({ width: 1200, height: 630 });
  await p.setContent(`<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;800;900&display=swap">
  <body style="margin:0;width:1200px;height:630px;background:#F3F1EC;font-family:Nunito,system-ui,sans-serif;position:relative;overflow:hidden;color:#0B2A6F">
  <div style="position:absolute;right:-140px;top:-160px;width:640px;height:640px;border-radius:50%;background:radial-gradient(circle,#FFB38E 0%,rgba(255,179,142,0) 68%)"></div>
  <div style="position:absolute;left:-120px;bottom:-200px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,#BFD0F5 0%,rgba(191,208,245,0) 68%)"></div>
  <div style="position:absolute;left:84px;top:84px;display:flex;align-items:center;gap:22px"><div style="width:96px;height:96px">${mark(ROUND, 0)}</div><div style="font-size:50px;font-weight:900;letter-spacing:-.02em">3RDHub <span style="color:#FF6A2B">Vietnam</span></div></div>
  <div style="position:absolute;left:84px;top:236px;width:900px;font-size:84px;line-height:1.04;font-weight:900;letter-spacing:-.03em">Tiếp thị liên kết,<br><span style="color:#FF6A2B">minh bạch từng đồng.</span></div>
  <div style="position:absolute;left:84px;bottom:76px;font-size:30px;font-weight:700;color:#5B6279">Nền tảng của 3RDVN Technology · 3rdhubvietnam.tech</div></body>`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: 'assets/og-image.png' });
  await b.close();
})();
