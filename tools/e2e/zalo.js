// Thử toàn trình Zalo OA bằng trình duyệt thật, với 3RDHub và Zalo Open API giả (cổng 9911, mở trong script này).
// Chạy backend với:
//   ZALO_OA_TOKEN_URL=http://127.0.0.1:9911/hub/token ZALO_OA_SHARE_KEY=khoa-thu ZALO_WEBHOOK_SECRET=oa-secret-thu \
//   ZALO_OA_PUBLIC=1 ZALO_API_BASE=http://127.0.0.1:9911
// rồi: node tools/e2e/zalo.js   (SITE_URL, ADMIN_URL, OUT tuỳ chọn; mật khẩu CMS thử: matkhau-thu-nghiem)
// Luồng: khách gửi form → thấy mã + Chép mã + Mở Zalo OA → khách nhắn mã (webhook có chữ ký) → nhận tin xác nhận →
// CMS: kiểm tra token, thấy "Đã ghép Zalo", gửi tin cho khách. Kiểm tra token/khoá không lọt ra trình duyệt.
const { chromium } = require('playwright');
const assert = require('assert');
const http = require('http');
const crypto = require('crypto');
const SITE = process.env.SITE_URL || 'http://127.0.0.1:8787', ADMIN = process.env.ADMIN_URL || 'http://cms.localhost:8787', OUT = process.env.OUT || '/tmp';
const APP = '3689777608400566243', OA = '147468245835855615', SECRET = 'oa-secret-thu';
const sent = [], paths = [];
let tokenHits = 0;
const fake = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c });
  req.on('end', () => {
    paths.push(req.url);
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/hub/token') {
      tokenHits++;
      if (req.headers.authorization !== 'Token khoa-thu') { res.statusCode = 401; return res.end('{"error":{"code":"unauthorized"}}') }
      return res.end(JSON.stringify({ data: { access_token: 'TOKEN-BI-MAT-' + tokenHits, expires_at: new Date(Date.now() + 2 * 3600e3).toISOString().replace(/\.\d+Z$/, 'Z'), oa_id: OA } }));
    }
    if (req.url === '/v3.0/oa/message/cs') {
      const b = JSON.parse(body);
      sent.push({ uid: b.recipient.user_id, text: b.message.text, token: req.headers.access_token });
      return res.end('{"error":0,"message":"Success","data":{"message_id":"m"}}');
    }
    res.statusCode = 404; res.end('{}');
  });
});
const ok = (m) => console.log('✔', m);
const wait = async (what, fn) => { for (let i = 0; i < 100; i++) { if (fn()) return; await new Promise((r) => setTimeout(r, 50)) } throw new Error('hết thời gian chờ: ' + what) };
function webhook(uid, text, id) {
  const ts = String(Date.now());
  const body = JSON.stringify({ app_id: APP, sender: { id: uid }, user_id_by_app: '1', recipient: { id: OA }, event_name: 'user_send_text', message: { text, msg_id: id }, timestamp: ts });
  const mac = crypto.createHash('sha256').update(APP + body + ts + SECRET).digest('hex');
  return fetch(SITE + '/api/zalo/webhook', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-ZEvent-Signature': 'mac=' + mac }, body });
}

(async () => {
  await new Promise((r) => fake.listen(9911, '127.0.0.1', r));
  const b = await chromium.launch();
  const seen = [];
  const watch = (p) => p.on('response', async (r) => { try { seen.push(r.url() + ' ' + (await r.text())) } catch {} });

  // ---- khách (điện thoại 375px) gửi form liên hệ
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, locale: 'vi-VN' });
  await ctx.addInitScript(() => { try { localStorage.setItem('3rd-lang', 'vi'); localStorage.setItem('3rd-consent', JSON.stringify({ analytics: false, at: Date.now() })) } catch {} });
  const p = await ctx.newPage(); watch(p);
  await p.goto(SITE + '/lien-he');
  await p.waitForSelector('#form2');
  await p.fill('#g1', 'Khách Thử Zalo'); await p.fill('#g2', '0901 234 567');
  await p.click('#form2 button[type=submit]');
  await p.waitForSelector('.lzalo');
  const code = (await p.textContent('.lzc strong')).trim();
  assert(/^3R-\d{5}$/.test(code)); ok('khách thấy mã ' + code);
  assert.strictEqual(await p.getAttribute('.lzalo a.btn', 'href'), 'https://zalo.me/' + OA);
  assert.strictEqual(await p.getAttribute('.lzalo a.btn', 'target'), '_blank'); ok('nút Mở Zalo OA mở tab mới');
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: SITE });
  await p.click('.lzalo button >> text=Chép mã');
  await p.waitForSelector('.lzok:has-text("Đã chép")');
  assert.strictEqual(await p.evaluate(() => navigator.clipboard.readText()), code); ok('Chép mã đúng');
  assert.strictEqual(await p.evaluate(() => document.documentElement.scrollWidth), 375); ok('375px không tràn ngang');
  await p.locator('.lzalo').scrollIntoViewIfNeeded();
  await p.screenshot({ path: OUT + '/zalo_khach_375.png' });

  // ---- khách nhắn mã vào OA (webhook có chữ ký) → nhận tin xác nhận
  const bad = await fetch(SITE + '/api/zalo/webhook', { method: 'POST', headers: { 'X-ZEvent-Signature': 'mac=00' }, body: JSON.stringify({ app_id: APP, event_name: 'user_send_text', timestamp: '1' }) });
  assert.strictEqual(bad.status, 401); ok('webhook sai chữ ký bị từ chối');
  assert.strictEqual((await webhook('uid-thu-1', 'mã của em ' + code.toLowerCase(), 'w1')).status, 200);
  await wait('tin xác nhận', () => sent.length === 1);
  assert(sent[0].uid === 'uid-thu-1' && sent[0].text.includes(code)); ok('khách nhận tin xác nhận: "' + sent[0].text.slice(0, 60) + '…"');

  // ---- CMS
  const adm = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const a = await adm.newPage(); watch(a);
  a.on('dialog', (d) => d.accept());
  await a.goto(ADMIN + '/');
  await a.fill('#pw', 'matkhau-thu-nghiem'); await a.click('button[type=submit]');
  await a.waitForSelector('.shell');
  await a.click('button[data-tab=email]');
  await a.waitForSelector('text=Zalo OA: tin cho khách');
  await a.click('button >> text=Kiểm tra token');
  await a.waitForSelector('.zgrid b.okc >> text=Còn hạn tới');
  ok('CMS: kiểm tra token thành công, khách đã ghép = ' + (await a.locator('.zgrid > div:has-text("Khách đã ghép") b').textContent()));
  await a.locator('h2:has-text("Zalo OA: tin cho khách")').scrollIntoViewIfNeeded();
  await a.screenshot({ path: OUT + '/zalo_cms_trangthai.png' });
  await a.click('button[data-tab=leads]');
  await a.waitForSelector('.lead');
  await a.click('.lead .hd >> text=Khách Thử Zalo');
  await a.waitForSelector('.lead.open .tag.ok >> text=Đã ghép Zalo'); ok('CMS: yêu cầu hiện "Đã ghép Zalo"');
  await a.fill('.lead.open .zsend textarea', 'Chào anh/chị, hồ sơ đã được tiếp nhận.');
  await a.click('.lead.open .zsend button');
  await wait('tin từ CMS', () => sent.length === 2);
  assert(sent[1].uid === 'uid-thu-1' && sent[1].text.includes('đã được tiếp nhận')); ok('CMS: gửi tin Zalo cho khách');
  await a.screenshot({ path: OUT + '/zalo_cms_yeucau.png' });

  // ---- an toàn
  assert(!seen.some((s) => s.includes('TOKEN-BI-MAT') || s.includes('khoa-thu') || s.includes(SECRET) || s.includes('uid-thu-1')), 'token/khoá/uid lọt ra trình duyệt');
  ok('token, khoá, Zalo user id không lọt ra trình duyệt');
  assert(tokenHits === 1 || tokenHits === 2, 'token phải được giữ trong bộ nhớ'); ok('3RDHub chỉ bị hỏi token ' + tokenHits + ' lần (lần 2 là nút Kiểm tra token)');
  assert(!paths.some((x) => /oauth|access_token/.test(x))); ok('không gọi API làm mới token');
  await b.close(); fake.close();
})().catch((e) => { console.error(e); process.exit(1) });
