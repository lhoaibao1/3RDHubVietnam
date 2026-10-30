// Thử các trang chính sách (hồ sơ thông báo website với Bộ Công Thương) và tải PDF bằng trình duyệt thật.
// Chạy backend rồi: node tools/e2e/policies.js   (SITE_URL, OUT tuỳ chọn). Cần pdftotext (poppler-utils).
const { chromium } = require('playwright');
const assert = require('assert');
const { execFileSync } = require('child_process');
const SITE = process.env.SITE_URL || 'http://127.0.0.1:8787', OUT = process.env.OUT || '/tmp';
const ok = (m) => console.log('✔', m);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: 'vi-VN', acceptDownloads: true });
  await ctx.addInitScript(() => { try { localStorage.setItem('3rd-lang', 'vi'); localStorage.setItem('3rd-consent', JSON.stringify({ analytics: false, at: Date.now() })) } catch {} });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(String(e)));
  const text = async (dl) => { const f = OUT + '/' + dl.suggestedFilename(); await dl.saveAs(f); return execFileSync('pdftotext', [f, '-']).toString() };

  await p.goto(SITE + '/chinh-sach'); await p.waitForSelector('.polist li');
  assert.strictEqual(await p.locator('.polist li').count(), 8); ok('/chinh-sach: 8 chính sách');
  await p.screenshot({ path: OUT + '/cs_list.png', fullPage: true });
  let [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Tải tất cả (1 file PDF)')]);
  let t = await text(dl);
  for (const s of ['Chính sách bảo mật', 'Chính sách tiếp nhận và giải quyết khiếu nại', 'Chính sách giá', 'Chính sách thanh toán', 'Điều kiện và hạn chế cung cấp dịch vụ', 'Chính sách cung cấp, chấm dứt dịch vụ và hoàn tiền', 'Hỗ trợ trực tuyến', 'Điều khoản sử dụng', '4001342613'])
    assert(t.includes(s), 'thiếu trong PDF tổng hợp: ' + s);
  ok('tải tất cả: ' + dl.suggestedFilename() + ' có đủ 8 chính sách');

  for (const [slug, must] of [['bao-mat', 'Đơn vị kiểm soát dữ liệu'], ['khieu-nai', '07 ngày làm việc'], ['chinh-sach-gia', '15.000.000 VNĐ'], ['chinh-sach-thanh-toan', 'Chuyển khoản ngân hàng'], ['dieu-kien-dich-vu', 'Hạn chế và từ chối'], ['cung-cap-va-hoan-tien', 'Hoàn tiền'], ['ho-tro', 'Thời gian hỗ trợ'], ['dieu-khoan', 'Đơn vị vận hành']]) {
    await p.goto(SITE + '/' + slug); await p.waitForSelector('.lbody h2');
    assert((await p.textContent('.lbody')).includes(must), slug + ': trang thiếu ' + must);
    assert(!(await p.textContent('.lbody')).includes('{{'), slug + ': còn mã chưa thay');
    [dl] = await Promise.all([p.waitForEvent('download'), p.click('.lacts a:has-text("Tải PDF")')]);
    t = await text(dl);
    assert(t.replace(/\s+/g, ' ').includes(must), slug + ': PDF thiếu ' + must);
    ok('/' + slug + ': trang và PDF (' + dl.suggestedFilename() + ')');
  }
  await p.goto(SITE + '/chinh-sach-gia'); await p.waitForSelector('.lbody');
  await p.screenshot({ path: OUT + '/cs_gia.png' });
  await p.goto(SITE + '/baogia'); await p.waitForSelector('.pnote');
  assert((await p.textContent('.pnote')).includes('chưa bao gồm thuế GTGT')); ok('/baogia: ghi chú thuế và phí dưới bảng giá');
  await p.goto(SITE + '/'); await p.waitForSelector('footer a[href="/chinh-sach"]'); ok('chân trang có liên kết Các chính sách');

  const m = await b.newPage({ viewport: { width: 375, height: 812 } });
  await m.goto(SITE + '/chinh-sach'); await m.waitForSelector('.polist li');
  assert.strictEqual(await m.evaluate(() => document.documentElement.scrollWidth), 375); ok('375px không tràn ngang');
  await m.waitForTimeout(800); await m.screenshot({ path: OUT + '/cs_mobile.png' }).catch(() => {});
  if (errs.length) { console.log(errs); process.exit(1) }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1) });
