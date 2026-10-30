// Thử trang Đăng ký sản phẩm (/dang-ky) bằng trình duyệt thật, với 3RDHub giả.
// Chạy backend với HUB_MOCK=1 và HUB_SITE_KEY=<một chuỗi bất kỳ> rồi:
//   HUB_SITE_KEY=<chuỗi đó> node tools/e2e/register.js    (SITE_URL, OUT tuỳ chọn)
// Kiểm tra: số điện thoại sai, thiếu đồng ý, bẫy bot, 429, 401, trùng, mất mạng, chọn sẵn ?product=,
// giao diện 375px, và trình duyệt không bao giờ thấy HUB_SITE_KEY.
const { chromium } = require('playwright');
const assert = require('assert');
const fs = require('fs');
(async () => {
  const SITE = process.env.SITE_URL || 'http://127.0.0.1:8787', OUT = process.env.OUT || '/tmp';
  const KEY = process.env.HUB_SITE_KEY || '';
  const b = await chromium.launch();
  const ok = (m) => console.log('✔', m);
  const seen = [];
  const errs = [];
  async function page(w, h) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'vi-VN' });
    await ctx.addInitScript(() => { try { localStorage.setItem('3rd-lang', 'vi'); localStorage.setItem('3rd-consent', JSON.stringify({ analytics: false, at: Date.now() })) } catch {} });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errs.push(String(e)));
    p.on('response', async (r) => { try { seen.push(r.url() + ' ' + JSON.stringify(r.request().headers()) + ' ' + (await r.text())) } catch {} });
    return { ctx, p };
  }
  // chờ màn hình khởi động chung của site biến mất rồi mới chụp
  const closeCookie = async (p) => { await p.waitForFunction(() => { const b = document.getElementById('boot'); return !b || getComputedStyle(b).visibility === 'hidden' }); await p.waitForTimeout(500) };
  const fill = async (p, phone, consent = true) => {
    await p.fill('#rg-full_name', 'Nguyễn Văn A'); await p.fill('#rg-phone', phone);
    if (consent && !(await p.isChecked('#rg-consent'))) await p.check('#rg-consent');
  };

  // ---- máy tính: chọn sẵn sản phẩm theo ?product=, lỗi hiện dưới từng ô
  let { ctx, p } = await page(1440, 900);
  await p.goto(SITE + '/dang-ky?product=VPB-CC&utm_source=fb&ref=RD260001');
  await p.waitForFunction(() => document.querySelectorAll('#rg-product_code option').length > 1);
  await closeCookie(p);
  assert.strictEqual(await p.inputValue('#rg-product_code'), 'VPB-CC'); ok('chọn sẵn sản phẩm theo ?product=');
  await p.click('.rgform button[type=submit]');
  assert(await p.isVisible('#rg-e-full_name') && await p.isVisible('#rg-e-phone') && await p.isVisible('#rg-e-consent'));
  assert.strictEqual(await p.evaluate(() => document.activeElement.id), 'rg-full_name'); ok('bỏ trống: báo lỗi dưới ô, con trỏ về ô đầu tiên sai');
  await fill(p, '0212 345 678', false);
  await p.click('.rgform button[type=submit]');
  assert((await p.textContent('#rg-e-phone')).includes('10 chữ số')); ok('số điện thoại sai bị chặn ở trình duyệt');
  assert(await p.isVisible('#rg-e-consent')); ok('thiếu đồng ý bị chặn');
  await p.screenshot({ path: OUT + '/rg_desktop_errors.png' });

  // 429 từ 3RDHub, 401 (khoá sai) chỉ hiện lỗi chung
  await fill(p, '0900000429'); await p.click('.rgform button[type=submit]');
  await p.waitForFunction(() => document.querySelector('.rgform [role=alert]').textContent.trim() !== '');
  assert((await p.textContent('.rgform [role=alert]')).includes('quá nhiều lần')); ok('429: hiện câu của 3RDHub');
  await fill(p, '0900000401'); await p.click('.rgform button[type=submit]');
  await p.waitForFunction(() => document.querySelector('.rgform [role=alert]').textContent.includes('gián đoạn'));
  ok('401: khách chỉ thấy "tạm gián đoạn"');
  await fill(p, '0900000400'); await p.click('.rgform button[type=submit]');
  await p.waitForFunction(() => document.querySelector('.rgform [role=alert]').textContent.includes('vùng hỗ trợ'));
  ok('400 từ 3RDHub: hiện câu của 3RDHub');

  // mất mạng
  await ctx.setOffline(true);
  await fill(p, '0912345678'); await p.click('.rgform button[type=submit]');
  await p.waitForFunction(() => document.querySelector('.rgform [role=alert]').textContent.includes('mất kết nối'));
  assert(!(await p.isDisabled('.rgform button[type=submit]'))); ok('mất mạng: báo lỗi, nút mở lại để gửi lần nữa');
  await ctx.setOffline(false);

  // thành công (số có +84 và khoảng trắng)
  await fill(p, '+84 912 345 678'); await p.fill('#rg-province', 'Hồ Chí Minh');
  await p.click('.rgform button[type=submit]');
  await p.waitForSelector('.rgdone');
  const code = (await p.textContent('.rgcode b')).trim();
  assert(/^KH-\d{4}$/.test(code)); ok('gửi thành công, mã ' + code);
  assert.strictEqual(await p.evaluate(() => document.activeElement.textContent.trim()), 'Đã nhận đăng ký của bạn'); ok('con trỏ chuyển tới tiêu đề bước 2');
  assert.strictEqual(await p.getAttribute('.rgzalo a.btn', 'href'), 'https://zalo.me/147468245835855615');
  assert.strictEqual(await p.getAttribute('.rgzalo a.btn', 'target'), '_blank'); ok('nút Mở Zalo OA mở tab mới');
  assert((await p.textContent('.rgnote')).includes('Mã dùng được tới')); ok('ghi rõ hạn dùng mã');
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
  await p.click('.rgzalo button >> text=Chép mã');
  await p.waitForSelector('.rgcopied:has-text("Đã chép")');
  assert.strictEqual(await p.evaluate(() => navigator.clipboard.readText()), code); ok('Chép mã đúng vào bộ nhớ tạm');
  await p.screenshot({ path: OUT + '/rg_desktop_done.png' });
  await ctx.close();

  // ---- điện thoại 375px: trùng vẫn coi là thành công, không tràn ngang
  ({ ctx, p } = await page(375, 812));
  await p.goto(SITE + '/dang-ky?product=FE');
  await p.waitForFunction(() => document.querySelectorAll('#rg-product_code option').length > 1);
  await closeCookie(p);
  assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 375); ok('375px: không tràn ngang (bước 1)');
  await p.screenshot({ path: OUT + '/rg_mobile_form.png', fullPage: true });
  await fill(p, '0900000409'); await p.click('.rgform button[type=submit]');
  await p.waitForSelector('.rgdone'); ok('trùng (409 có data): hiện bước 2 với mã trả về');
  assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 375); ok('375px: không tràn ngang (bước 2)');
  await p.screenshot({ path: OUT + '/rg_mobile_done.png', fullPage: true });
  // bàn phím: Tab tới được hai nút
  const tabs = [];
  for (let i = 0; i < 40 && tabs.length < 60; i++) { await p.keyboard.press('Tab'); tabs.push(await p.evaluate(() => document.activeElement.textContent.trim())) }
  assert(tabs.includes('Chép mã') && tabs.includes('Mở Zalo OA')); ok('bàn phím: Tab tới được Chép mã và Mở Zalo OA');
  await ctx.close();

  // ---- bẫy bot: thành công giả, không gửi sang 3RDHub
  const r = await fetch(SITE + '/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Real-IP': '9.9.9.9' }, body: JSON.stringify({ full_name: 'Bot', phone: '1', website: 'http://spam' }) });
  assert.strictEqual(r.status, 201); ok('bẫy bot: trả thành công giả');

  // ---- khoá không bao giờ ra trình duyệt
  if (KEY) {
    assert(!seen.some((s) => s.includes(KEY)), 'khoá lọt ra phản hồi');
    const dir = __dirname + '/../../site/assets';
    for (const f of fs.readdirSync(dir)) assert(!fs.readFileSync(dir + '/' + f, 'utf8').includes(KEY), 'khoá trong ' + f);
    ok('HUB_SITE_KEY không có trong phản hồi mạng và bundle JS');
  }
  assert(!seen.some((s) => /zalo\.me\/.*access_token|oauth\.zaloapp/.test(s))); ok('trang không gọi API Zalo');
  if (errs.length) { console.log(errs); process.exit(1) }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1) });
