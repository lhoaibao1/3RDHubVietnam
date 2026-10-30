// Thử tab "Nền từng trang" và "Hiệu ứng cuộn" của CMS: đổi nền một khu vực + chọn hiệu ứng, lưu, kiểm tra website áp dụng,
// và hiệu ứng chạy cả khi cuộn lên. Chạy backend với CSDL trống rồi: node tools/e2e/look.js (ADMIN_URL, SITE_URL, OUT tuỳ chọn)
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ADMIN = process.env.ADMIN_URL || 'http://cms.localhost:8787', SITE = process.env.SITE_URL || 'http://127.0.0.1:8787', OUT = process.env.OUT || '/tmp';
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e));
  const ok = (m) => console.log('✔', m);

  await p.goto(ADMIN + '/');
  await p.fill('#pw', 'matkhau-thu-nghiem'); await p.click('button[type=submit]');
  await p.waitForSelector('.shell');

  await p.click('button[data-tab=bg]');
  await p.waitForSelector('.bgarea');
  assert.strictEqual(await p.locator('.bgarea').count(), 15);
  const sp = p.locator('.bgarea', { hasText: 'Sản phẩm' }).first();
  await sp.locator('select').selectOption('dots');
  await sp.locator('input[type=color]').first().evaluate((el) => { el.value = '#ff0000'; el.dispatchEvent(new Event('input', { bubbles: true })) });
  await p.screenshot({ path: OUT + '/adm_bg.png', fullPage: true });
  ok('đổi nền trang Sản phẩm thành chấm nhỏ, màu đỏ');

  await p.click('button[data-tab=look]');
  await p.waitForSelector('.fx');
  await p.locator('.fx', { hasText: 'Lật 3D' }).locator('.pick').click();
  await p.screenshot({ path: OUT + '/adm_fx.png', fullPage: true });
  await p.click('.savebar .save');
  await p.waitForSelector('.toast');
  ok('lưu: ' + await p.textContent('.toast'));

  const s = await (await p.request.get(SITE + '/api/content')).json();
  assert.strictEqual(s.settings['bg_san-pham'], 'dots|#ff0000|#7B4DFF');
  assert.strictEqual(s.settings.scroll_fx, 'flip');
  ok('server lưu đúng cài đặt');

  const w = await ctx.newPage();
  await w.goto(SITE + '/san-pham', { waitUntil: 'networkidle' });
  await w.waitForTimeout(600);
  assert.strictEqual(await w.evaluate(() => document.documentElement.dataset.fx), 'flip');
  const pat = await w.evaluate(() => getComputedStyle(document.querySelector('#p-san-pham')).getPropertyValue('--bt').trim());
  assert.strictEqual(pat.toLowerCase(), '#ff0000');
  ok('website dùng nền mới và hiệu ứng lật 3D');

  // cuộn xuống rồi lên: khối đã qua phía trên được ẩn lại và hiện lại khi cuộn lên
  const el = w.locator('.rv').nth(4);
  await el.scrollIntoViewIfNeeded(); await w.waitForTimeout(400);
  assert.ok(await el.evaluate((e) => e.classList.contains('in')));
  await w.evaluate(() => scrollTo(0, document.body.scrollHeight)); await w.waitForTimeout(500);
  assert.ok(await el.evaluate((e) => !e.classList.contains('in') && e.classList.contains('up')), 'khối phía trên phải ẩn lại');
  await el.scrollIntoViewIfNeeded(); await w.waitForTimeout(400);
  assert.ok(await el.evaluate((e) => e.classList.contains('in')));
  ok('hiệu ứng chạy cả khi cuộn lên');

  // xem thử ?fx= không cần lưu
  await w.goto(SITE + '/?fx=blur', { waitUntil: 'networkidle' });
  assert.strictEqual(await w.evaluate(() => document.documentElement.dataset.fx), 'blur');
  await w.goto(SITE + '/?fx=off', { waitUntil: 'networkidle' });
  ok('xem thử ?fx=blur');

  assert.deepStrictEqual(errs, []);
  ok('không có lỗi JS');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
