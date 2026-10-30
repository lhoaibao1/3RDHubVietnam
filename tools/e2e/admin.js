// Thử toàn trình bằng trình duyệt thật (Playwright): đăng nhập CMS, sửa chữ/hỏi đáp/cài đặt, kiểm tra website, gửi form, lịch sử.
// Chạy backend với CSDL trống rồi:  node tools/e2e/admin.js   (ADMIN_URL, SITE_URL, OUT tuỳ chọn). Mật khẩu thử: matkhau-thu-nghiem
const { chromium } = require('playwright');
const assert = require('assert');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ADMIN = process.env.ADMIN_URL || 'http://cms.localhost:8787', SITE = process.env.SITE_URL || 'http://127.0.0.1:8787';
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERROR ' + e));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()) });
  p.on('dialog', d => d.accept());
  const ok = (m) => console.log('✔', m);

  // đăng nhập sai rồi đúng
  await p.goto(ADMIN + '/');
  await p.waitForSelector('#pw');
  await p.fill('#pw', 'sai-mat-khau'); await p.click('button[type=submit]');
  await p.waitForSelector('.msg.err');
  ok('đăng nhập sai bị từ chối: ' + await p.textContent('.msg.err'));
  await p.fill('#pw', 'matkhau-thu-nghiem'); await p.click('button[type=submit]');
  await p.waitForSelector('.shell');
  ok('đăng nhập đúng vào được trang quản trị');
  await p.screenshot({ path: '' + (process.env.OUT || '/tmp') + '/adm_dash.png' });

  // sửa chữ
  await p.click('button[data-tab=text]');
  await p.fill('input[type=search]', 'Đăng ký ngay');
  await p.waitForSelector('.trow');
  const first = p.locator('.trow').first();
  const vi = first.locator('textarea').nth(0), en = first.locator('textarea').nth(1);
  await vi.fill('Tham gia ngay'); await en.fill('Join now');
  await p.waitForSelector('.savebar.on');
  ok('sửa chữ làm hiện thanh lưu');
  await p.screenshot({ path: '' + (process.env.OUT || '/tmp') + '/adm_text.png' });
  await p.click('.savebar .save');
  await p.waitForSelector('.toast');
  await p.waitForSelector('.savebar:not(.on)', { state: 'attached' });
  ok('lưu thành công: ' + await p.textContent('.toast'));

  // hỏi đáp: thêm câu hỏi hiện ở trang chủ
  await p.click('button[data-tab=faq]');
  await p.click('text=+ Thêm câu hỏi');
  const item = p.locator('.item.open');
  const inputs = item.locator('input[type=text]');
  await inputs.nth(2).fill('Câu hỏi thử nghiệm?'); await inputs.nth(3).fill('Test question?');
  await item.locator('textarea').nth(0).fill('Đây là câu trả lời thử.\nDòng hai.'); await item.locator('textarea').nth(1).fill('This is a test answer.');
  await item.locator('input[type=checkbox]').check();
  await p.click('.savebar .save'); await p.waitForSelector('.savebar:not(.on)', { state: 'attached' });
  ok('thêm hỏi đáp');

  // liên hệ, giao diện 3D, cài đặt chung: mỗi việc một tab
  const F = (label) => p.locator('label.f', { hasText: label }).locator('input,textarea').first();
  await p.click('button[data-tab=company]');
  await F('Số hotline (hiển thị)').fill('(+84) 900 111 222');
  await F('Số hotline (để bấm gọi)').fill('+84900111222');
  await p.click('button[data-tab=look]');
  await p.click('.scene:has-text("Nhà máy tự động") .pick');
  await p.click('button[data-tab=company]');
  await F('Facebook').fill('https://facebook.com/3rdhub');
  await F('Tên công ty').fill('Công ty Thử Nghiệm');
  await p.click('button[data-tab=seo]');
  await F('Mã Google Analytics').fill('G-ABCDE12345');
  await p.click('.savebar .save'); await p.waitForSelector('.savebar:not(.on)', { state: 'attached' });
  ok('lưu cài đặt');
  await p.click('button[data-tab=email]');
  await p.waitForFunction(() => document.querySelector('input[autocomplete=off]') && document.querySelector('input[autocomplete=off]').value !== '');
  assert.strictEqual(await p.locator('input[autocomplete=off]').first().inputValue(), 'mail.3rdhubvietnam.tech'); ok('SMTP: có sẵn cấu hình iNET, chưa có mật khẩu');
  await p.click('button[data-tab=quote]');
  assert.strictEqual(await p.locator('.panel h2', { hasText: /^Gói \d/ }).count(), 3); ok('báo giá: có 3 gói mặc định để sửa');
  // sửa trực tiếp trên trang: bấm vào chữ trong khung website, sửa ở cột bên phải, khung đổi chữ ngay
  await p.click('button[data-tab=live]');
  const fr = p.frameLocator('.lv-frame iframe');
  await fr.locator('.k2', { hasText: 'Sản phẩm' }).first().waitFor({ timeout: 20000 });
  await fr.locator('.biz .k2').first().click();
  await p.waitForSelector('.lv-side textarea');
  await p.locator('.lv-side textarea').first().fill('Sản phẩm của chúng tôi');
  await fr.locator('.biz .k2', { hasText: 'Sản phẩm của chúng tôi' }).waitFor({ timeout: 5000 });
  ok('sửa trên trang: bấm chữ trên website, sửa và thấy ngay');
  await p.click('.savebar .discard, .savebar .btn.gh').catch(() => {});
  await p.screenshot({ path: '' + (process.env.OUT || '/tmp') + '/adm_settings.png' });

  // kiểm tra website công khai nhận thay đổi (ngữ cảnh mới, không cache)
  const s = await (await b.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' })).newPage();
  s.on('pageerror', e => errs.push('SITE PAGEERROR ' + e));
  await s.goto(SITE + '/'); await s.waitForTimeout(1500);
  await s.waitForSelector('.cbar', { timeout: 6000 }); ok('cookie: thông báo hiện ở lần đầu vào site');
  assert.strictEqual(await s.locator('script[src*="googletagmanager"]').count(), 0); ok('cookie: chưa đồng ý thì chưa nạp Google Analytics');
  await s.click('.cbar .btn.or'); await s.waitForTimeout(600);
  assert.strictEqual(await s.locator('.cbar').count(), 0);
  assert.strictEqual(await s.locator('script[src*="googletagmanager"]').count(), 1); ok('cookie: bấm đồng ý thì ẩn thông báo và nạp Google Analytics');
  await s.reload(); await s.waitForTimeout(2500);
  assert.strictEqual(await s.locator('.cbar').count(), 0); ok('cookie: nhớ lựa chọn sau khi tải lại');
  await s.click('.ftcookie'); await s.waitForSelector('.cbar .cbd'); ok('cookie: nút Cài đặt cookie ở chân trang mở lại tuỳ chọn');
  await s.click('.cbar .btn.gh >> text=Chỉ cần thiết'); await s.waitForTimeout(500);
  assert.strictEqual((await s.textContent('.nav .btn.or')).trim(), 'Tham gia ngay'); ok('website: nút nav đã đổi thành "Tham gia ngay"');
  await s.click('.langbtn'); await s.waitForTimeout(700);
  assert.strictEqual((await s.textContent('.nav .btn.or')).trim(), 'Join now'); ok('website: bản EN = "Join now"');
  await s.click('.langbtn'); await s.waitForTimeout(700);
  const foot = await s.textContent('footer');
  assert(foot.includes('(+84) 900 111 222') && foot.includes('Công ty Thử Nghiệm'), 'footer'); ok('website: chân trang lấy hotline và tên công ty mới');
  assert(await s.locator('footer .ftsoc a[href="https://facebook.com/3rdhub"]').count() === 1); ok('website: có icon Facebook ở chân trang');
  assert(await s.locator('.story.night').count() === 1, 'kiểu 3D nhà máy'); ok('website: kiểu cảnh 3D chọn trong CMS được áp dụng');
  await s.goto(SITE + '/baogia'); await s.waitForSelector('.plan'); assert.strictEqual(await s.locator('.plan').count(), 3); ok('website: trang /baogia hiện 3 gói');
  await s.goto(SITE + '/'); await s.waitForTimeout(1200);
  assert(await s.locator('a[href="tel:+84900111222"]').count() > 0); ok('website: link gọi dùng số mới');
  assert((await s.textContent('#faq')).includes('Câu hỏi thử nghiệm?')); ok('website: câu hỏi mới hiện ở trang chủ');
  await s.goto(SITE + '/hoi-dap'); await s.waitForTimeout(800);
  assert((await s.textContent('#p-hoi-dap')).includes('Câu hỏi thử nghiệm?')); ok('trang Hỏi đáp có câu mới');
  await s.fill('#p-hoi-dap input[type=search]', 'rut tien');
  const n = await s.locator('#p-hoi-dap .fq2 details').count(); assert(n >= 1, 'search không dấu'); ok('tìm kiếm không dấu "rut tien" ra ' + n + ' câu');

  // gửi form liên hệ
  await s.goto(SITE + '/lien-he'); await s.waitForTimeout(800);
  await s.fill('#g1', 'Nguyễn Văn Thử'); await s.fill('#g2', '0901234567'); await s.fill('#g3', 'Công ty ABC'); await s.fill('#g4', 'Muốn chạy chiến dịch');
  await s.click('#form2 button[type=submit]');
  await s.waitForSelector('#form2 .msg.ok'); ok('gửi form: ' + await s.textContent('#form2 .msg'));

  // quản trị thấy yêu cầu mới
  await p.click('button[data-tab=leads]');
  await p.waitForSelector('.lead.new');
  assert((await p.textContent('.lead.new')).includes('Nguyễn Văn Thử')); ok('quản trị thấy yêu cầu mới');
  await p.click('.lead.new .hd');
  await p.selectOption('.lead.open select', 'contacted');
  await p.waitForTimeout(500);
  await p.screenshot({ path: '' + (process.env.OUT || '/tmp') + '/adm_leads.png' });
  ok('đổi trạng thái yêu cầu');

  // lịch sử: khôi phục bản đầu
  await p.click('button[data-tab=history]');
  await p.waitForSelector('.hist');
  const nrev = await p.locator('.hist').count();
  await p.locator('.hist button').last().click();
  await p.waitForSelector('.toast');
  ok('lịch sử có ' + nrev + ' bản, khôi phục bản cũ nhất');
  await s.goto(SITE + '/'); await s.waitForTimeout(1200);
  await p.screenshot({ path: '' + (process.env.OUT || '/tmp') + '/adm_history.png' });

  // đăng xuất
  await p.click('text=Đăng xuất'); await p.waitForSelector('#pw'); ok('đăng xuất');
  console.log(errs.join('\n') || 'không có lỗi JS');
  await b.close();
})().catch(e => { console.error('FAIL', e); process.exit(1) });
