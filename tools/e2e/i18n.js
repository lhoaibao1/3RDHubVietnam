// Kiểm tra bản tiếng Anh: liệt kê chữ tiếng Việt còn sót ở từng trang khi chọn EN.   BASE=http://127.0.0.1:8787 node tools/e2e/i18n.js
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const base = process.env.BASE || 'http://127.0.0.1:8787';
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto(base + '/', { waitUntil: 'load' });
  await p.click('.lang button[aria-label="English"]');
  for (const path of ['/', '/mo-hinh', '/advertiser', '/cong-nghe', '/doi-tac', '/hoi-dap', '/lien-he', '/dieu-khoan', '/bao-mat']) {
    await p.goto(base + path, { waitUntil: 'load' });
    await p.waitForTimeout(800);
    const left = await p.evaluate(() => {
      const VN = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
      const out = new Set();
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = w.nextNode())) {
        const t = n.nodeValue.trim();
        if (!t || !VN.test(t)) continue;
        const el = n.parentElement;
        if (el.closest('pre,code,.term,script,style')) continue;
        out.add(t.slice(0, 90));
      }
      document.querySelectorAll('[aria-label],[placeholder],[title]').forEach(e => {
        for (const a of ['aria-label', 'placeholder', 'title']) { const v = e.getAttribute(a); if (v && VN.test(v) && !e.closest('.term')) out.add('@' + a + ': ' + v.slice(0, 80)); }
      });
      return [...out];
    });
    console.log(path, left.length ? '\n  ' + left.join('\n  ') : 'OK');
  }
  console.log(errs.join('\n') || 'no errors');
  await b.close();
})();
