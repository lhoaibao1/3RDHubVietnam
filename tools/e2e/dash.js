// Thử trang Tổng quan: ghi lượt xem qua /api/hit (như trình duyệt khách), kiểm tra số liệu, đổi khoảng thời gian, xem dạng bảng, tooltip, di động.
// Chạy backend với CSDL trống rồi: node tools/e2e/dash.js (ADMIN_URL, SITE_URL, OUT tuỳ chọn)
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const ADMIN = process.env.ADMIN_URL || 'http://cms.localhost:8787', SITE = process.env.SITE_URL || 'http://127.0.0.1:8787', OUT = process.env.OUT || '/tmp';
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const p = await ctx.newPage(); p.setDefaultTimeout(30000);
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const ok = (m) => console.log('✔', m);
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36';
  for (let i = 0; i < 12; i++) await ctx.request.post(SITE + '/api/hit', { headers: { 'User-Agent': UA, 'X-Real-IP': '10.8.0.' + (i % 4 + 1), 'CF-IPCountry': 'VN' }, data: { p: i % 2 ? '/san-pham' : '/', l: 'vi', r: i === 0 ? 'https://www.google.com/' : '', w: 1440 } });
  await ctx.request.post(SITE + '/api/hit', { headers: { 'User-Agent': 'Googlebot/2.1' }, data: { p: '/', l: 'vi' } });

  await p.goto(ADMIN + '/'); await p.fill('#pw', 'matkhau-thu-nghiem'); await p.click('button[type=submit]'); await p.waitForSelector('.shell');
  await p.waitForSelector('.kpis');
  const kv = await p.locator('.kv').allInnerTexts();
  assert.strictEqual(kv[0], '12'); assert.strictEqual(kv[1], '4');
  ok('Tổng quan: 12 lượt xem, 4 khách; bot không được tính');
  assert.ok((await p.locator('.live').innerText()).includes('4 đang online'));
  assert.ok((await p.innerText('.g2c')).includes('google.com'));
  ok('nguồn truy cập và số đang online');
  await p.hover('.chart svg', { position: { x: 700, y: 120 } });
  await p.waitForSelector('.tip');
  ok('di chuột lên biểu đồ hiện chú thích (tooltip)');
  for (const lbl of ['Hôm nay', '30 ngày', '90 ngày', '7 ngày']) { await p.click(`.chips button:has-text("${lbl}")`); await p.waitForTimeout(500); }
  await p.click('text=Xem dạng bảng'); await p.waitForSelector('.tw table');
  assert.ok((await p.locator('.tw tbody tr').count()) >= 7);
  await p.click('text=Xem biểu đồ');
  ok('đổi khoảng thời gian và xem dạng bảng');
  await p.screenshot({ path: OUT + '/adm_dash.png', fullPage: true });
  await p.locator('.sys button').nth(2).click(); await p.waitForSelector('.gst');
  ok('bấm vào hệ thống chuyển sang tab Chặn tấn công');

  const m = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })).newPage();
  await m.goto(ADMIN + '/'); await m.fill('#pw', 'matkhau-thu-nghiem'); await m.click('button[type=submit]'); await m.waitForSelector('.kpis');
  const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(over <= 1, 'tràn ngang ' + over);
  ok('điện thoại 390px không tràn ngang');
  assert.deepStrictEqual(errs, []);
  ok('không có lỗi JS');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
