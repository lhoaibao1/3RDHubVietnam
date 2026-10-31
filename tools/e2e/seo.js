// Thử tab SEO của CMS: dán thẻ xác minh Google, sửa tiêu đề/mô tả trang Sản phẩm, lưu; kiểm tra HTML trả về (chưa chạy JS)
// có thẻ mới, trang khác vẫn giữ bản mặc định, trang Hỏi đáp có FAQPage, sitemap/robots đúng.
// Chạy backend với CSDL trống rồi: node tools/e2e/seo.js (ADMIN_URL, SITE_URL tuỳ chọn; NGX_URL = nginx có SSI để thử thêm)
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch();
  const ADMIN = process.env.ADMIN_URL || 'http://cms.localhost:8787', SITE = process.env.SITE_URL || 'http://127.0.0.1:8787', OUT = process.env.OUT || '/tmp';
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e));
  const ok = (m) => console.log('✔', m);

  await p.goto(ADMIN + '/');
  await p.fill('#pw', 'matkhau-thu-nghiem'); await p.click('button[type=submit]');
  await p.waitForSelector('.shell');
  await p.click('button[data-tab=seo]');
  await p.waitForSelector('.seop');
  assert.strictEqual(await p.locator('.seop').count(), 19);
  const g = p.locator('.seov label', { hasText: 'Google Search Console' }).first().locator('input');
  await g.fill('<meta name="google-site-verification" content="AbC123_xyz-TEST" />'); await g.press('Tab');
  const sp = p.locator('.seop', { hasText: 'Mail Server' }).first();
  await sp.locator('.seoh').click();
  await sp.locator('input[type=text]').fill('Phần mềm SaaS & CRM cho doanh nghiệp | 3RDHub');
  await sp.locator('textarea').fill('Mô tả "mới" cho trang sản phẩm <thử>');
  await p.screenshot({ path: OUT + '/adm_seo.png', fullPage: true });
  await p.click('.savebar .save');
  const toast = await (await p.waitForSelector('.toast')).textContent();
  ok('lưu: ' + toast);
  assert.ok(!/Đã lưu/.test(toast), 'mô tả có dấu < > phải bị từ chối');
  await p.waitForSelector('.toast', { state: 'detached' }).catch(() => {});
  await p.locator('.seop.on textarea').fill('Mô tả "mới" cho trang sản phẩm');
  await p.click('.savebar .save'); await p.waitForTimeout(1000);
  const st = await (await p.request.get(SITE + '/api/content')).json();
  assert.strictEqual(st.settings['seod_san-pham'], 'Mô tả "mới" cho trang sản phẩm');
  ok('mô tả có dấu < > bị từ chối, sửa lại thì lưu được');
  assert.strictEqual(st.settings.verify_google, 'AbC123_xyz-TEST');
  ok('mã Google lấy đúng từ nguyên thẻ meta');

  for (const base of [SITE, process.env.NGX_URL].filter(Boolean)) {
    const h = await (await p.request.get(base + '/san-pham')).text();
    assert.ok(h.includes('<title>Phần mềm SaaS &amp; CRM cho doanh nghiệp | 3RDHub</title>'), 'tiêu đề mới');
    assert.ok(h.includes('<meta property="og:title" content="Phần mềm SaaS &amp; CRM cho doanh nghiệp | 3RDHub">'));
    assert.ok(h.includes('content="Mô tả &#34;mới&#34; cho trang sản phẩm"'), 'mô tả mới');
    assert.strictEqual((h.match(/<title>/g) || []).length, 1, 'chỉ một thẻ title');
    assert.strictEqual((h.match(/name="description"/g) || []).length, 1);
    assert.ok(h.includes('<meta name="google-site-verification" content="AbC123_xyz-TEST">'));
    assert.ok(!h.includes('<!--#'), 'không lộ lệnh SSI');
    assert.ok(h.includes('class="seedpg"') && h.includes('<h1>'), 'có nội dung dựng sẵn');
    const o = await (await p.request.get(base + '/mo-hinh')).text();
    assert.ok(o.includes('<title>Mô hình hoạt động | 3RDHub Vietnam</title>'), 'trang khác giữ mặc định');
    assert.ok(o.includes('google-site-verification'), 'mã xác minh có ở mọi trang');
    const f = await (await p.request.get(base + '/hoi-dap')).text();
    assert.ok(f.includes('"@type":"FAQPage"'), 'FAQPage');
    ok(base + ': HTML gốc có tiêu đề, mô tả, mã xác minh mới; FAQPage; trang khác giữ mặc định');
  }
  const sm = await (await p.request.get(SITE + '/sitemap.xml')).text();
  assert.strictEqual((sm.match(/<loc>/g) || []).length, 38); assert.strictEqual((sm.match(/<image:loc>/g) || []).length, 38);
  const rb = await (await p.request.get(SITE + '/robots.txt')).text();
  assert.ok(rb.includes('Sitemap: ') && rb.includes('Disallow: /api/'));
  ok('sitemap 19 trang x 2 ngôn ngữ kèm ảnh, robots.txt');

  // khi chạy JS: tiêu đề tab đúng theo CMS
  const w = await p.context().newPage();
  await w.goto(SITE + '/san-pham', { waitUntil: 'networkidle' });
  await w.waitForTimeout(500);
  assert.strictEqual(await w.title(), 'Phần mềm SaaS & CRM cho doanh nghiệp | 3RDHub');
  await w.goto(SITE + '/hoi-dap', { waitUntil: 'networkidle' });
  const def = require('../../web/scripts/seo.json').pages['hoi-dap'].title;
  assert.strictEqual(await w.title(), def);
  ok('tiêu đề tab sau khi chạy JS đúng theo CMS và mặc định từng trang');
  assert.deepStrictEqual(errs, []);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
