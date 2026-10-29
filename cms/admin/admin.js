/* 3RDHub CMS: trang quản trị (vanilla JS, không phụ thuộc thư viện ngoài) */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var S = { tab: 'dash', content: null, saved: null, defaults: null, strings: null, leads: {}, updated: 0, dirty: false,
    text: { q: '', g: '*', only: false, page: 0 }, leadsList: [], lf: { status: '', q: '' }, openFaq: {}, user: false };
  var PAGE = 30;
  var LABEL = { new: 'Mới', contacted: 'Đã liên hệ', done: 'Hoàn tất', spam: 'Spam' };

  /* ---------- tiện ích ---------- */
  function h(tag, props) {
    var e = document.createElement(tag), kids = Array.prototype.slice.call(arguments, 2);
    for (var k in (props || {})) {
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else if (k === 'disabled') e.disabled = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    (function add(list) {
      list.forEach(function (c) {
        if (c == null || c === false) return;
        if (Array.isArray(c)) return add(c);
        e.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
      });
    })(kids);
    return e;
  }
  function icon(path) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '2'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = path; return s;
  }
  var ICONS = {
    dash: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    text: '<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    faq: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
    partners: '<path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4"/>',
    leads: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    legal: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'
  };
  var TABS = [['dash', 'Tổng quan'], ['text', 'Nội dung chữ'], ['faq', 'Hỏi đáp'], ['partners', 'Đối tác'], ['legal', 'Trang pháp lý'], ['leads', 'Yêu cầu khách'], ['settings', 'Cài đặt'], ['history', 'Lịch sử']];

  function api(method, path, body, raw) {
    var opt = { method: method, credentials: 'same-origin', headers: { 'X-CMS': '1' } };
    if (raw) { opt.body = raw.body; for (var k in raw.headers) opt.headers[k] = raw.headers[k]; }
    else if (body !== undefined) { opt.body = JSON.stringify(body); opt.headers['Content-Type'] = 'application/json'; }
    return fetch('/api/admin/' + path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.status === 401 && path !== 'login') { S.user = false; renderLogin(); throw new Error('Phiên đăng nhập đã hết, hãy đăng nhập lại.'); }
        if (!r.ok) throw new Error(j.error || ('Lỗi ' + r.status));
        return j;
      });
    });
  }
  var toastT;
  function toast(msg, bad) {
    var t = document.querySelector('.toast'); if (t) t.remove();
    t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, msg); document.body.appendChild(t);
    clearTimeout(toastT); toastT = setTimeout(function () { t.remove(); }, bad ? 6000 : 3200);
  }
  function fmt(ts) { return new Date(ts * 1000).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  function grow(t) { t.style.height = 'auto'; t.style.height = Math.max(44, t.scrollHeight + 2) + 'px'; }
  function ta(value, on) { var t = h('textarea', { rows: 1, value: value, oninput: function () { grow(t); on(t.value); } }); requestAnimationFrame(function () { grow(t); }); return t; }
  function uid(p) { return p + Math.random().toString(36).slice(2, 8); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function siteUrl() { return location.origin.replace('//cms.', '//'); }

  function markDirty() {
    S.dirty = JSON.stringify(S.content) !== JSON.stringify(S.saved);
    var b = document.querySelector('.savebar'); if (b) b.classList.toggle('on', S.dirty);
  }
  window.addEventListener('beforeunload', function (e) { if (S.dirty) { e.preventDefault(); e.returnValue = ''; } });

  function save() {
    var btn = document.querySelector('.savebar .save'); if (btn) { btn.disabled = true; btn.textContent = 'Đang lưu…'; }
    return api('PUT', 'content', { content: S.content, note: 'Cập nhật nội dung' }).then(function (r) {
      S.content = r.content; S.saved = clone(r.content); S.updated = r.updated; S.dirty = false;
      toast('Đã lưu. Website cập nhật ngay.'); render();
    }).catch(function (e) { toast(e.message, true); if (btn) { btn.disabled = false; btn.textContent = 'Lưu và đăng lên website'; } });
  }
  function discard() {
    if (!confirm('Bỏ toàn bộ thay đổi chưa lưu?')) return;
    S.content = clone(S.saved); S.dirty = false; render();
  }

  /* ---------- đăng nhập ---------- */
  var LOGO = '<rect width="64" height="64" rx="16" fill="#0B2A6F"/><rect x="12" y="18" width="40" height="28" rx="12" fill="none" stroke="#fff" stroke-width="4"/><rect x="23" y="26" width="5" height="12" rx="2.5" fill="#fff"/><path d="M36 34a6 6 0 0 1 10 0" stroke="#FF6A2B" stroke-width="4" fill="none" stroke-linecap="round"/>';
  function brand() { var s = icon(LOGO); s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('stroke', 'none'); return h('div', { class: 'brand' }, s, h('span', null, '3RDHub', h('i', null, ' CMS'))); }

  function renderLogin(msg) {
    app.innerHTML = '';
    var err = h('div', { class: 'msg err', style: msg ? '' : 'display:none', role: 'alert' }, msg || '');
    var pw = h('input', { type: 'password', id: 'pw', autocomplete: 'current-password', required: true, autofocus: true });
    var btn = h('button', { class: 'btn', type: 'submit' }, 'Đăng nhập');
    var form = h('form', {
      onsubmit: function (e) {
        e.preventDefault(); btn.disabled = true; err.style.display = 'none';
        api('POST', 'login', { password: pw.value }).then(boot).catch(function (x) { err.textContent = x.message; err.style.display = ''; btn.disabled = false; pw.select(); });
      }
    }, brand(), h('h1', null, 'Đăng nhập quản trị'), h('p', null, 'Quản lý nội dung website 3RDHub Vietnam.'), err,
      h('label', { class: 'f', for: 'pw' }, 'Mật khẩu', pw), btn);
    app.appendChild(h('div', { class: 'login' }, form));
    pw.focus();
  }

  /* ---------- khung chính ---------- */
  function render() {
    if (!S.content) return;
    app.innerHTML = '';
    var tabsNav = h('nav', { 'aria-label': 'Mục quản trị' }, TABS.map(function (t) {
      var bd = t[0] === 'leads' && S.leads.new ? h('span', { class: 'bd' }, S.leads.new) : null;
      return h('button', { type: 'button', 'data-tab': t[0], 'aria-current': S.tab === t[0] ? 'page' : null, onclick: function () { go(t[0]); } }, icon(ICONS[t[0]]), h('span', { class: 'lb' }, t[1]), bd);
    }));
    var side = h('aside', { class: 'side' }, brand(), tabsNav, h('div', { class: 'sp' }),
      h('div', { class: 'foot' },
        h('a', { class: 'btn gh sm', href: siteUrl(), target: '_blank', rel: 'noopener' }, 'Xem website ↗'),
        h('button', { class: 'btn gh sm', type: 'button', onclick: function () { api('POST', 'logout').then(function () { S.user = false; S.content = null; renderLogin(); }); } }, 'Đăng xuất')));
    var title = TABS.filter(function (t) { return t[0] === S.tab; })[0][1];
    var savebar = h('div', { class: 'savebar' + (S.dirty ? ' on' : ''), role: 'status' }, h('span', null, 'Có thay đổi chưa lưu'),
      h('button', { class: 'btn gh sm', type: 'button', onclick: discard }, 'Bỏ'),
      h('button', { class: 'btn sm save', type: 'button', onclick: save }, 'Lưu và đăng lên website'));
    var body = h('div', { id: 'view' });
    var main = h('main', { class: 'main' }, h('div', { class: 'top' }, h('h1', null, title), savebar), body);
    app.appendChild(h('div', { class: 'shell' }, side, main));
    ({ dash: vDash, text: vText, faq: vFaq, partners: vPartners, legal: vLegal, leads: vLeads, settings: vSettings, history: vHistory })[S.tab](body);
  }
  function go(tab) { S.tab = tab; history.replaceState(null, '', '#' + tab); render(); window.scrollTo(0, 0); }

  /* ---------- Tổng quan ---------- */
  function vDash(el) {
    var ovn = Object.keys(S.content.ov).length, newN = S.leads.new || 0, total = Object.keys(S.leads).reduce(function (a, k) { return a + S.leads[k]; }, 0);
    el.appendChild(h('div', { class: 'grid g4', style: 'margin-bottom:16px' },
      h('div', { class: 'stat ink' }, h('b', null, newN), h('span', null, 'Yêu cầu mới chưa xử lý')),
      h('div', { class: 'stat' }, h('b', null, total), h('span', null, 'Tổng yêu cầu đã nhận')),
      h('div', { class: 'stat' }, h('b', null, ovn), h('span', null, 'Đoạn chữ đã tuỳ chỉnh')),
      h('div', { class: 'stat' }, h('b', null, S.content.faq.length + ' · ' + S.content.partners.length), h('span', null, 'Câu hỏi · đối tác'))));
    el.appendChild(h('div', { class: 'panel' }, h('h2', null, 'Bắt đầu nhanh'),
      h('p', { class: 'sub' }, 'Lần chỉnh sửa gần nhất: ' + (S.updated ? fmt(S.updated) : 'chưa có')),
      h('div', { class: 'bar' },
        h('button', { class: 'btn', type: 'button', onclick: function () { go('text'); } }, 'Sửa chữ trên website'),
        h('button', { class: 'btn gh', type: 'button', onclick: function () { go('faq'); } }, 'Quản lý hỏi đáp'),
        h('button', { class: 'btn gh', type: 'button', onclick: function () { go('partners'); } }, 'Quản lý đối tác'),
        h('button', { class: 'btn gh', type: 'button', onclick: function () { go('legal'); } }, 'Điều khoản và bảo mật'),
        h('button', { class: 'btn gh', type: 'button', onclick: function () { go('leads'); } }, 'Xem yêu cầu khách'))));
    el.appendChild(h('div', { class: 'panel help' }, h('h2', null, 'Cách hoạt động'),
      h('ul', null,
        h('li', null, h('b', null, 'Sửa xong bấm "Lưu và đăng lên website"'), ': website cập nhật ngay, không cần chạy lại gì.'),
        h('li', null, h('b', null, 'Mỗi đoạn chữ có 2 ô'), ': Tiếng Việt và English. Để trống ô English thì dùng bản dịch mặc định.'),
        h('li', null, h('b', null, 'Chữ giống nhau ở nhiều chỗ'), ' (ví dụ nút "Đăng ký làm publisher") đổi một lần là đổi hết.'),
        h('li', null, h('b', null, 'Làm sai?'), ' Vào mục "Lịch sử" để khôi phục phiên bản trước.'),
        h('li', null, h('b', null, 'Hình ảnh, cảnh 3D và bố cục'), ' là phần thiết kế, không sửa ở đây. Logo đối tác thì thay được trong mục "Đối tác".'))));
  }

  /* ---------- Nội dung chữ ---------- */
  function vText(el) {
    var T = S.text, items = S.strings.items, ov = S.content.ov;
    function changed(it) { return !!ov[it.k]; }
    var q = T.q.trim().toLowerCase();
    var list = items.filter(function (it) {
      if (T.g !== '*' && it.g !== T.g) return false;
      if (T.only && !changed(it)) return false;
      if (!q) return true;
      var o = ov[it.k] || {};
      return (it.k + ' ' + it.en + ' ' + (o.vi || '') + ' ' + (o.en || '')).toLowerCase().indexOf(q) > -1;
    });
    var pages = Math.max(1, Math.ceil(list.length / PAGE)); if (T.page >= pages) T.page = pages - 1;
    var search = h('input', { type: 'search', class: 'grow', placeholder: 'Tìm chữ cần sửa…', value: T.q, 'aria-label': 'Tìm chữ' });
    var t0; search.addEventListener('input', function () { clearTimeout(t0); t0 = setTimeout(function () { T.q = search.value; T.page = 0; render(); var s2 = document.querySelector('input[type=search]'); if (s2) { s2.focus(); s2.setSelectionRange(9999, 9999); } }, 250); });
    var sel = h('select', { 'aria-label': 'Lọc theo trang', onchange: function () { T.g = sel.value; T.page = 0; render(); } },
      h('option', { value: '*' }, 'Tất cả các trang (' + items.length + ')'),
      S.strings.groups.map(function (g) { return h('option', { value: g, selected: T.g === g }, g); }));
    sel.value = T.g;
    var only = h('label', { style: 'display:flex;gap:8px;align-items:center;font-weight:800' }, h('input', { type: 'checkbox', checked: T.only, onchange: function (e) { T.only = e.target.checked; T.page = 0; render(); } }), 'Chỉ đã sửa');
    el.appendChild(h('div', { class: 'bar' }, search, sel, only));
    el.appendChild(h('p', { class: 'sub' }, list.length + ' đoạn chữ. Ô viền cam là đoạn đã tuỳ chỉnh. Chữ gốc hiện nhỏ phía trên mỗi ô.'));
    function pager() {
      return h('div', { class: 'pager' }, h('button', { class: 'btn gh sm', type: 'button', disabled: T.page === 0, onclick: function () { T.page--; render(); window.scrollTo(0, 0); } }, '← Trước'),
        'Trang ' + (T.page + 1) + '/' + pages, h('button', { class: 'btn gh sm', type: 'button', disabled: T.page >= pages - 1, onclick: function () { T.page++; render(); window.scrollTo(0, 0); } }, 'Sau →'));
    }
    if (!list.length) { el.appendChild(h('div', { class: 'empty' }, 'Không có đoạn chữ phù hợp.')); return; }
    if (pages > 1) el.appendChild(pager());
    list.slice(T.page * PAGE, T.page * PAGE + PAGE).forEach(function (it) {
      var o = ov[it.k] || {};
      var tag = h('span', { class: 'tag or', style: changed(it) ? '' : 'display:none' }, 'Đã sửa');
      var row = h('div', { class: 'trow' + (changed(it) ? ' chg' : '') });
      var orig = h('span', { class: 'orig' }, changed(it) ? 'Gốc: ' + it.k.slice(0, 140) : '');
      function sync() {
        var cur = ov[it.k];
        if (cur && !cur.vi && !cur.en) { delete ov[it.k]; cur = null; }
        row.classList.toggle('chg', !!cur); tag.style.display = cur ? '' : 'none'; orig.textContent = cur ? 'Gốc: ' + it.k.slice(0, 140) : ''; markDirty();
      }
      function setField(lg, val, def) {
        var v = val.replace(/\r\n/g, '\n').trim();
        if (v === def.trim() || !v) { if (ov[it.k]) delete ov[it.k][lg]; } else { (ov[it.k] = ov[it.k] || {})[lg] = v; }
        sync();
      }
      var vi = ta(o.vi || it.k, function (v) { setField('vi', v, it.k); });
      var en = ta(o.en || it.en, function (v) { setField('en', v, it.en); });
      var reset = h('button', { class: 'btn gh sm', type: 'button', title: 'Về chữ gốc', onclick: function () { delete ov[it.k]; vi.value = it.k; en.value = it.en; grow(vi); grow(en); sync(); } }, 'Về gốc');
      row.appendChild(h('div', { class: 'meta' }, h('span', { class: 'tag' }, it.g), tag, orig, reset));
      row.appendChild(h('div', { class: 'cols' }, h('label', null, 'Tiếng Việt', vi), h('label', null, 'English', en)));
      el.appendChild(row);
    });
    if (pages > 1) el.appendChild(pager());
  }

  /* ---------- Hỏi đáp ---------- */
  function move(arr, i, d) { var j = i + d; if (j < 0 || j >= arr.length) return; var t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  function pairInput(label, obj, key, big) {
    obj[key] = obj[key] || { vi: '', en: '' };
    var vi = big ? ta(obj[key].vi, function (v) { obj[key].vi = v; markDirty(); }) : h('input', { type: 'text', value: obj[key].vi, oninput: function (e) { obj[key].vi = e.target.value; markDirty(); } });
    var en = big ? ta(obj[key].en, function (v) { obj[key].en = v; markDirty(); }) : h('input', { type: 'text', value: obj[key].en, oninput: function (e) { obj[key].en = e.target.value; markDirty(); } });
    return h('div', { class: 'row2' }, h('label', { class: 'f' }, label + ' (Tiếng Việt)', vi), h('label', { class: 'f' }, label + ' (English)', en));
  }
  function vFaq(el) {
    var faq = S.content.faq;
    var cats = []; faq.forEach(function (f) { if (cats.indexOf(f.cat.vi) < 0) cats.push(f.cat.vi); });
    el.appendChild(h('div', { class: 'bar' },
      h('button', { class: 'btn', type: 'button', onclick: function () { var last = faq[faq.length - 1], id = uid('f'); faq.push({ id: id, cat: last ? clone(last.cat) : { vi: 'Chung', en: 'General' }, q: { vi: '', en: '' }, a: { vi: '', en: '' }, home: false }); S.openFaq[id] = true; markDirty(); render(); } }, '+ Thêm câu hỏi'),
      h('button', { class: 'btn gh', type: 'button', onclick: function () { if (confirm('Khôi phục toàn bộ hỏi đáp về danh sách mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) { S.content.faq = clone(S.defaults.faq); markDirty(); render(); } } }, 'Khôi phục mặc định'),
      h('span', { class: 'sub', style: 'margin:0' }, faq.length + ' câu hỏi. Câu có dấu "Trang chủ" sẽ hiện ở mục Hỏi đáp của trang chủ.')));
    var dl = h('datalist', { id: 'cats' }, cats.map(function (c) { return h('option', { value: c }); })); el.appendChild(dl);
    if (!faq.length) el.appendChild(h('div', { class: 'empty' }, 'Chưa có câu hỏi nào.'));
    faq.forEach(function (f, i) {
      var item = h('div', { class: 'item' + (S.openFaq[f.id] ? ' open' : '') });
      var title = h('span', { class: 't' }, f.q.vi || '(câu hỏi mới)');
      var hd = h('div', { class: 'hd', onclick: function (e) { if (e.target.closest('.acts')) return; item.classList.toggle('open'); S.openFaq[f.id] = item.classList.contains('open'); } },
        h('span', { class: 'tag' }, f.cat.vi || '—'), title, f.home ? h('span', { class: 'tag or' }, 'Trang chủ') : null,
        h('div', { class: 'acts' },
          h('button', { class: 'ib', type: 'button', title: 'Lên', disabled: i === 0, onclick: function () { move(faq, i, -1); markDirty(); render(); } }, '↑'),
          h('button', { class: 'ib', type: 'button', title: 'Xuống', disabled: i === faq.length - 1, onclick: function () { move(faq, i, 1); markDirty(); render(); } }, '↓'),
          h('button', { class: 'ib', type: 'button', title: 'Xoá', onclick: function () { if (confirm('Xoá câu hỏi này?')) { faq.splice(i, 1); markDirty(); render(); } } }, '✕')));
      var catVi = h('input', { type: 'text', value: f.cat.vi, setAttribute: null, list: 'cats', oninput: function (e) { f.cat.vi = e.target.value; var m = faq.filter(function (x) { return x !== f && x.cat.vi === f.cat.vi && x.cat.en; })[0]; if (m) { f.cat.en = m.cat.en; catEn.value = m.cat.en; } markDirty(); } });
      var catEn = h('input', { type: 'text', value: f.cat.en, oninput: function (e) { f.cat.en = e.target.value; markDirty(); } });
      var qVi = h('input', { type: 'text', value: f.q.vi, oninput: function (e) { f.q.vi = e.target.value; title.textContent = e.target.value || '(câu hỏi mới)'; markDirty(); } });
      var qEn = h('input', { type: 'text', value: f.q.en, oninput: function (e) { f.q.en = e.target.value; markDirty(); } });
      item.appendChild(hd);
      item.appendChild(h('div', { class: 'bd' },
        h('div', { class: 'row2' }, h('label', { class: 'f' }, 'Nhóm (Tiếng Việt)', catVi), h('label', { class: 'f' }, 'Nhóm (English)', catEn)),
        h('div', { class: 'row2' }, h('label', { class: 'f' }, 'Câu hỏi (Tiếng Việt)', qVi), h('label', { class: 'f' }, 'Câu hỏi (English)', qEn)),
        pairInput('Trả lời', f, 'a', true),
        h('label', { style: 'display:flex;gap:8px;align-items:center;font-weight:800' }, h('input', { type: 'checkbox', checked: f.home, onchange: function (e) { f.home = e.target.checked; markDirty(); render(); } }), 'Hiện ở mục Hỏi đáp của trang chủ')));
      el.appendChild(item);
    });
  }

  /* ---------- Đối tác ---------- */
  function vPartners(el) {
    var ps = S.content.partners, groups = []; ps.forEach(function (p) { if (groups.indexOf(p.group.vi) < 0) groups.push(p.group.vi); });
    el.appendChild(h('div', { class: 'bar' },
      h('button', { class: 'btn', type: 'button', onclick: function () { var last = ps[ps.length - 1]; ps.push({ id: uid('p'), name: '', url: '', logo: '', group: last ? clone(last.group) : { vi: 'Công ty tài chính', en: 'Finance company' } }); markDirty(); render(); } }, '+ Thêm đối tác'),
      h('button', { class: 'btn gh', type: 'button', onclick: function () { if (confirm('Khôi phục danh sách đối tác mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) { S.content.partners = clone(S.defaults.partners); markDirty(); render(); } } }, 'Khôi phục mặc định'),
      h('span', { class: 'sub', style: 'margin:0' }, ps.length + ' đối tác. Thứ tự ở đây là thứ tự hiện trên website (trong từng nhóm).')));
    el.appendChild(h('datalist', { id: 'groups' }, groups.map(function (c) { return h('option', { value: c }); })));
    var wrap = h('div', { class: 'plist' });
    ps.forEach(function (p, i) {
      var logo = h('div', { class: 'logo' }, p.logo ? h('img', { src: p.logo, alt: p.name }) : h('span', null, 'Chưa có logo'));
      var file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', style: 'display:none', onchange: function () {
        var f = file.files[0]; if (!f) return;
        if (f.size > 2 * 1024 * 1024) { toast('Ảnh quá lớn (tối đa 2MB).', true); return; }
        toast('Đang tải logo lên…');
        api('POST', 'upload', undefined, { body: f, headers: { 'X-Filename': encodeURIComponent(f.name), 'Content-Type': 'application/octet-stream' } }).then(function (r) { p.logo = r.path; markDirty(); render(); toast('Đã tải logo. Nhớ bấm Lưu.'); }).catch(function (e) { toast(e.message, true); });
      } });
      var gVi = h('input', { type: 'text', list: 'groups', value: p.group.vi, oninput: function (e) { p.group.vi = e.target.value; var m = ps.filter(function (x) { return x !== p && x.group.vi === p.group.vi && x.group.en; })[0]; if (m) { p.group.en = m.group.en; gEn.value = m.group.en; } markDirty(); } });
      var gEn = h('input', { type: 'text', value: p.group.en, oninput: function (e) { p.group.en = e.target.value; markDirty(); } });
      wrap.appendChild(h('div', { class: 'pcard' }, logo,
        h('div', { class: 'bar', style: 'margin:0' }, h('button', { class: 'btn gh sm', type: 'button', onclick: function () { file.click(); } }, p.logo ? 'Đổi logo' : 'Tải logo'), file,
          p.logo ? h('button', { class: 'btn gh sm', type: 'button', onclick: function () { p.logo = ''; markDirty(); render(); } }, 'Bỏ logo') : null,
          h('span', { style: 'flex:1' }),
          h('button', { class: 'ib', type: 'button', title: 'Lên', disabled: i === 0, onclick: function () { move(ps, i, -1); markDirty(); render(); } }, '↑'),
          h('button', { class: 'ib', type: 'button', title: 'Xuống', disabled: i === ps.length - 1, onclick: function () { move(ps, i, 1); markDirty(); render(); } }, '↓'),
          h('button', { class: 'ib', type: 'button', title: 'Xoá', onclick: function () { if (confirm('Xoá đối tác "' + (p.name || 'chưa đặt tên') + '"?')) { ps.splice(i, 1); markDirty(); render(); } } }, '✕')),
        h('label', { class: 'f' }, 'Tên đối tác', h('input', { type: 'text', value: p.name, oninput: function (e) { p.name = e.target.value; markDirty(); } })),
        h('label', { class: 'f' }, 'Link website', h('input', { type: 'url', placeholder: 'https://', value: p.url, oninput: function (e) { p.url = e.target.value; markDirty(); } })),
        h('div', { class: 'row2' }, h('label', { class: 'f' }, 'Nhóm (VI)', gVi), h('label', { class: 'f' }, 'Nhóm (EN)', gEn))));
    });
    el.appendChild(wrap);
  }

  /* ---------- Yêu cầu khách ---------- */
  function loadLeads() {
    var qs = []; if (S.lf.status) qs.push('status=' + S.lf.status); if (S.lf.q) qs.push('q=' + encodeURIComponent(S.lf.q));
    return api('GET', 'leads' + (qs.length ? '?' + qs.join('&') : '')).then(function (r) { S.leadsList = r; });
  }
  function updateBadge() {
    var btn = document.querySelector('.side nav button[data-tab="leads"]'); if (!btn) return;
    var bd = btn.querySelector('.bd'), n = S.leads.new || 0;
    if (!n) { if (bd) bd.remove(); return; }
    if (!bd) { bd = h('span', { class: 'bd' }); btn.appendChild(bd); }
    bd.textContent = n;
  }
  function refreshCounts() { return api('GET', 'bootstrap').then(function (b) { S.leads = b.leads; }); }
  function vLeads(el) {
    var st = [['', 'Tất cả'], ['new', 'Mới'], ['contacted', 'Đã liên hệ'], ['done', 'Hoàn tất'], ['spam', 'Spam']];
    var search = h('input', { type: 'search', class: 'grow', placeholder: 'Tìm theo tên, số điện thoại, công ty…', value: S.lf.q, 'aria-label': 'Tìm yêu cầu' });
    var t0; search.addEventListener('input', function () { clearTimeout(t0); t0 = setTimeout(function () { S.lf.q = search.value; loadLeads().then(draw); }, 300); });
    el.appendChild(h('div', { class: 'bar' },
      h('div', { class: 'chips' }, st.map(function (s) { return h('button', { type: 'button', 'aria-pressed': S.lf.status === s[0], onclick: function () { S.lf.status = s[0]; loadLeads().then(function () { render(); }); } }, s[1] + (s[0] && S.leads[s[0]] ? ' (' + S.leads[s[0]] + ')' : '')); })),
      search, h('button', { class: 'btn gh sm', type: 'button', onclick: function () { Promise.all([loadLeads(), refreshCounts()]).then(function () { render(); toast('Đã làm mới'); }); } }, 'Làm mới'),
      h('a', { class: 'btn gh sm', href: '/api/admin/leads.csv' }, 'Tải CSV')));
    var box = h('div', { id: 'leadbox' }); el.appendChild(box);
    function draw() {
      box.innerHTML = '';
      if (!S.leadsList.length) { box.appendChild(h('div', { class: 'empty' }, 'Chưa có yêu cầu nào.')); return; }
      S.leadsList.forEach(function (l) {
        var item = h('div', { class: 'lead ' + l.status });
        var badge = h('span', { class: 'tag ' + (l.status === 'new' ? 'or' : l.status === 'done' ? 'ok' : l.status === 'spam' ? 'bad' : '') }, LABEL[l.status]);
        var stSel = h('select', { 'aria-label': 'Trạng thái' }, Object.keys(LABEL).map(function (k) { return h('option', { value: k, selected: l.status === k }, LABEL[k]); }));
        stSel.value = l.status;
        stSel.addEventListener('change', function () {
          api('PATCH', 'leads/' + l.id, { status: stSel.value }).then(function () { l.status = stSel.value; item.className = 'lead open ' + l.status; badge.textContent = LABEL[l.status]; return refreshCounts(); }).then(updateBadge).catch(function (e) { toast(e.message, true); });
        });
        var note = h('textarea', { rows: 2, placeholder: 'Ghi chú nội bộ…', value: l.note || '' });
        var saveNote = h('button', { class: 'btn gh sm', type: 'button', onclick: function () { api('PATCH', 'leads/' + l.id, { note: note.value }).then(function () { toast('Đã lưu ghi chú'); }).catch(function (e) { toast(e.message, true); }); } }, 'Lưu ghi chú');
        var del = h('button', { class: 'btn bad sm', type: 'button', onclick: function () { if (!confirm('Xoá yêu cầu của ' + l.name + '? Không khôi phục được.')) return; api('DELETE', 'leads/' + l.id).then(function () { S.leadsList = S.leadsList.filter(function (x) { return x.id !== l.id; }); return refreshCounts(); }).then(render).catch(function (e) { toast(e.message, true); }); } }, 'Xoá');
        item.appendChild(h('div', { class: 'hd', onclick: function (e) { if (e.target.closest('select,a')) return; item.classList.toggle('open'); } },
          h('b', null, l.name), h('div', null, h('a', { href: 'tel:' + l.phone.replace(/[^\d+]/g, '') }, l.phone), l.company ? h('div', null, h('small', null, l.company)) : null), badge, h('small', null, fmt(l.ts))));
        item.appendChild(h('div', { class: 'bd' },
          h('dl', { class: 'kv' }, h('dt', null, 'Nhu cầu'), h('dd', null, l.need || '—'), h('dt', null, 'Công ty'), h('dd', null, l.company || '—'), h('dt', null, 'Ngôn ngữ'), h('dd', null, l.lang === 'en' ? 'English' : 'Tiếng Việt'), h('dt', null, 'IP'), h('dd', null, l.ip || '—')),
          l.message ? h('div', { class: 'msgbox' }, l.message) : null,
          h('div', { class: 'row2' }, h('label', { class: 'f' }, 'Trạng thái', stSel), h('label', { class: 'f' }, 'Ghi chú', note)),
          h('div', { class: 'bar', style: 'margin:0' }, saveNote, h('span', { style: 'flex:1' }), del)));
        box.appendChild(item);
      });
    }
    draw();
  }

  /* ---------- Trang pháp lý ---------- */
  var LEGALS = [['terms', 'Điều khoản sử dụng', 'dieu-khoan'], ['privacy', 'Chính sách bảo mật', 'bao-mat']];
  function escT(t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function inl(t) { var x = escT(t).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'); return x.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|mailto:[^)\s]+)\)/g, function (m, a, b) { return '<a href="' + b + '" target="_blank" rel="noopener">' + a + '</a>'; }); }
  function mdHtml(t) {
    var out = [], para = [], ul = false;
    function fp() { if (para.length) { out.push('<p>' + para.map(inl).join('<br>') + '</p>'); para = []; } }
    function eu() { if (ul) { out.push('</ul>'); ul = false; } }
    String(t || '').replace(/\r/g, '').split('\n').forEach(function (l) {
      var m; if (!l.trim()) { fp(); eu(); return; }
      if ((m = l.match(/^###\s+(.*)/))) { fp(); eu(); out.push('<h3>' + inl(m[1]) + '</h3>'); }
      else if ((m = l.match(/^##\s+(.*)/))) { fp(); eu(); out.push('<h2>' + inl(m[1]) + '</h2>'); }
      else if ((m = l.match(/^[-*]\s+(.*)/))) { fp(); if (!ul) { out.push('<ul>'); ul = true; } out.push('<li>' + inl(m[1]) + '</li>'); }
      else { eu(); para.push(l); }
    });
    fp(); eu(); return out.join('');
  }
  function legalMerged(key) {
    var def = (S.defaults.legal || {})[key] || { title: {}, updated: {}, body: {} }, cur = (S.content.legal || {})[key] || {}, o = {};
    ['title', 'updated', 'body'].forEach(function (f) { o[f] = {}; ['vi', 'en'].forEach(function (lg) { o[f][lg] = (cur[f] && cur[f][lg]) || (def[f] && def[f][lg]) || ''; }); });
    return o;
  }
  function vLegal(el) {
    S.content.legal = S.content.legal || {};
    el.appendChild(h('div', { class: 'panel help' }, h('h2', null, 'Trang Điều khoản và Chính sách bảo mật của website'),
      h('p', { class: 'sub' }, 'Hai trang này nằm riêng trên website (không dùng chung với app). Sửa xong bấm "Lưu và đăng lên website".'),
      h('ul', null,
        h('li', null, h('b', null, 'Định dạng'), ': dòng trống để tách đoạn; ', h('b', null, '## Tiêu đề'), ' cho mục lớn, ', h('b', null, '### '), ' cho mục nhỏ; ', h('b', null, '- '), ' đầu dòng để tạo danh sách; ', h('b', null, '**chữ đậm**'), '; ', h('b', null, '[chữ hiển thị](https://...)'), ' để chèn liên kết.'),
        h('li', null, 'Thông tin liên hệ, mã số thuế hiển thị ở chân trang lấy từ mục Cài đặt.'),
        h('li', null, 'Nội dung mặc định là bản mẫu để bạn chỉnh. Nên để luật sư hoặc bộ phận pháp chế xem lại trước khi dùng chính thức.'))));
    LEGALS.forEach(function (g) {
      var key = g[0], cur = legalMerged(key), view = 'vi';
      function ensure() { if (!S.content.legal[key]) S.content.legal[key] = clone(legalMerged(key)); return S.content.legal[key]; }
      function setF(f, lg, v) { ensure()[f][lg] = v; markDirty(); }
      var prevBox = h('div', { class: 'legalprev' });
      function drawPrev() { var d = legalMerged(key); prevBox.innerHTML = '<h1>' + escT(d.title[view]) + '</h1><p class="lupd">' + (view === 'en' ? 'Last updated: ' : 'Cập nhật lần cuối: ') + escT(d.updated[view]) + '</p><div class="lbody">' + mdHtml(d.body[view]) + '</div>'; }
      var pv = h('div', { class: 'chips' }, [['vi', 'Xem trước: Tiếng Việt'], ['en', 'Xem trước: English']].map(function (x) {
        var b = h('button', { type: 'button', 'aria-pressed': view === x[0], onclick: function () { view = x[0]; Array.prototype.forEach.call(pv.children, function (c) { c.setAttribute('aria-pressed', c === b); }); drawPrev(); } }, x[1]); return b; }));
      function tall(lg) { var t = h('textarea', { rows: 22, class: 'tall', value: cur.body[lg], oninput: function () { setF('body', lg, t.value); } }); return t; }
      var panel = h('div', { class: 'panel' },
        h('div', { class: 'bar', style: 'margin:0 0 6px' }, h('h2', { style: 'margin:0;flex:1' }, g[1]),
          h('a', { class: 'btn gh sm', href: siteUrl() + '/' + g[2], target: '_blank', rel: 'noopener' }, 'Xem trên website ↗'),
          h('button', { class: 'btn gh sm', type: 'button', onclick: function () { if (!confirm('Khôi phục "' + g[1] + '" về bản mặc định? (chưa lưu cho đến khi bạn bấm Lưu)')) return; delete S.content.legal[key]; markDirty(); render(); } }, 'Về bản mặc định')),
        h('div', { class: 'row2', style: 'margin-top:10px' },
          h('label', { class: 'f' }, 'Tiêu đề (Tiếng Việt)', h('input', { type: 'text', value: cur.title.vi, oninput: function (e) { setF('title', 'vi', e.target.value); } })),
          h('label', { class: 'f' }, 'Title (English)', h('input', { type: 'text', value: cur.title.en, oninput: function (e) { setF('title', 'en', e.target.value); } }))),
        h('div', { class: 'row2', style: 'margin-top:12px' },
          h('label', { class: 'f' }, 'Ngày cập nhật (Tiếng Việt)', h('input', { type: 'text', value: cur.updated.vi, oninput: function (e) { setF('updated', 'vi', e.target.value); } })),
          h('label', { class: 'f' }, 'Last updated (English)', h('input', { type: 'text', value: cur.updated.en, oninput: function (e) { setF('updated', 'en', e.target.value); } }))),
        h('div', { class: 'row2', style: 'margin-top:12px' }, h('label', { class: 'f' }, 'Nội dung (Tiếng Việt)', tall('vi')), h('label', { class: 'f' }, 'Content (English)', tall('en'))),
        h('div', { style: 'margin-top:16px;display:grid;gap:12px' }, pv, prevBox));
      drawPrev();
      el.appendChild(panel);
    });
  }

  /* ---------- Cài đặt ---------- */
  function vSettings(el) {
    var st = S.content.settings, D = S.defaults.settings;
    function f(key, label, hint, type, big) {
      var inp = big ? h('textarea', { rows: 3, placeholder: D[key] || '', value: st[key] || '', oninput: function (e) { var v = e.target.value.trim(); if (v) st[key] = v; else delete st[key]; markDirty(); } })
        : h('input', { type: type || 'text', placeholder: D[key] || '', value: st[key] || '', oninput: function (e) { var v = e.target.value.trim(); if (v) st[key] = v; else delete st[key]; markDirty(); } });
      return h('label', { class: 'f' }, label, inp, h('small', null, hint));
    }
    function panel(title, sub, fields) { return h('div', { class: 'panel' }, h('h2', null, title), h('p', { class: 'sub' }, sub), h('div', { class: 'grid g2' }, fields)); }
    el.appendChild(panel('Thông tin công ty', 'Hiện ở chân trang và trang Liên hệ. Để trống để dùng giá trị mặc định (hiện mờ trong ô); mục Địa chỉ và Giờ làm việc để trống thì ẩn đi.', [
      f('company_name', 'Tên công ty', 'Dùng trong dòng bản quyền ở chân trang'),
      f('tax_id', 'Mã số thuế', ''),
      f('address', 'Địa chỉ', 'Chưa điền thì chân trang không hiện dòng này'),
      f('working_hours', 'Giờ làm việc (Tiếng Việt)', 'Ví dụ: 8:30 - 17:30, Thứ 2 đến Thứ 6'),
      f('working_hours_en', 'Working hours (English)', 'Để trống thì dùng bản tiếng Việt'),
      f('email', 'Email hỗ trợ', 'Hiện ở chân trang, trang Liên hệ, nút Gửi email', 'email'),
      f('hotline', 'Số hotline (hiển thị)', 'Ví dụ: (+84) 398 192 414'),
      f('hotline_tel', 'Số hotline (để bấm gọi)', 'Chỉ gồm số, ví dụ: +84398192414')]));
    el.appendChild(panel('Liên kết và mạng xã hội', 'Mạng xã hội chỉ hiện biểu tượng ở chân trang khi bạn điền link.', [
      f('signup_url', 'Link nút "Đăng ký ngay"', 'Trang đăng ký trên app', 'url'),
      f('facebook', 'Facebook', 'https://facebook.com/...', 'url'),
      f('zalo', 'Zalo', 'https://zalo.me/...', 'url'),
      f('tiktok', 'TikTok', 'https://tiktok.com/@...', 'url'),
      f('youtube', 'YouTube', 'https://youtube.com/@...', 'url'),
      f('instagram', 'Instagram', 'https://instagram.com/...', 'url')]));
    el.appendChild(panel('SEO và theo dõi', 'Tiêu đề và mô tả được áp dụng khi trang tải xong (Google đọc được; Facebook, Zalo khi chia sẻ link vẫn dùng ảnh và mô tả mặc định). Favicon và ảnh chia sẻ thay trong thư mục site/ của mã nguồn.', [
      f('site_title', 'Tiêu đề website', 'Hiện trên tab trình duyệt. Mặc định: 3RDHub Vietnam'),
      f('analytics_id', 'Mã Google Analytics', 'Dạng G-XXXXXXXXXX. Để trống thì không theo dõi', 'text'),
      h('div', { style: 'grid-column:1/-1' }, f('meta_description', 'Mô tả website (meta description)', 'Khoảng 120 đến 160 ký tự', 'text', true))]));
    var cur = h('input', { type: 'password', autocomplete: 'current-password' }), nw = h('input', { type: 'password', autocomplete: 'new-password' }), nw2 = h('input', { type: 'password', autocomplete: 'new-password' }), msg = h('div', { class: 'msg', style: 'display:none' });
    var btn = h('button', { class: 'btn', type: 'submit' }, 'Đổi mật khẩu');
    el.appendChild(h('form', { class: 'panel', onsubmit: function (e) {
      e.preventDefault(); msg.style.display = 'none';
      function say(t, ok) { msg.textContent = t; msg.className = 'msg ' + (ok ? 'ok' : 'err'); msg.style.display = ''; }
      if (nw.value !== nw2.value) return say('Hai mật khẩu mới không giống nhau.');
      btn.disabled = true;
      api('POST', 'password', { current: cur.value, new: nw.value }).then(function () { say('Đã đổi mật khẩu.', true); cur.value = nw.value = nw2.value = ''; }).catch(function (x) { say(x.message); }).then(function () { btn.disabled = false; });
    } }, h('h2', null, 'Đổi mật khẩu quản trị'), h('p', { class: 'sub' }, 'Tối thiểu 10 ký tự. Nên dùng mật khẩu dài và không dùng lại ở nơi khác.'),
      h('div', { class: 'grid g2' }, h('label', { class: 'f' }, 'Mật khẩu hiện tại', cur), h('span')),
      h('div', { class: 'grid g2', style: 'margin-top:12px' }, h('label', { class: 'f' }, 'Mật khẩu mới', nw), h('label', { class: 'f' }, 'Nhập lại mật khẩu mới', nw2)),
      h('div', { style: 'margin-top:14px;display:grid;gap:10px' }, msg, h('div', null, btn))));
  }

  /* ---------- Lịch sử ---------- */
  function vHistory(el) {
    var box = h('div', { class: 'panel' }, h('h2', null, 'Các phiên bản đã lưu'), h('p', { class: 'sub' }, 'Mỗi lần bấm Lưu tạo một phiên bản (giữ 60 bản gần nhất). Khôi phục sẽ đưa nội dung về thời điểm đó và tạo thêm một phiên bản mới.'), h('p', { class: 'sub' }, 'Đang tải…'));
    el.appendChild(box);
    api('GET', 'revisions').then(function (rs) {
      box.lastChild.remove();
      if (!rs.length) { box.appendChild(h('div', { class: 'empty' }, 'Chưa có phiên bản nào.')); return; }
      rs.forEach(function (r, i) {
        box.appendChild(h('div', { class: 'hist' }, h('small', null, fmt(r.ts)), h('div', null, h('b', null, r.note || 'Lưu thay đổi'), h('br'), h('small', null, r.ov + ' chữ tuỳ chỉnh · ' + r.faq + ' câu hỏi · ' + r.partners + ' đối tác')),
          i === 0 ? h('span', { class: 'tag ok' }, 'Mới nhất') : h('button', { class: 'btn gh sm', type: 'button', onclick: function () {
            if (S.dirty && !confirm('Bạn đang có thay đổi chưa lưu, khôi phục sẽ bỏ chúng. Tiếp tục?')) return;
            if (!confirm('Khôi phục phiên bản ' + fmt(r.ts) + '? Website sẽ đổi ngay.')) return;
            api('POST', 'revisions/' + r.id + '/restore').then(function (x) { S.content = x.content; S.saved = clone(x.content); S.dirty = false; toast('Đã khôi phục'); render(); }).catch(function (e) { toast(e.message, true); });
          } }, 'Khôi phục')));
      });
    }).catch(function (e) { box.lastChild.textContent = e.message; });
  }

  /* ---------- khởi động ---------- */
  function boot() {
    Promise.all([api('GET', 'bootstrap'), fetch('strings.json').then(function (r) { return r.json(); })]).then(function (r) {
      var b = r[0]; S.content = b.content; S.content.ov = S.content.ov || {}; S.content.faq = S.content.faq || clone(b.defaults.faq); S.content.partners = S.content.partners || clone(b.defaults.partners); S.content.settings = S.content.settings || {}; S.content.legal = S.content.legal || {};
      S.saved = clone(S.content); S.defaults = b.defaults; S.leads = b.leads; S.updated = b.updated; S.strings = r[1]; S.user = true; S.dirty = false;
      var t = location.hash.replace('#', ''); if (TABS.some(function (x) { return x[0] === t; })) S.tab = t;
      var p = S.tab === 'leads' ? loadLeads() : Promise.resolve();
      return p.then(render);
    }).catch(function (e) { if (!S.user) renderLogin(/^Phiên đăng nhập/.test(e.message) ? '' : e.message); });
  }
  var origGo = go;
  go = function (tab) { if (tab === 'leads') { Promise.all([loadLeads(), refreshCounts()]).then(function () { origGo(tab); }); } else origGo(tab); };
  boot();
})();
