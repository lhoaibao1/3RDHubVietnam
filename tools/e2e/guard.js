// Thử tab "Chặn tấn công" của CMS: giả lập nginx báo request bị 429, IP bị tự cấm, cấm/bỏ cấm tay, cấm trình duyệt, danh sách luôn cho phép.
// Chạy backend với CSDL trống rồi: node tools/e2e/guard.js (ADMIN_URL, SITE_URL, OUT tuỳ chọn)
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const ADMIN = process.env.ADMIN_URL || 'http://cms.localhost:8787', SITE = process.env.SITE_URL || 'http://127.0.0.1:8787', OUT = process.env.OUT || '/tmp';
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const p = await ctx.newPage(); p.setDefaultTimeout(30000);
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  p.on('dialog', (d) => d.accept());
  const ok = (m) => console.log('✔', m);

  // nginx báo 429: 12 lần từ một IP (ngưỡng 10) → tự cấm; 200 lần từ nhiều IP cùng một trình duyệt (mỗi IP ≥5 lần) → cấm trình duyệt
  const hit = (ip, ua) => ctx.request.get(SITE + '/api/guard/strike', { headers: { 'X-Real-IP': ip, 'User-Agent': ua, 'Accept-Language': 'vi', 'X-Orig-URI': '/api/content' } });
  for (let i = 0; i < 12; i++) assert.strictEqual((await hit('198.51.100.22', 'Flood/1.0')).status(), 429);
  for (let r = 0; r < 6; r++) for (let n = 1; n <= 5; n++) for (let k = 0; k < 6; k++) await hit('203.0.113.' + n, 'BotNet/2.0');
  ok('nginx báo 429: trả 429 và backend ghi nhận');

  await p.goto(ADMIN + '/');
  await p.fill('#pw', 'matkhau-thu-nghiem'); await p.click('button[type=submit]');
  await p.waitForSelector('.shell');
  await p.click('button[data-tab=guard]');
  await p.waitForSelector('.gt');
  const bans = await p.locator('.panel', { hasText: 'Đang bị cấm' }).first().innerText();
  assert.ok(bans.includes('198.51.100.22'), 'IP bị cấm tự động phải hiện trong danh sách');
  assert.ok(bans.includes('BotNet/2.0'), 'trình duyệt bị cấm tự động phải hiện trong danh sách');
  ok('IP và trình duyệt bị tự cấm hiện trong CMS');
  await p.screenshot({ path: OUT + '/adm_guard.png', fullPage: true });

  // cấm tay, thử cấm IP của chính mình, bỏ cấm
  await p.fill('.gform input[type=text]', '127.0.0.1');
  await p.click('.gform .btn');
  await p.waitForSelector('.msg.err, .toast.bad');
  ok('không cho cấm IP của chính mình');
  await p.fill('.gform input[type=text]', '192.0.2.0/24'); await p.click('.gform .btn');
  await p.waitForFunction(() => document.body.innerText.includes('192.0.2.0/24'));
  const row = p.locator('.gt tr', { hasText: '192.0.2.0/24' });
  await row.locator('button').click();
  await p.waitForFunction(() => !document.body.innerText.includes('192.0.2.0/24'));
  ok('cấm tay một dải IP rồi bỏ cấm');

  // cấm trình duyệt từ danh sách "đang bị giới hạn"
  for (let i = 0; i < 3; i++) await hit('198.51.100.31', 'Scanner/3.1');
  await p.waitForSelector('tr:has-text("198.51.100.31")', { timeout: 20000 });
  await p.locator('tr', { hasText: '198.51.100.31' }).getByText('Cấm trình duyệt').click();
  await p.waitForFunction(() => /Trình duyệt\s*Scanner\/3\.1/.test(document.body.innerText.replace(/\n/g, '')));
  ok('cấm trình duyệt từ danh sách bị giới hạn');

  // cài đặt + luôn cho phép
  await p.fill('.gcfg input >> nth=0', '25');
  await p.fill('.panel:has-text("IP luôn cho phép") textarea', '198.51.100.0/24');
  await p.click('text=Lưu cài đặt');
  await p.waitForSelector('.toast');
  const state = () => p.evaluate(async () => (await fetch('/api/admin/guard', { headers: { 'X-CMS': '1' } })).json());
  const cfg = await state();
  assert.strictEqual(cfg.config.ip_strikes, 25); assert.deepStrictEqual(cfg.config.allow, ['198.51.100.0/24']);
  ok('lưu ngưỡng và danh sách luôn cho phép');
  for (let i = 0; i < 40; i++) await hit('198.51.100.99', 'Flood/1.0');
  const after = await state();
  assert.ok(!after.bans.some((x) => x.value === '198.51.100.99'), 'IP luôn cho phép không bị cấm');
  ok('IP trong danh sách luôn cho phép không bị cấm dù bị 429');
  assert.deepStrictEqual(errs, []);
  ok('không có lỗi JS');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
