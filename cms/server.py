#!/usr/bin/env python3
"""3RDHub CMS: backend nhẹ, chỉ dùng thư viện chuẩn của Python 3.8+.

- Lưu nội dung site (chữ, hỏi đáp, đối tác, cài đặt) trong SQLite.
- API công khai: GET /api/content, POST /api/lead
- Trang quản trị + API quản trị (đăng nhập bằng cookie) trên host bắt đầu bằng "cms."
- Chạy:  python3 server.py            (đọc biến môi trường, xem bên dưới)
         python3 server.py --reset-password [mật_khẩu_mới]

Biến môi trường: CMS_DATA (thư mục dữ liệu), PORT, BIND, CMS_ADMIN_PASSWORD (mật khẩu ban đầu),
CMS_HOSTS (danh sách host được vào trang quản trị, mặc định mọi host bắt đầu bằng "cms."),
SITE_DIR (chỉ dùng khi chạy thử cục bộ: phục vụ luôn site tĩnh).
"""
import base64
import csv
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import shutil
import sqlite3
import sys
import threading
import time
import urllib.parse
from collections import defaultdict, deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

BASE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get("CMS_DATA", os.path.join(BASE, "data"))
PORT = int(os.environ.get("PORT", "8787"))
BIND = os.environ.get("BIND", "127.0.0.1")
ADMIN_DIR = os.path.join(BASE, "admin")
SEED_DIR = os.path.join(BASE, "seed")
UPLOADS = os.path.join(DATA, "uploads")
DB_PATH = os.path.join(DATA, "cms.db")
SITE_DIR = os.environ.get("SITE_DIR")
CMS_HOSTS = [h.strip().lower() for h in os.environ.get("CMS_HOSTS", "").split(",") if h.strip()]
SESSION_TTL = 12 * 3600
MAX_JSON = 3 * 1024 * 1024
MAX_UPLOAD = 2 * 1024 * 1024
SETTING_KEYS = ("signup_url", "email", "hotline", "hotline_tel", "terms_url", "privacy_url")

_lock = threading.Lock()
_hits = defaultdict(deque)  # giới hạn tần suất: (loại, ip) -> thời điểm


def now():
    return int(time.time())


def db():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA busy_timeout=8000")
    return con


def kv_get(con, key, default=None):
    row = con.execute("SELECT value FROM kv WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def kv_set(con, key, value):
    con.execute("INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                (key, json.dumps(value, ensure_ascii=False)))


# ---------------------------------------------------------------- mật khẩu / phiên
def hash_pw(pw, salt=None, rounds=200000):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), rounds).hex()
    return "pbkdf2$%d$%s$%s" % (rounds, salt, h)


def check_pw(pw, stored):
    try:
        _, rounds, salt, h = stored.split("$")
        calc = hashlib.pbkdf2_hmac("sha256", pw.encode(), bytes.fromhex(salt), int(rounds)).hex()
        return hmac.compare_digest(calc, h)
    except Exception:
        return False


def make_token(con):
    secret = kv_get(con, "secret")
    pwh = kv_get(con, "admin_hash", "")
    payload = base64.urlsafe_b64encode(json.dumps({"e": now() + SESSION_TTL, "h": pwh[-12:], "n": secrets.token_hex(4)}).encode()).decode().rstrip("=")
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return payload + "." + sig


def verify_token(con, token):
    try:
        payload, sig = token.split(".")
        secret = kv_get(con, "secret")
        good = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(good, sig):
            return False
        data = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        return data["e"] > now() and data["h"] == kv_get(con, "admin_hash", "")[-12:]
    except Exception:
        return False


def rate_ok(kind, ip, limit, window):
    t = time.time()
    with _lock:
        q = _hits[(kind, ip)]
        while q and q[0] < t - window:
            q.popleft()
        if len(q) >= limit:
            return False
        q.append(t)
        return True


def rate_peek(kind, ip, limit, window):
    t = time.time()
    with _lock:
        q = _hits[(kind, ip)]
        while q and q[0] < t - window:
            q.popleft()
        return len(q) < limit


def rate_hit(kind, ip):
    with _lock:
        _hits[(kind, ip)].append(time.time())


# ---------------------------------------------------------------- dữ liệu khởi tạo và kiểm tra
def load_defaults():
    with open(os.path.join(BASE, "defaults.json"), encoding="utf-8") as f:
        return json.load(f)


def default_content():
    d = load_defaults()
    return {"ov": {}, "faq": d["faq"], "partners": d["partners"], "settings": {}}


def init():
    os.makedirs(UPLOADS, exist_ok=True)
    os.makedirs(DATA, exist_ok=True)
    con = db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, note TEXT, snapshot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS leads(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, name TEXT, phone TEXT, company TEXT,
        need TEXT, message TEXT, lang TEXT, ip TEXT, ua TEXT, status TEXT NOT NULL DEFAULT 'new', note TEXT DEFAULT '');
    CREATE INDEX IF NOT EXISTS leads_ts ON leads(ts DESC);
    """)
    if kv_get(con, "secret") is None:
        kv_set(con, "secret", secrets.token_hex(32))
    if kv_get(con, "content") is None:
        kv_set(con, "content", default_content())
        kv_set(con, "updated", now())
    if kv_get(con, "admin_hash") is None:
        pw = os.environ.get("CMS_ADMIN_PASSWORD") or secrets.token_urlsafe(12)
        kv_set(con, "admin_hash", hash_pw(pw))
        if not os.environ.get("CMS_ADMIN_PASSWORD"):
            path = os.path.join(DATA, "initial-admin-password.txt")
            with open(path, "w") as f:
                f.write(pw + "\n")
            os.chmod(path, 0o600)
            print("Mật khẩu quản trị ban đầu được lưu ở", path, file=sys.stderr)
    con.commit()
    con.close()
    # logo mặc định
    if os.path.isdir(SEED_DIR):
        for fn in os.listdir(SEED_DIR):
            dst = os.path.join(UPLOADS, "seed-" + fn)
            if not os.path.exists(dst):
                shutil.copyfile(os.path.join(SEED_DIR, fn), dst)


URL_RE = re.compile(r"^https?://[^\s<>\"']{3,500}$", re.I)
UPLOAD_RE = re.compile(r"^/uploads/[A-Za-z0-9._-]{1,120}$")
EMAIL_RE = re.compile(r"^[^@\s<>\"']{1,100}@[^@\s<>\"']{2,150}$")
TEL_RE = re.compile(r"^\+?[0-9]{6,15}$")


def s(v, n, field="giá trị"):
    if v is None:
        return ""
    if not isinstance(v, str):
        raise ValueError("%s phải là chữ" % field)
    v = v.replace("\r\n", "\n")
    if len(v) > n:
        raise ValueError("%s quá dài (tối đa %d ký tự)" % (field, n))
    return v


def pair(o, n, field):
    o = o if isinstance(o, dict) else {}
    return {"vi": s(o.get("vi"), n, field), "en": s(o.get("en"), n, field)}


def clean_content(c):
    if not isinstance(c, dict):
        raise ValueError("Dữ liệu không hợp lệ")
    out = {"ov": {}, "faq": [], "partners": [], "settings": {}}
    ov = c.get("ov") or {}
    if not isinstance(ov, dict) or len(ov) > 5000:
        raise ValueError("Danh sách chữ tuỳ chỉnh không hợp lệ")
    for k, v in ov.items():
        if not isinstance(k, str) or not k or len(k) > 1500 or not isinstance(v, dict):
            continue
        item = {}
        for lg in ("vi", "en"):
            t = s(v.get(lg), 6000, "Chữ").strip() if v.get(lg) is not None else ""
            if t:
                item[lg] = t
        if item:
            out["ov"][k] = item
    faq = c.get("faq") or []
    if not isinstance(faq, list) or len(faq) > 400:
        raise ValueError("Danh sách hỏi đáp không hợp lệ")
    for i, f in enumerate(faq):
        if not isinstance(f, dict):
            continue
        item = {"id": re.sub(r"[^A-Za-z0-9_-]", "", str(f.get("id") or "f%d" % (i + 1)))[:40] or "f%d" % (i + 1),
                "cat": pair(f.get("cat"), 200, "Nhóm câu hỏi"), "q": pair(f.get("q"), 500, "Câu hỏi"),
                "a": pair(f.get("a"), 8000, "Câu trả lời"), "home": bool(f.get("home"))}
        if not item["q"]["vi"].strip():
            raise ValueError("Câu hỏi số %d chưa có nội dung tiếng Việt" % (i + 1))
        if not item["cat"]["vi"].strip():
            raise ValueError("Câu hỏi số %d chưa có nhóm" % (i + 1))
        out["faq"].append(item)
    partners = c.get("partners") or []
    if not isinstance(partners, list) or len(partners) > 300:
        raise ValueError("Danh sách đối tác không hợp lệ")
    for i, p in enumerate(partners):
        if not isinstance(p, dict):
            continue
        name = s(p.get("name"), 120, "Tên đối tác").strip()
        if not name:
            raise ValueError("Đối tác số %d chưa có tên" % (i + 1))
        url = s(p.get("url"), 500, "Link đối tác").strip()
        if url and not URL_RE.match(url):
            raise ValueError("Link của '%s' phải bắt đầu bằng http:// hoặc https://" % name)
        logo = s(p.get("logo"), 200, "Logo").strip()
        if logo and not UPLOAD_RE.match(logo):
            raise ValueError("Logo của '%s' không hợp lệ" % name)
        grp = pair(p.get("group"), 120, "Nhóm đối tác")
        if not grp["vi"].strip():
            raise ValueError("Đối tác '%s' chưa có nhóm" % name)
        out["partners"].append({"id": re.sub(r"[^A-Za-z0-9_-]", "", str(p.get("id") or "p%d" % (i + 1)))[:40] or "p%d" % (i + 1),
                                "name": name, "url": url, "logo": logo, "group": grp})
    st = c.get("settings") or {}
    for k in SETTING_KEYS:
        v = s(st.get(k), 300, k).strip() if isinstance(st, dict) else ""
        if not v:
            continue
        if k in ("signup_url", "terms_url", "privacy_url") and not URL_RE.match(v):
            raise ValueError("'%s' phải là đường dẫn bắt đầu bằng http:// hoặc https://" % k)
        if k == "email" and not EMAIL_RE.match(v):
            raise ValueError("Email không hợp lệ")
        if k == "hotline_tel":
            v = re.sub(r"[\s.\-()]", "", v)
            if not TEL_RE.match(v):
                raise ValueError("Số gọi (hotline_tel) chỉ gồm số, có thể bắt đầu bằng +")
        out["settings"][k] = v
    if len(json.dumps(out, ensure_ascii=False)) > MAX_JSON:
        raise ValueError("Nội dung quá lớn")
    return out


def save_content(con, content, note):
    kv_set(con, "content", content)
    kv_set(con, "updated", now())
    con.execute("INSERT INTO revisions(ts,note,snapshot) VALUES(?,?,?)", (now(), note[:200], json.dumps(content, ensure_ascii=False)))
    con.execute("DELETE FROM revisions WHERE id NOT IN (SELECT id FROM revisions ORDER BY id DESC LIMIT 60)")
    con.commit()


def public_payload(con):
    c = kv_get(con, "content", default_content())
    return {"v": kv_get(con, "updated", 0), "ov": c.get("ov", {}), "faq": c.get("faq"), "partners": c.get("partners"),
            "settings": c.get("settings", {})}


def detect_image(b):
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if b[:3] == b"\xff\xd8\xff":
        return "jpg"
    if b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        return "webp"
    if b[:6] in (b"GIF87a", b"GIF89a"):
        return "gif"
    return None


# ---------------------------------------------------------------- HTTP
class Handler(BaseHTTPRequestHandler):
    server_version = "3rdhub-cms"
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt, *a):
        if os.environ.get("CMS_DEBUG"):
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % a))

    # ---- tiện ích
    def host(self):
        return (self.headers.get("Host") or "").split(":")[0].lower()

    def is_admin_host(self):
        h = self.host()
        return h in CMS_HOSTS if CMS_HOSTS else h.startswith("cms.")

    def ip(self):
        return (self.headers.get("CF-Connecting-IP") or self.headers.get("X-Real-IP") or self.client_address[0] or "")[:64]

    def secure(self):
        v = (self.headers.get("X-Forwarded-Proto") or "").lower()
        return v == "https" or '"https"' in (self.headers.get("CF-Visitor") or "")

    def send(self, code, body=b"", ctype="application/json; charset=utf-8", headers=None):
        if isinstance(body, (dict, list)):
            body = json.dumps(body, ensure_ascii=False).encode()
        elif isinstance(body, str):
            body = body.encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "same-origin")
        if self.is_admin_host():
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("X-Robots-Tag", "noindex, nofollow")
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def err(self, code, msg):
        self.close_connection = True  # có thể còn dữ liệu gửi thừa chưa đọc
        self.send(code, {"ok": False, "error": msg}, headers={"Cache-Control": "no-store", "Connection": "close"})

    def read_body(self, limit):
        n = int(self.headers.get("Content-Length") or 0)
        if n > limit:
            self.rfile.read(min(n, limit))
            raise ValueError("Dữ liệu gửi lên quá lớn")
        return self.rfile.read(n) if n else b""

    def read_json(self, limit=MAX_JSON):
        raw = self.read_body(limit)
        try:
            return json.loads(raw.decode("utf-8") or "{}")
        except Exception:
            raise ValueError("Dữ liệu JSON không hợp lệ")

    def authed(self, con):
        if self.headers.get("X-CMS") != "1" and self.command not in ("GET", "HEAD"):
            return False
        ck = self.headers.get("Cookie") or ""
        m = re.search(r"(?:^|;\s*)cms_session=([^;]+)", ck)
        return bool(m and verify_token(con, urllib.parse.unquote(m.group(1))))

    # ---- định tuyến
    def do_HEAD(self):
        self.route()

    def do_GET(self):
        self.route()

    def do_POST(self):
        self.route()

    def do_PUT(self):
        self.route()

    def do_PATCH(self):
        self.route()

    def do_DELETE(self):
        self.route()

    def route(self):
        try:
            path = urllib.parse.urlsplit(self.path)
            p, qs = path.path, urllib.parse.parse_qs(path.query)
            if p == "/api/content" and self.command in ("GET", "HEAD"):
                return self.api_content()
            if p == "/api/lead" and self.command == "POST":
                return self.api_lead()
            if p.startswith("/uploads/") and self.command in ("GET", "HEAD"):
                return self.serve_file(UPLOADS, p[len("/uploads/"):], cache="public, max-age=86400", sandbox=True)
            if self.is_admin_host():
                if p.startswith("/api/admin/"):
                    return self.api_admin(p[len("/api/admin/"):], qs)
                if self.command in ("GET", "HEAD"):
                    name = "index.html" if p in ("/", "") else p.lstrip("/")
                    return self.serve_file(ADMIN_DIR, name, cache="no-cache", csp=True)
                return self.err(404, "Không tìm thấy")
            if SITE_DIR and self.command in ("GET", "HEAD"):
                name = "index.html" if p in ("/", "") else p.lstrip("/")
                return self.serve_file(SITE_DIR, name, cache="no-cache")
            return self.err(404, "Không tìm thấy")
        except ValueError as e:
            return self.err(400, str(e))
        except BrokenPipeError:
            pass
        except Exception as e:  # noqa
            sys.stderr.write("LỖI %s %s: %r\n" % (self.command, self.path, e))
            try:
                return self.err(500, "Lỗi máy chủ")
            except Exception:
                pass

    def serve_file(self, root, name, cache="no-cache", csp=False, sandbox=False):
        name = urllib.parse.unquote(name)
        full = os.path.realpath(os.path.join(root, name))
        if not full.startswith(os.path.realpath(root) + os.sep) or not os.path.isfile(full):
            return self.err(404, "Không tìm thấy")
        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        if ctype.startswith("text/") or ctype in ("application/javascript", "application/json"):
            ctype += "; charset=utf-8"
        with open(full, "rb") as f:
            body = f.read()
        h = {"Cache-Control": cache}
        if csp:
            h["Content-Security-Policy"] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
        if sandbox:
            h["Content-Security-Policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
        return self.send(200, body, ctype, h)

    # ---- API công khai
    def api_content(self):
        con = db()
        try:
            payload = public_payload(con)
        finally:
            con.close()
        body = json.dumps(payload, ensure_ascii=False).encode()
        etag = '"%s"' % hashlib.sha1(body).hexdigest()[:20]
        if self.headers.get("If-None-Match") == etag:
            return self.send(304, b"", headers={"ETag": etag, "Cache-Control": "no-cache"})
        return self.send(200, body, headers={"ETag": etag, "Cache-Control": "no-cache"})

    def api_lead(self):
        ip = self.ip()
        if not rate_ok("lead", ip, 6, 600) or not rate_ok("lead", "*", 150, 600):
            return self.err(429, "Bạn gửi quá nhiều lần, vui lòng thử lại sau ít phút.")
        d = self.read_json(40 * 1024)
        if d.get("website"):  # bẫy bot
            return self.send(200, {"ok": True})
        name = s(d.get("name"), 120, "Họ tên").strip()
        phone = s(d.get("phone"), 40, "Số điện thoại").strip()
        if len(name) < 2:
            raise ValueError("Nhập họ và tên.")
        if len(re.sub(r"\D", "", phone)) < 9:
            raise ValueError("Số điện thoại cần ít nhất 9 chữ số.")
        con = db()
        try:
            con.execute("INSERT INTO leads(ts,name,phone,company,need,message,lang,ip,ua) VALUES(?,?,?,?,?,?,?,?,?)",
                        (now(), name, phone, s(d.get("company"), 200).strip(), s(d.get("need"), 200).strip(),
                         s(d.get("message"), 4000).strip(), "en" if d.get("lang") == "en" else "vi", ip,
                         (self.headers.get("User-Agent") or "")[:300]))
            con.commit()
        finally:
            con.close()
        return self.send(200, {"ok": True})

    # ---- API quản trị
    def api_admin(self, sub, qs):
        con = db()
        try:
            if sub == "login" and self.command == "POST":
                ip = self.ip()
                if not rate_peek("login", ip, 8, 600) or not rate_peek("login", "*", 60, 600):
                    return self.err(429, "Đăng nhập sai quá nhiều lần, thử lại sau 10 phút.")
                d = self.read_json(4096)
                if not check_pw(str(d.get("password") or ""), kv_get(con, "admin_hash", "")):
                    rate_hit("login", ip)
                    rate_hit("login", "*")
                    time.sleep(0.6)
                    return self.err(401, "Mật khẩu không đúng.")
                tok = make_token(con)
                flags = "Path=/; HttpOnly; SameSite=Strict; Max-Age=%d" % SESSION_TTL + ("; Secure" if self.secure() else "")
                return self.send(200, {"ok": True}, headers={"Set-Cookie": "cms_session=%s; %s" % (urllib.parse.quote(tok), flags), "Cache-Control": "no-store"})
            if sub == "logout" and self.command == "POST":
                return self.send(200, {"ok": True}, headers={"Set-Cookie": "cms_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"})
            if not self.authed(con):
                return self.err(401, "Chưa đăng nhập")
            H = {"Cache-Control": "no-store"}
            if sub == "me":
                return self.send(200, {"ok": True}, headers=H)
            if sub == "bootstrap":
                d = load_defaults()
                st = con.execute("SELECT status,COUNT(*) n FROM leads GROUP BY status").fetchall()
                counts = {r["status"]: r["n"] for r in st}
                return self.send(200, {"content": kv_get(con, "content"), "defaults": {"faq": d["faq"], "partners": d["partners"], "settings": d["settings"]},
                                       "leads": counts, "updated": kv_get(con, "updated", 0)}, headers=H)
            if sub == "content" and self.command == "PUT":
                d = self.read_json()
                content = clean_content(d.get("content"))
                save_content(con, content, str(d.get("note") or "Lưu thay đổi"))
                return self.send(200, {"ok": True, "content": content, "updated": kv_get(con, "updated", 0)}, headers=H)
            if sub == "revisions" and self.command == "GET":
                rows = con.execute("SELECT id,ts,note,snapshot FROM revisions ORDER BY id DESC LIMIT 60").fetchall()
                out = []
                for r in rows:
                    c = json.loads(r["snapshot"])
                    out.append({"id": r["id"], "ts": r["ts"], "note": r["note"], "ov": len(c.get("ov", {})), "faq": len(c.get("faq") or []), "partners": len(c.get("partners") or [])})
                return self.send(200, out, headers=H)
            m = re.match(r"^revisions/(\d+)/restore$", sub)
            if m and self.command == "POST":
                r = con.execute("SELECT ts,snapshot FROM revisions WHERE id=?", (int(m.group(1)),)).fetchone()
                if not r:
                    return self.err(404, "Không tìm thấy phiên bản")
                content = clean_content(json.loads(r["snapshot"]))
                save_content(con, content, "Khôi phục phiên bản %s" % time.strftime("%d/%m/%Y %H:%M", time.localtime(r["ts"])))
                return self.send(200, {"ok": True, "content": content}, headers=H)
            if sub == "leads" and self.command == "GET":
                where, args = [], []
                if qs.get("status", [""])[0] in ("new", "contacted", "done", "spam"):
                    where.append("status=?")
                    args.append(qs["status"][0])
                q = qs.get("q", [""])[0].strip()
                if q:
                    where.append("(name LIKE ? OR phone LIKE ? OR company LIKE ? OR message LIKE ?)")
                    args += ["%" + q + "%"] * 4
                sql = "SELECT * FROM leads" + (" WHERE " + " AND ".join(where) if where else "") + " ORDER BY id DESC LIMIT 500"
                return self.send(200, [dict(r) for r in con.execute(sql, args).fetchall()], headers=H)
            if sub == "leads.csv" and self.command == "GET":
                buf = io.StringIO()
                w = csv.writer(buf)
                w.writerow(["ID", "Thời gian", "Họ tên", "Số điện thoại", "Công ty", "Nhu cầu", "Nội dung", "Ngôn ngữ", "Trạng thái", "Ghi chú"])
                for r in con.execute("SELECT * FROM leads ORDER BY id DESC").fetchall():
                    w.writerow([r["id"], time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(r["ts"])), r["name"], r["phone"], r["company"], r["need"], r["message"], r["lang"], r["status"], r["note"]])
                return self.send(200, "﻿" + buf.getvalue(), "text/csv; charset=utf-8",
                                 {"Content-Disposition": 'attachment; filename="yeu-cau-khach-hang.csv"', "Cache-Control": "no-store"})
            m = re.match(r"^leads/(\d+)$", sub)
            if m and self.command == "PATCH":
                d, lid = self.read_json(20 * 1024), int(m.group(1))
                if "status" in d:
                    if d["status"] not in ("new", "contacted", "done", "spam"):
                        raise ValueError("Trạng thái không hợp lệ")
                    con.execute("UPDATE leads SET status=? WHERE id=?", (d["status"], lid))
                if "note" in d:
                    con.execute("UPDATE leads SET note=? WHERE id=?", (s(d["note"], 2000), lid))
                con.commit()
                return self.send(200, {"ok": True}, headers=H)
            if m and self.command == "DELETE":
                con.execute("DELETE FROM leads WHERE id=?", (int(m.group(1)),))
                con.commit()
                return self.send(200, {"ok": True}, headers=H)
            if sub == "upload" and self.command == "POST":
                raw = self.read_body(MAX_UPLOAD)
                ext = detect_image(raw)
                if not raw or not ext:
                    raise ValueError("Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF (tối đa 2MB).")
                base = re.sub(r"[^a-z0-9]+", "-", os.path.splitext(urllib.parse.unquote(self.headers.get("X-Filename") or "logo"))[0].lower()).strip("-")[:30] or "logo"
                fn = "%s-%s.%s" % (secrets.token_hex(4), base, ext)
                with open(os.path.join(UPLOADS, fn), "wb") as f:
                    f.write(raw)
                return self.send(200, {"ok": True, "path": "/uploads/" + fn}, headers=H)
            if sub == "password" and self.command == "POST":
                d = self.read_json(4096)
                if not check_pw(str(d.get("current") or ""), kv_get(con, "admin_hash", "")):
                    return self.err(400, "Mật khẩu hiện tại không đúng.")
                new = str(d.get("new") or "")
                if len(new) < 10:
                    raise ValueError("Mật khẩu mới cần ít nhất 10 ký tự.")
                kv_set(con, "admin_hash", hash_pw(new))
                con.commit()
                tok = make_token(con)
                flags = "Path=/; HttpOnly; SameSite=Strict; Max-Age=%d" % SESSION_TTL + ("; Secure" if self.secure() else "")
                return self.send(200, {"ok": True}, headers={"Set-Cookie": "cms_session=%s; %s" % (urllib.parse.quote(tok), flags), "Cache-Control": "no-store"})
            return self.err(404, "Không tìm thấy")
        finally:
            con.close()


def main():
    init()
    if len(sys.argv) > 1 and sys.argv[1] == "--reset-password":
        pw = sys.argv[2] if len(sys.argv) > 2 else secrets.token_urlsafe(12)
        con = db()
        kv_set(con, "admin_hash", hash_pw(pw))
        con.commit()
        con.close()
        print("Mật khẩu quản trị mới:", pw)
        return
    httpd = ThreadingHTTPServer((BIND, PORT), Handler)
    httpd.daemon_threads = True
    print("3RDHub CMS chạy tại http://%s:%d  (dữ liệu: %s)" % (BIND, PORT, DATA), flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
