#!/usr/bin/env bash
# Thử deploy.sh trên một cây thư mục giả (không đụng hệ thống thật): nginx giả, SKIP_SYSTEM=1,
# cần một PostgreSQL đang chạy do người thử chỉ định:  PGHOST=/tmp/pgt PGPORT=55432 bash tools/test-deploy.sh
set -euo pipefail
[ -n "${PGPORT:-}" ] || { echo "Đặt PGHOST và PGPORT trỏ tới một PostgreSQL thử nghiệm (cho phép vai trò postgres đăng nhập)."; exit 2; }
REPO="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"; [ -n "${KEEP:-}" ] || trap 'rm -rf "$T"' EXIT; echo "T=$T"
export DB_NAME="${DB_NAME:-tdhubcms_test}" DB_USER="${DB_USER:-$(id -un)}"
mkdir -p "$T/bin" "$T/etc/nginx/sites-available" "$T/etc/nginx/sites-enabled" "$T/etc/systemd/system"
cat > "$T/bin/nginx" <<'STUB'
#!/usr/bin/env bash
case "$1" in
 -v) echo "nginx version: nginx/1.24.0 (stub)" >&2 ;;
 -t) echo "syntax is ok" >&2 ;;
 -s) echo "reloaded" >&2 ;;
 -T) for f in "$ETC"/nginx/sites-enabled/*.conf; do [ -e "$f" ] && { echo "# configuration file $f:"; cat "$f"; }; done ;;
esac
STUB
chmod +x "$T/bin/nginx"
run() { PATH="$T/bin:$PATH" ETC="$T/etc" WEBROOT="$T/www" CMS_DIR="$T/opt" CMS_DATA="$T/data" UNIT_DIR="$T/etc/systemd/system" LOCK_FILE="$T/lock" \
        SKIP_SYSTEM=1 SKIP_VERIFY=1 DOMAIN=test.local bash "$REPO/deploy.sh" "$@"; }
fail() { echo "FAIL: $*"; exit 1; }
psqlq() { runuser -u postgres -- env PGHOST="$PGHOST" PGPORT="$PGPORT" psql -tAq -d "$DB_NAME" -c "$1"; }

echo "== 1. Cài mới (chưa có gì)"
runuser -u postgres -- env PGHOST="$PGHOST" PGPORT="$PGPORT" psql -tAq -c "DROP DATABASE IF EXISTS \"$DB_NAME\"" >/dev/null
run cms > "$T/out1" 2>&1 || { cat "$T/out1"; fail "cms lần 1"; }
[ -x "$T/opt/server" ] && [ -f "$T/opt/admin/index.html" ] || fail "thiếu binary hoặc admin"
grep -q '^DATABASE_URL=postgres://' "$T/etc/3rdhub-cms.env" || fail "env thiếu DATABASE_URL"
grep -q 'ExecStart=.*/server serve' "$T/etc/systemd/system/3rdhub-cms.service" || fail "unit sai"
[ -f "$T/www/index.html" ] || fail "chưa chép website"
grep -q 'location ^~ /assets/' "$T/etc/nginx/sites-available/test.local.conf" || fail "vhost thiếu /assets/"
grep -q 'ssi on;' "$T/etc/nginx/sites-available/test.local.conf" && [ "$(grep -c 'location ^~ /api/seo/' "$T/etc/nginx/sites-available/test.local.conf")" = 1 ] || fail "vhost thiếu SSI/SEO hoặc trùng location /api/seo/"
grep -q 'server_name cms.test.local' "$T/etc/nginx/sites-available/cms.test.local.conf" || fail "thiếu vhost cms"
grep -q 'Mật khẩu quản trị lần đầu' "$T/out1" || fail "không in mật khẩu"
echo "ok"

echo "== 2. Chạy lại: không build lại, không đổi gì"
H1="$(cat "$T/opt/.build-hash")"; M1="$(stat -c %Y "$T/opt/server")"
run cms > "$T/out2" 2>&1 || { cat "$T/out2"; fail "cms lần 2"; }
grep -q 'không build lại' "$T/out2" || fail "lần 2 vẫn build"
[ "$(stat -c %Y "$T/opt/server")" = "$M1" ] || fail "binary bị ghi lại"
grep -q 'Mật khẩu quản trị lần đầu' "$T/out2" && fail "lần 2 không được in mật khẩu"
echo "ok"

echo "== 3. Nâng cấp từ bản cũ (Python + SQLite)"
rm -rf "$T/opt" "$T/data" "$T/etc/3rdhub-cms.env" "$T/etc/systemd/system/3rdhub-cms.service"
runuser -u postgres -- env PGHOST="$PGHOST" PGPORT="$PGPORT" psql -tAq -c "DROP DATABASE IF EXISTS \"$DB_NAME\"" >/dev/null
mkdir -p "$T/opt" "$T/data/uploads"; echo "# server.py cũ" > "$T/opt/server.py"; echo '{}' > "$T/opt/defaults.json"
printf 'PORT=8791\nBIND=127.0.0.1\nCMS_DATA=%s\nCMS_HOSTS=cms.test.local\n' "$T/data" > "$T/etc/3rdhub-cms.env"
python3 - "$T/data/cms.db" <<'PY'
import sqlite3, sys, json
c = sqlite3.connect(sys.argv[1])
c.executescript("""CREATE TABLE kv(key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE revisions(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, note TEXT, snapshot TEXT NOT NULL);
CREATE TABLE leads(id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, name TEXT, phone TEXT, company TEXT, need TEXT, message TEXT, lang TEXT, ip TEXT, ua TEXT, status TEXT NOT NULL DEFAULT 'new', note TEXT DEFAULT '');""")
content = {"ov": {"Mô hình": {"vi": "Mô hình CŨ"}}, "faq": [], "partners": [], "settings": {"email": "cu@3rdvn.vn"}, "legal": {}}
c.execute("INSERT INTO kv VALUES('secret',?)", (json.dumps("sekret"),))
c.execute("INSERT INTO kv VALUES('admin_hash',?)", (json.dumps("pbkdf2$1000$00ff$00"),))
c.execute("INSERT INTO kv VALUES('updated','1700000000')")
c.execute("INSERT INTO kv VALUES('content',?)", (json.dumps(content, ensure_ascii=False),))
c.execute("INSERT INTO revisions(ts,note,snapshot) VALUES(1700000000,'bản cũ',?)", (json.dumps(content, ensure_ascii=False),))
c.execute("INSERT INTO leads(ts,name,phone,note) VALUES(1700000001,'Khách Cũ','0900000000',NULL)")
c.commit()
PY
echo -n "logo" > "$T/data/uploads/abc-logo.png"
run cms > "$T/out3" 2>&1 || { cat "$T/out3"; fail "nâng cấp"; }
[ ! -f "$T/opt/server.py" ] || fail "server.py cũ chưa được dọn"
[ -f "$T/data/cms.db.migrated-"* ] 2>/dev/null || ls "$T"/data/cms.db.migrated-* >/dev/null || fail "chưa đánh dấu cms.db đã chuyển"
[ -f "$T/data/.sqlite-imported" ] || fail "thiếu dấu đã nạp"
[ "$(psqlq "SELECT COUNT(*) FROM leads WHERE name='Khách Cũ'")" = 1 ] || fail "mất yêu cầu khách"
[ "$(psqlq "SELECT value->'settings'->>'email' FROM kv WHERE key='content'")" = "cu@3rdvn.vn" ] || fail "mất nội dung"
[ "$(psqlq "SELECT value #>> '{}' FROM kv WHERE key='admin_hash'")" = 'pbkdf2$1000$00ff$00' ] || fail "mất mật khẩu cũ"
[ -f "$T/data/uploads/abc-logo.png" ] || fail "mất ảnh tải lên"
grep -q '^PORT=8791' "$T/etc/3rdhub-cms.env" && grep -q '^DATABASE_URL=' "$T/etc/3rdhub-cms.env" || fail "env sau nâng cấp"
grep -q 'Mật khẩu quản trị lần đầu' "$T/out3" && fail "nâng cấp không được in mật khẩu mới"
echo "ok"

echo "== 4. Chạy lại sau nâng cấp: không nạp lại"
run cms > "$T/out4" 2>&1 || { cat "$T/out4"; fail "lần 4"; }
grep -q 'Nạp dữ liệu bản CMS cũ' "$T/out4" && fail "nạp lại lần nữa"
[ "$(psqlq "SELECT COUNT(*) FROM leads")" = 1 ] || fail "số yêu cầu đổi"
echo "ok"

echo "== 5. apply tự chuyển tiếp sang cập nhật backend khi đã cài"
run apply > "$T/out5" 2>&1 || { cat "$T/out5"; fail "apply"; }
grep -q 'cập nhật luôn' "$T/out5" || fail "apply không chuyển tiếp"
echo "ok"

echo "== 6. Đặt lại mật khẩu"
run cms-password > "$T/out6" 2>&1 || { cat "$T/out6"; fail "cms-password"; }
grep -q 'Mật khẩu mới:' "$T/out6" || fail "không in mật khẩu mới"
echo "ok"
echo; echo "TẤT CẢ ĐẠT"
