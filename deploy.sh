#!/usr/bin/env bash
# 3RDHub Vietnam: đưa website (Vue, đã build sẵn) + backend Go + PostgreSQL lên VPS Ubuntu.
# Không đụng vào các site khác trên server. Máy chủ KHÔNG cần Node.js: giao diện đã build sẵn trong site/ và admin/.
#
#   bash deploy.sh check          chỉ ĐỌC, cho biết server đang có gì, không đổi gì
#   bash deploy.sh apply          cài website (sao lưu, kiểm tra cấu hình, tự gỡ nếu lỗi); nếu backend đã cài thì cập nhật luôn backend
#   bash deploy.sh cms            cài/cập nhật backend: tự cài PostgreSQL + Go, tạo CSDL, build, nạp dữ liệu bản cũ (SQLite), dịch vụ nền, cms.<domain>
#   bash deploy.sh cms-password   đặt lại mật khẩu quản trị CMS (in mật khẩu mới ra màn hình)
#   EMAIL=ban@mail.com bash deploy.sh ssl   (tuỳ chọn) HTTPS Let's Encrypt cho nginx
#
# Biến tuỳ chọn: DOMAIN (mặc định 3rdhubvietnam.tech), CMS_SUB (mặc định cms.$DOMAIN),
#   ADMIN_PASSWORD (mật khẩu quản trị ban đầu; bỏ trống thì tự tạo), FORCE=1 (ghi đè khi trùng tên miền),
#   GO_BIN (đường dẫn go có sẵn), GO_VERSION (phiên bản Go tự tải nếu máy chưa có, mặc định 1.22.12)
set -euo pipefail

DOMAIN="${DOMAIN:-3rdhubvietnam.tech}"
CMS_SUB="${CMS_SUB:-cms.$DOMAIN}"
WEBROOT="${WEBROOT:-/var/www/$DOMAIN}"
ETC="${ETC:-/etc}"
CMS_DIR="${CMS_DIR:-/opt/3rdhub-cms}"
CMS_DATA="${CMS_DATA:-/var/lib/3rdhub-cms}"
CMS_ENV="${CMS_ENV:-$ETC/3rdhub-cms.env}"
UNIT_DIR="${UNIT_DIR:-$ETC/systemd/system}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE="$HERE/site"
ADMIN_SRC="$HERE/admin"
SERVER_SRC="$HERE/server"
DB_NAME="${DB_NAME:-tdhubcms}"
DB_USER="${DB_USER:-tdhubcms}"
GO_VERSION="${GO_VERSION:-1.22.12}"
MODE="${1:-check}"
STAMP="$(date +%Y%m%d-%H%M%S)"

say()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mX %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Hãy chạy bằng root (hoặc thêm sudo)."

# chỉ một lần triển khai chạy tại một thời điểm (cron 2 phút/lần có thể chồng lên lần cài đầu vốn lâu hơn)
if [ "$MODE" != check ] && command -v flock >/dev/null 2>&1; then
  exec 9>"${LOCK_FILE:-/var/lock/3rdhub-deploy.lock}" 2>/dev/null || exec 9>"/tmp/3rdhub-deploy.lock"
  flock -n 9 || { echo "Đang có một lần triển khai khác chạy, bỏ qua lần này."; exit 0; }
fi

NGINX=""
for c in "$(command -v nginx 2>/dev/null || true)" /www/server/nginx/sbin/nginx /usr/local/nginx/sbin/nginx /usr/sbin/nginx; do
  if [ -n "$c" ] && [ -x "$c" ]; then NGINX="$c"; break; fi
done
APACHE="$(command -v apache2ctl 2>/dev/null || command -v apachectl 2>/dev/null || true)"

# nạp lại nginx rồi chờ worker mới nhận cấu hình (tránh kiểm tra nhầm vào cấu hình cũ)
reload_nginx() { systemctl reload nginx 2>/dev/null || "$NGINX" -s reload; sleep 2; }
http_code() { curl -s -o /dev/null -m 8 -w '%{http_code}' -H "Host: $1" "http://127.0.0.1${2:-/}" 2>/dev/null || echo "---"; }
cms_installed() { [ -f "$CMS_ENV" ]; }
cms_port() { grep -E '^PORT=' "$CMS_ENV" 2>/dev/null | head -1 | cut -d= -f2; }

# các file nginx có server_name chứa đúng tên miền (tham số: danh sách tên)
nginx_host_files() {
  "$NGINX" -T 2>/dev/null | awk -v names="$*" '
    BEGIN{n=split(names,N," ")}
    /^# configuration file /{f=$4; sub(":$","",f)}
    /server_name[ \t]/ && !/^[ \t]*#/ {
      s=$0; sub(/.*server_name[ \t]+/,"",s)
      m=split(s,a,/[ \t;{}]+/)
      for(i=1;i<=m;i++) for(j=1;j<=n;j++) if(a[i]==N[j]){print f; next}
    }' | sort -u
}

conf_paths() { # $1=tên file conf -> đặt TARGET và LINK
  LINK=""
  if   [ -d "$ETC/nginx/sites-available" ] && [ -d "$ETC/nginx/sites-enabled" ]; then TARGET="$ETC/nginx/sites-available/$1"; LINK="$ETC/nginx/sites-enabled/$1"
  elif [ -d /www/server/panel/vhost/nginx ]; then TARGET="/www/server/panel/vhost/nginx/$1"
  elif [ -d "$ETC/nginx/conf.d" ]; then TARGET="$ETC/nginx/conf.d/$1"
  else die "Không xác định được thư mục cấu hình nginx. Chạy 'bash deploy.sh check' rồi gửi kết quả cho người hỗ trợ."; fi
}

# cài một file vhost nginx: sao lưu, kiểm tra, nạp lại, tự gỡ nếu lỗi. Đọc nội dung từ stdin.
# $1=tên file conf, $2=các tên miền khai báo (để phát hiện trùng)
install_vhost() {
  local name="$1" hosts="$2" TARGET LINK found others
  conf_paths "$name"
  found="$(nginx_host_files $hosts || true)"
  others="$(printf '%s\n' "$found" | grep -v -x -F -e "$TARGET" -e "${LINK:-__none__}" | grep -v '^$' || true)"
  if [ -n "$others" ] && [ "${FORCE:-0}" != 1 ]; then
    warn "Đã có cấu hình khác khai báo ($hosts), dừng lại để không ghi đè:"; echo "$others"
    die "Kiểm tra file trên. Nếu chắc chắn muốn thay, chạy lại với FORCE=1"
  fi
  local new; new="$(cat)"
  if [ -f "$TARGET" ] && { [ -z "$LINK" ] || [ -e "$LINK" ]; } \
     && [ "$(grep -v '^#' "$TARGET")" = "$(printf '%s\n' "$new" | grep -v '^#')" ]; then
    ok "Không đổi: $name"; return 0
  fi
  backup_nginx
  [ -f "$TARGET" ] && cp -a "$TARGET" "$TARGET.bak-$STAMP"
  printf '%s\n' "$new" > "$TARGET"
  [ -n "$LINK" ] && ln -sf "$TARGET" "$LINK"
  if "$NGINX" -t >"/tmp/nginx-test.$$" 2>&1; then
    reload_nginx && ok "Đã nạp nginx: $name"
  else
    cat "/tmp/nginx-test.$$" >&2
    rm -f "$TARGET" ${LINK:+"$LINK"}
    if [ -f "$TARGET.bak-$STAMP" ]; then mv "$TARGET.bak-$STAMP" "$TARGET"; [ -n "$LINK" ] && ln -sf "$TARGET" "$LINK"; fi
    rm -f "/tmp/nginx-test.$$"
    die "Cấu hình $name lỗi, đã gỡ file vừa thêm và KHÔNG nạp lại nginx. Server giữ nguyên như cũ."
  fi
  rm -f "/tmp/nginx-test.$$"
}

trap 'rm -f "/tmp/.3rdhub-nginx-backup-$STAMP"' EXIT
backup_nginx() {
  local mark="/tmp/.3rdhub-nginx-backup-$STAMP"
  [ -f "$mark" ] && return 0
  : > "$mark"
  tar czf "/root/backup-nginx-$STAMP.tgz" -C "$(dirname "$ETC/nginx")" "$(basename "$ETC/nginx")" 2>/dev/null \
    && ok "Đã sao lưu cấu hình nginx: /root/backup-nginx-$STAMP.tgz" \
    || warn "Không sao lưu được thư mục nginx (tiếp tục vì chỉ thêm file mới)"
}

# giữ KEEP_BACKUPS (mặc định 10) bản sao lưu mới nhất mỗi loại, xoá bản cũ hơn
prune_backups() {
  local keep="${KEEP_BACKUPS:-10}" pat f d n
  for pat in 'backup-nginx-*.tgz' "backup-site-$DOMAIN-*.tgz" 'backup-apache-*.tgz'; do
    find /root -maxdepth 1 -type f -name "$pat" -printf '%T@ %p\n' 2>/dev/null | sort -rn | tail -n +"$((keep+1))" | cut -d' ' -f2- \
      | while IFS= read -r f; do rm -f -- "$f"; done
  done
  for d in "$ETC/nginx/sites-available" /www/server/panel/vhost/nginx "$ETC/nginx/conf.d"; do
    [ -d "$d" ] || continue
    for n in "$DOMAIN" "$CMS_SUB"; do
      find "$d" -maxdepth 1 -type f -name "$n.conf.bak-*" -printf '%T@ %p\n' 2>/dev/null | sort -rn | tail -n +6 | cut -d' ' -f2- \
        | while IFS= read -r f; do rm -f -- "$f"; done
    done
  done
  return 0
}

# ----------------------------------------------------------------- check
do_check() {
  say "Hệ thống"
  . "$ETC/os-release" 2>/dev/null && echo "$PRETTY_NAME"
  df -h / | tail -1
  say "Cổng 80/443 do tiến trình nào giữ"
  (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':(80|443)[[:space:]]' || echo "(không có tiến trình nào)"
  say "Web server"
  if [ -n "$NGINX" ]; then echo "nginx: $NGINX ($("$NGINX" -v 2>&1))"; else echo "không thấy nginx"; fi
  [ -n "$APACHE" ] && echo "apache: $APACHE" || true
  if find_go >/dev/null 2>&1; then echo "go: $("$(find_go)" version)"; else echo "go: chưa có (deploy.sh cms sẽ tự cài Go $GO_VERSION)"; fi
  if command -v psql >/dev/null 2>&1; then echo "postgresql: $(psql --version)"; else echo "postgresql: chưa cài (deploy.sh cms sẽ tự cài)"; fi
  command -v python3 >/dev/null 2>&1 && echo "python3: $(python3 -V 2>&1) (chỉ dùng khi nạp dữ liệu từ bản CMS cũ)" || echo "python3: chưa cài"
  say "Panel quản lý (nếu có)"
  ls -d /www/server/panel /usr/local/CyberCP /opt/1panel /etc/1panel /home/cloudpanel 2>/dev/null || echo "không thấy aaPanel / CyberPanel / 1Panel / CloudPanel"
  if [ -n "$NGINX" ]; then
    say "Các site nginx đang có (server_name, listen, root, proxy_pass)"
    "$NGINX" -T 2>/dev/null | awk '/^# configuration file /{f=$4; sub(":$","",f)} /^[ \t]*(server_name|listen|root|proxy_pass)[ \t]/ && !/^[ \t]*#/{gsub(/^[ \t]+/,""); print f": "$0}' | head -80
    say "Cấu hình nào đã nhắc tới $DOMAIN và $CMS_SUB"
    f="$(nginx_host_files "$DOMAIN" "www.$DOMAIN" "$CMS_SUB" || true)"; [ -n "$f" ] && echo "$f" || echo "chưa có (an toàn để thêm mới)"
  fi
  say "Thư mục web"
  ls -la /var/www 2>/dev/null || echo "/var/www chưa có"
  ls -la "$WEBROOT" 2>/dev/null || echo "$WEBROOT chưa có"
  say "CMS"
  if cms_installed; then
    echo "đã cài, cổng $(cms_port)"; systemctl is-active 3rdhub-cms 2>/dev/null || true
    if grep -q '^DATABASE_URL=' "$CMS_ENV" 2>/dev/null; then echo "backend: Go + PostgreSQL"; else echo "backend: bản cũ (Python + SQLite), sẽ được nâng cấp khi chạy 'bash deploy.sh cms'"; fi
  else echo "chưa cài"; fi
  systemctl is-active postgresql 2>/dev/null | sed 's/^/postgresql: /' || true
  say "Firewall"
  if command -v ufw >/dev/null 2>&1; then ufw status | head -10; else echo "không dùng ufw"; fi
  say "DNS máy này thấy"
  getent hosts "$DOMAIN" "$CMS_SUB" || echo "(không phân giải được, bình thường nếu DNS vừa đổi)"
  say "Phản hồi hiện tại của server với từng tên miền"
  echo "$DOMAIN     -> HTTP $(http_code "$DOMAIN")"
  echo "$CMS_SUB -> HTTP $(http_code "$CMS_SUB")"
  echo; ok "Xong. Chưa có gì bị thay đổi."
}

# ----------------------------------------------------------------- site tĩnh
site_unchanged() {
  [ -d "$WEBROOT" ] || return 1
  local f
  while IFS= read -r -d '' f; do cmp -s "$SITE/$f" "$WEBROOT/$f" || return 1; done < <(cd "$SITE" && find . -type f -print0)
  return 0
}
install_files() {
  [ -f "$SITE/index.html" ] || die "Không thấy $SITE/index.html. Giải nén đủ gói rồi chạy lại."
  if site_unchanged; then ok "Site không đổi, giữ nguyên $WEBROOT"; return 0; fi
  mkdir -p "$WEBROOT"
  if [ -n "$(ls -A "$WEBROOT" 2>/dev/null)" ]; then
    tar czf "/root/backup-site-$DOMAIN-$STAMP.tgz" -C "$WEBROOT" . && ok "Đã sao lưu thư mục web cũ: /root/backup-site-$DOMAIN-$STAMP.tgz"
  fi
  cp -a "$SITE"/. "$WEBROOT"/
  find "$WEBROOT" -type d -exec chmod 755 {} +; find "$WEBROOT" -type f -exec chmod 644 {} +
  if   id www-data >/dev/null 2>&1; then chown -R www-data:www-data "$WEBROOT"
  elif id www >/dev/null 2>&1;      then chown -R www:www "$WEBROOT"
  elif id nginx >/dev/null 2>&1;    then chown -R nginx:nginx "$WEBROOT"; fi
  ok "Đã chép site vào $WEBROOT"
}

proxy_block() { # $1=cổng
  cat <<PB
        proxy_pass http://127.0.0.1:$1;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 30s;
PB
}

main_vhost() {
  local api=""
  if cms_installed; then
    local port; port="$(cms_port)"
    api="
    # Backend Go: chỉ mở 3 đường dẫn công khai. Trang quản trị nằm ở $CMS_SUB
    location = /api/content {
$(proxy_block "$port")
    }
    location = /api/lead {
        client_max_body_size 64k;
$(proxy_block "$port")
    }
    location ^~ /uploads/ {
$(proxy_block "$port")
    }
    location ^~ /api/ { return 404; }
"
  fi
  cat <<CONF
# 3RDHub Vietnam: website (Vue, build sẵn). Tạo bởi deploy.sh $STAMP
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    root $WEBROOT;
    index index.html;
    charset utf-8;

    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_min_length 512;
    gzip_types text/css application/javascript application/json image/svg+xml text/plain;

    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
$api
    location / {
        try_files \$uri \$uri/ /index.html;
        expires -1;
    }
    location ^~ /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    location ~* \.(?:png|ico|svg|webp|webmanifest)$ {
        expires 7d;
    }
    location ~ /\. { deny all; }
}
CONF
}

apply_nginx() {
  local CMS_BEFORE; CMS_BEFORE="$(http_code "$CMS_SUB")"
  install_files
  main_vhost | install_vhost "$DOMAIN.conf" "$DOMAIN www.$DOMAIN"
  if [ "${SKIP_VERIFY:-0}" != 1 ]; then
    say "Kiểm tra sau khi cài"
    echo "$DOMAIN     -> HTTP $(http_code "$DOMAIN")  (mong đợi 200)"
    echo "$CMS_SUB -> HTTP $(http_code "$CMS_SUB")  (trước đó: $CMS_BEFORE)"
    [ "$(http_code "$CMS_SUB")" = "$CMS_BEFORE" ] && ok "Site khác trên server không bị ảnh hưởng" || warn "Mã phản hồi của $CMS_SUB thay đổi, hãy kiểm tra ngay"
  fi
}

apply_apache() {
  local TARGET="$ETC/apache2/sites-available/$DOMAIN.conf"
  [ -d "$ETC/apache2/sites-available" ] || die "Không thấy thư mục sites-available của apache2."
  [ -f "$TARGET" ] && [ "${FORCE:-0}" != 1 ] && die "$TARGET đã tồn tại. Chạy FORCE=1 để ghi đè."
  tar czf "/root/backup-apache-$STAMP.tgz" -C "$ETC" apache2 2>/dev/null && ok "Đã sao lưu cấu hình apache: /root/backup-apache-$STAMP.tgz" || true
  install_files
  cat > "$TARGET" <<CONF
<VirtualHost *:80>
    ServerName $DOMAIN
    ServerAlias www.$DOMAIN
    DocumentRoot $WEBROOT
    <Directory $WEBROOT>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
    </Directory>
</VirtualHost>
CONF
  a2ensite "$DOMAIN.conf" >/dev/null
  if "$APACHE" configtest; then systemctl reload apache2 && ok "Đã nạp lại apache"; else a2dissite "$DOMAIN.conf" >/dev/null; rm -f "$TARGET"; die "Cấu hình apache lỗi, đã gỡ file vừa thêm."; fi
  warn "Apache chỉ phục vụ site tĩnh. CMS cần nginx (bash deploy.sh cms)."
}

do_apply() {
  if   [ -n "$NGINX" ];  then apply_nginx
  elif [ -n "$APACHE" ]; then apply_apache
  else die "Không thấy nginx hay apache. Chạy 'bash deploy.sh check' rồi gửi kết quả cho người hỗ trợ."; fi
  prune_backups
  echo; ok "Hoàn tất website. Mở: http://$DOMAIN"
  echo "Nếu dùng Cloudflare (đám mây cam): vào SSL/TLS và chọn 'Flexible' để chạy HTTPS ngay."
  if cms_installed && [ -n "$NGINX" ] && [ "${NO_CHAIN:-0}" != 1 ]; then
    say "Backend đã cài trên máy này: cập nhật luôn"
    do_cms
  else
    echo "Muốn thêm CMS: bash deploy.sh cms"
  fi
}

# ----------------------------------------------------------------- Backend Go + PostgreSQL
# chạy lệnh với quyền người dùng dịch vụ (khi thử nghiệm SKIP_SYSTEM=1 thì chạy bằng chính người đang gọi)
as_cms() { if [ "${SKIP_SYSTEM:-0}" = 1 ]; then "$@"; else runuser -u tdhubcms -- "$@"; fi; }
pg_psql() { (cd /tmp && runuser -u postgres -- env ${PGPORT:+PGPORT=$PGPORT} ${PGHOST:+PGHOST=$PGHOST} psql -v ON_ERROR_STOP=1 -tAq "$@"); }

go_ok() { # $1=đường dẫn go; đạt nếu >= 1.22
  local v maj min
  v="$(GOTOOLCHAIN=local "$1" env GOVERSION 2>/dev/null | sed 's/^go//')" || return 1
  maj="${v%%.*}"; min="${v#*.}"; min="${min%%.*}"
  case "$maj$min" in ''|*[!0-9]*) return 1 ;; esac
  [ "$maj" -gt 1 ] || { [ "$maj" -eq 1 ] && [ "$min" -ge 22 ]; }
}
find_go() {
  local c
  for c in "${GO_BIN:-}" /usr/local/go/bin/go "$(command -v go 2>/dev/null || true)"; do
    [ -n "$c" ] && [ -x "$c" ] && go_ok "$c" && { echo "$c"; return 0; }
  done
  return 1
}
install_go() {
  [ "${SKIP_SYSTEM:-0}" != 1 ] || die "Thiếu Go >= 1.22 (đang ở chế độ thử SKIP_SYSTEM, không tự cài)."
  local arch tgz tmp sum want
  case "$(uname -m)" in x86_64|amd64) arch=amd64 ;; aarch64|arm64) arch=arm64 ;; *) die "CPU $(uname -m) chưa hỗ trợ tự cài Go. Cài Go >= 1.22 thủ công rồi chạy lại (hoặc đặt GO_BIN=/đường/dẫn/go)." ;; esac
  tgz="go${GO_VERSION}.linux-${arch}.tar.gz"; tmp="$(mktemp -d)"
  say "Tải Go $GO_VERSION ($arch) từ go.dev"
  curl -fsSL -m 600 -o "$tmp/$tgz" "https://go.dev/dl/$tgz" || { rm -rf "$tmp"; die "Không tải được Go. Kiểm tra mạng của VPS hoặc cài Go >= 1.22 thủ công (GO_BIN=/đường/dẫn/go)."; }
  want="$(curl -fsSL -m 60 'https://go.dev/dl/?mode=json&include=all' | python3 -c 'import json,sys
n=sys.argv[1]
for r in json.load(sys.stdin):
    for f in r["files"]:
        if f["filename"]==n: print(f["sha256"]); raise SystemExit' "$tgz" || true)"
  sum="$(sha256sum "$tmp/$tgz" | cut -d' ' -f1)"
  [ -n "$want" ] && [ "$sum" = "$want" ] || { rm -rf "$tmp"; die "Không xác minh được checksum của $tgz, dừng để an toàn."; }
  tar -C "$tmp" -xzf "$tmp/$tgz"
  rm -rf "/usr/local/go-$GO_VERSION"; mv "$tmp/go" "/usr/local/go-$GO_VERSION"; rm -rf "$tmp"
  if [ -e /usr/local/go ] && [ ! -L /usr/local/go ]; then mv /usr/local/go "/usr/local/go.old-$STAMP"; fi
  ln -sfn "/usr/local/go-$GO_VERSION" /usr/local/go
  ok "Đã cài Go $GO_VERSION vào /usr/local/go"
}
ensure_go() { find_go >/dev/null 2>&1 || install_go; find_go >/dev/null 2>&1 || die "Vẫn không có Go >= 1.22."; }

ensure_postgres() {
  if ! pg_psql -c 'SELECT 1' >/dev/null 2>&1; then
    if ! command -v psql >/dev/null 2>&1 || ! id postgres >/dev/null 2>&1; then
      [ "${SKIP_SYSTEM:-0}" != 1 ] || die "Không có PostgreSQL (đang ở chế độ thử SKIP_SYSTEM, không tự cài)."
      say "Cài PostgreSQL"
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -y >/dev/null && apt-get install -y postgresql >/dev/null || die "apt không cài được postgresql."
    fi
    if [ "${SKIP_SYSTEM:-0}" != 1 ]; then systemctl enable --now postgresql >/dev/null 2>&1 || true; fi
    local i; for i in $(seq 1 40); do pg_psql -c 'SELECT 1' >/dev/null 2>&1 && break; sleep 1; done
    pg_psql -c 'SELECT 1' >/dev/null 2>&1 || die "PostgreSQL không chạy. Xem: systemctl status postgresql"
  fi
  ok "PostgreSQL sẵn sàng ($(pg_psql -c 'SHOW server_version' | cut -d' ' -f1))"
}
ensure_db() {
  [ "$(pg_psql -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'")" = 1 ] || { pg_psql -c "CREATE ROLE \"$DB_USER\" LOGIN" >/dev/null; ok "Đã tạo vai trò CSDL $DB_USER"; }
  [ "$(pg_psql -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")" = 1 ] || { pg_psql -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\"" >/dev/null; ok "Đã tạo CSDL $DB_NAME"; }
}
# kết nối qua unix socket, xác thực bằng chính người dùng hệ điều hành (peer): không có mật khẩu CSDL nào để lộ
db_url() {
  local sock port
  sock="$(pg_psql -c 'SHOW unix_socket_directories' | cut -d, -f1 | tr -d ' ')"; port="$(pg_psql -c 'SHOW port')"
  printf 'postgres://%s@/%s?host=%s&port=%s&sslmode=disable' "$DB_USER" "$DB_NAME" "$sock" "$port"
}

# đặt KEY=VALUE trong file môi trường; trả về 0 nếu có thay đổi
env_set() {
  local k="$1" v="$2" cur rest
  cur="$(grep -E "^$k=" "$CMS_ENV" | head -1 | cut -d= -f2- || true)"
  [ "$cur" = "$v" ] && return 1
  rest="$(grep -v "^$k=" "$CMS_ENV" || true)"
  { [ -n "$rest" ] && printf '%s\n' "$rest"; printf '%s=%s\n' "$k" "$v"; } > "$CMS_ENV"
  return 0
}

# tên cổng trống đầu tiên từ 8787
free_port() { local p; for p in $(seq 8787 8829); do ss -ltn 2>/dev/null | awk '{print $4}' | grep -q ":$p\$" || { echo "$p"; return; }; done; }
rand_pass() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom 2>/dev/null | head -c 16 || true; }

# mã nguồn Go đổi thì mới build lại (dấu vân tay của thư mục server/, kể cả vendor/)
server_hash() { (cd "$SERVER_SRC" && find . -type f ! -name '*_test.go' -print0 | sort -z | xargs -0 sha256sum | sha256sum | cut -d' ' -f1); }
build_server() {
  local GO h; GO="$(find_go)"; h="$(server_hash)"
  if [ -x "$CMS_DIR/server" ] && [ "$(cat "$CMS_DIR/.build-hash" 2>/dev/null)" = "$h" ]; then ok "Backend không đổi mã nguồn, không build lại"; return 1; fi
  say "Build backend Go ($("$GO" env GOVERSION))"
  mkdir -p "$CMS_DIR"
  ( cd "$SERVER_SRC" && HOME="${HOME:-/root}" GOCACHE="${GOCACHE:-/var/cache/3rdhub-gocache}" GOTOOLCHAIN=local GOFLAGS=-mod=vendor CGO_ENABLED=0 \
      "$GO" build -trimpath -o "$CMS_DIR/server.new" . ) || { rm -f "$CMS_DIR/server.new"; die "Build backend thất bại (xem lỗi ở trên). Backend đang chạy được giữ nguyên."; }
  echo "$h" > "$CMS_DIR/.build-hash.new"
  return 0
}

migrate_legacy() {
  local old="$CMS_DATA/cms.db" dump="$CMS_DATA/legacy-dump.json" rc=0
  [ -f "$old" ] && [ ! -f "$CMS_DATA/.sqlite-imported" ] || return 0
  command -v python3 >/dev/null 2>&1 || die "Cần python3 để đọc dữ liệu bản CMS cũ (SQLite). apt-get install -y python3"
  say "Nạp dữ liệu bản CMS cũ (SQLite) vào PostgreSQL"
  python3 "$HERE/tools/export-sqlite.py" "$old" > "$dump" || { rm -f "$dump"; die "Không đọc được $old."; }
  [ "${SKIP_SYSTEM:-0}" = 1 ] || chown tdhubcms:tdhubcms "$dump"; chmod 600 "$dump"
  as_cms env DATABASE_URL="$DB_URL" CMS_DATA="$CMS_DATA" ADMIN_DIR="$CMS_DIR/admin" "$CMS_DIR/server" import "$dump" "$CMS_DATA/uploads" || rc=$?
  rm -f "$dump"
  case "$rc" in
    0) ok "Đã nạp nội dung, yêu cầu khách và lịch sử từ bản cũ" ;;
    3) warn "CSDL PostgreSQL đã có dữ liệu, bỏ qua bước nạp từ bản cũ (giữ nguyên dữ liệu hiện có)" ;;
    *) die "Nạp dữ liệu từ bản cũ thất bại (mã $rc). Bản cũ vẫn còn nguyên ở $old." ;;
  esac
  mv "$old" "$old.migrated-$STAMP"; rm -f "$old-wal" "$old-shm"; : > "$CMS_DATA/.sqlite-imported"
}

do_cms() {
  [ -n "$NGINX" ] || die "CMS hiện chỉ cấu hình tự động cho nginx. Chạy 'bash deploy.sh check' rồi gửi kết quả cho người hỗ trợ."
  [ -f "$SERVER_SRC/main.go" ] && [ -f "$ADMIN_SRC/index.html" ] || die "Thiếu server/ hoặc admin/ trong gói."

  say "Chuẩn bị PostgreSQL và Go"
  ensure_go
  ensure_postgres
  ensure_db
  DB_URL="$(db_url)"

  mkdir -p "$CMS_DATA" "$CMS_DIR"
  if [ "${SKIP_SYSTEM:-0}" != 1 ]; then
    id tdhubcms >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin tdhubcms
    chown -R tdhubcms:tdhubcms "$CMS_DATA"; chmod 750 "$CMS_DATA"
  fi

  local RESTART=0 BUILT=0 LEGACY=0 UNITF="$UNIT_DIR/3rdhub-cms.service" NEWPASS=""
  [ -f "$CMS_DIR/server.py" ] && LEGACY=1
  build_server && BUILT=1
  [ "$BUILT" = 1 ] && RESTART=1

  # sao lưu bản cũ (Python) trước khi thay, để quay lại được nếu bản mới không chạy
  local LEGACY_TGZ=""
  if [ "$LEGACY" = 1 ]; then
    LEGACY_TGZ="/root/backup-cms-legacy-$STAMP.tgz"
    tar czf "$LEGACY_TGZ" -C / "${CMS_DIR#/}" "${UNITF#/}" "${CMS_ENV#/}" $( [ -f "$CMS_DATA/cms.db" ] && echo "${CMS_DATA#/}/cms.db" ) 2>/dev/null \
      && ok "Đã sao lưu bản CMS cũ: $LEGACY_TGZ" || warn "Không sao lưu được bản cũ đầy đủ (tiếp tục, dữ liệu SQLite vẫn còn nguyên)"
  fi

  say "Cài mã nguồn backend vào $CMS_DIR"
  if [ "$BUILT" = 1 ]; then mv -f "$CMS_DIR/server.new" "$CMS_DIR/server"; mv -f "$CMS_DIR/.build-hash.new" "$CMS_DIR/.build-hash"; chmod 755 "$CMS_DIR/server"; fi
  if ! diff -rq "$ADMIN_SRC" "$CMS_DIR/admin" >/dev/null 2>&1; then
    rm -rf "$CMS_DIR/admin"; cp -a "$ADMIN_SRC" "$CMS_DIR/admin"
    find "$CMS_DIR/admin" -type d -exec chmod 755 {} +; find "$CMS_DIR/admin" -type f -exec chmod 644 {} +
  fi
  if [ "$LEGACY" = 1 ]; then rm -rf "$CMS_DIR/server.py" "$CMS_DIR/defaults.json" "$CMS_DIR/seed" "$CMS_DIR/data"; fi
  rm -f "$CMS_DIR/.build-hash.new" "$CMS_DIR/server.new"

  # file cấu hình môi trường: tạo mới, hoặc bổ sung các khoá của backend Go vào file cũ
  if [ ! -f "$CMS_ENV" ]; then
    local port pass; port="$(free_port)"; [ -n "$port" ] || die "Không tìm được cổng trống từ 8787 đến 8829."
    pass="${ADMIN_PASSWORD:-$(rand_pass)}"
    umask 077
    cat > "$CMS_ENV" <<ENV
PORT=$port
BIND=127.0.0.1
CMS_DATA=$CMS_DATA
CMS_HOSTS=$CMS_SUB
DATABASE_URL=$DB_URL
ADMIN_DIR=$CMS_DIR/admin
CMS_ADMIN_PASSWORD=$pass
ENV
    umask 022
    NEWPASS="$pass"; RESTART=1
    ok "Đã tạo $CMS_ENV (cổng $port)"
  else
    if env_set DATABASE_URL "$DB_URL"; then RESTART=1; fi
    if env_set ADMIN_DIR "$CMS_DIR/admin"; then RESTART=1; fi
  fi
  local PORT; PORT="$(cms_port)"

  mkdir -p "$UNIT_DIR"
  cat > "$UNITF.new" <<UNIT
[Unit]
Description=3RDHub CMS (Go + PostgreSQL)
After=network.target postgresql.service
Wants=postgresql.service

[Service]
User=tdhubcms
Group=tdhubcms
WorkingDirectory=$CMS_DIR
EnvironmentFile=$CMS_ENV
ExecStart=$CMS_DIR/server serve
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$CMS_DATA

[Install]
WantedBy=multi-user.target
UNIT
  if ! cmp -s "$UNITF.new" "$UNITF" 2>/dev/null; then mv -f "$UNITF.new" "$UNITF"; RESTART=1; else rm -f "$UNITF.new"; fi

  if [ "${SKIP_SYSTEM:-0}" != 1 ]; then
    systemctl is-active --quiet 3rdhub-cms || RESTART=1
    if [ -f "$CMS_DATA/cms.db" ] && [ ! -f "$CMS_DATA/.sqlite-imported" ]; then
      systemctl stop 3rdhub-cms 2>/dev/null || true   # ngắt bản cũ trước khi đọc SQLite để không mất dữ liệu ghi dở
      RESTART=1
    fi
  fi
  migrate_legacy
  if [ "${SKIP_SYSTEM:-0}" != 1 ]; then
    if [ "$RESTART" = 1 ]; then
      systemctl daemon-reload && systemctl enable 3rdhub-cms >/dev/null 2>&1 && systemctl restart 3rdhub-cms
      ok "Đã khởi động lại CMS (mã nguồn hoặc cấu hình dịch vụ có đổi)"
    else
      ok "CMS không đổi, giữ nguyên tiến trình đang chạy"
    fi
    local i; for i in $(seq 1 40); do curl -fsS "http://127.0.0.1:$PORT/api/content" >/dev/null 2>&1 && break; sleep 0.5; done
    if ! curl -fsS "http://127.0.0.1:$PORT/api/content" >/dev/null 2>&1; then
      journalctl -u 3rdhub-cms -n 30 --no-pager >&2 || true
      if [ -n "$LEGACY_TGZ" ] && [ -f "$LEGACY_TGZ" ]; then
        warn "Backend mới không chạy được, đang quay lại bản cũ từ $LEGACY_TGZ"
        systemctl stop 3rdhub-cms 2>/dev/null || true
        tar xzf "$LEGACY_TGZ" -C / && systemctl daemon-reload && systemctl restart 3rdhub-cms && warn "Đã khôi phục bản CMS cũ. Gửi log ở trên cho người hỗ trợ."
        rm -f "$CMS_DATA/.sqlite-imported"
      fi
      die "Backend không khởi động được. Xem log ở trên."
    fi
    ok "CMS đang chạy (dịch vụ 3rdhub-cms, cổng $PORT, chỉ nghe trên 127.0.0.1)"
    # mật khẩu ban đầu chỉ cần cho lần chạy đầu: gỡ khỏi file cấu hình
    sed -i '/^CMS_ADMIN_PASSWORD=/d' "$CMS_ENV"
  else
    [ "$RESTART" = 1 ] && ok "(thử) CMS sẽ được khởi động lại" || ok "(thử) CMS không cần khởi động lại"
  fi

  say "Cấu hình nginx cho $CMS_SUB và nối API vào $DOMAIN"
  {
    cat <<CONF
# 3RDHub CMS: trang quản trị. Tạo bởi deploy.sh $STAMP
server {
    listen 80;
    listen [::]:80;
    server_name $CMS_SUB;
    client_max_body_size 3m;
    add_header X-Robots-Tag "noindex, nofollow" always;
    location / {
$(proxy_block "$PORT")
    }
}
CONF
  } | install_vhost "$CMS_SUB.conf" "$CMS_SUB"
  install_files
  main_vhost | install_vhost "$DOMAIN.conf" "$DOMAIN www.$DOMAIN"

  if [ "${SKIP_VERIFY:-0}" != 1 ]; then
    say "Kiểm tra"
    echo "$DOMAIN/api/content -> HTTP $(http_code "$DOMAIN" /api/content)  (mong đợi 200)"
    echo "$DOMAIN/api/admin/me -> HTTP $(http_code "$DOMAIN" /api/admin/me)  (mong đợi 404: quản trị không mở ở tên miền chính)"
    echo "$CMS_SUB/ -> HTTP $(http_code "$CMS_SUB" /)  (mong đợi 200)"
  fi
  prune_backups
  echo
  ok "CMS đã cài xong."
  echo "  Trang quản trị: http://$CMS_SUB   (dùng https nếu Cloudflare đã bật)"
  if [ -n "$NEWPASS" ]; then
    echo "  Mật khẩu quản trị lần đầu: $NEWPASS"
    echo "  (chỉ hiện một lần. Vào Cài đặt trong CMS để đổi ngay. Quên mật khẩu: bash deploy.sh cms-password)"
  else
    echo "  CMS đã có sẵn từ trước: mật khẩu giữ nguyên. Quên mật khẩu: bash deploy.sh cms-password"
  fi
  echo "  Trên Cloudflare: thêm bản ghi DNS cho '${CMS_SUB%%.*}' trỏ về IP VPS (cùng IP với $DOMAIN)."
}

do_cms_password() {
  cms_installed || die "CMS chưa được cài (không thấy $CMS_ENV)."
  local pw url; pw="$(rand_pass)"
  url="$(grep -E '^DATABASE_URL=' "$CMS_ENV" | head -1 | cut -d= -f2-)"
  [ -n "$url" ] || die "CMS đang là bản cũ (chưa có PostgreSQL). Chạy 'bash deploy.sh cms' trước."
  as_cms env DATABASE_URL="$url" CMS_DATA="$CMS_DATA" ADMIN_DIR="$CMS_DIR/admin" "$CMS_DIR/server" reset-password "$pw" >/dev/null
  systemctl restart 3rdhub-cms 2>/dev/null || true
  ok "Đã đặt lại mật khẩu quản trị."
  echo "  Mật khẩu mới: $pw"
}

do_ssl() {
  [ -n "$NGINX" ] || die "Bước ssl hiện chỉ hỗ trợ nginx."
  : "${EMAIL:?Đặt EMAIL, ví dụ: EMAIL=ban@mail.com bash deploy.sh ssl}"
  command -v certbot >/dev/null 2>&1 || { apt-get update -y && apt-get install -y certbot python3-certbot-nginx; }
  local d=(-d "$DOMAIN" -d "www.$DOMAIN"); cms_installed && d+=(-d "$CMS_SUB")
  certbot --nginx "${d[@]}" --redirect --non-interactive --agree-tos -m "$EMAIL"
  ok "Đã cấu hình HTTPS."
}

case "$MODE" in
  check)        do_check ;;
  apply)        do_apply ;;
  cms)          do_cms ;;
  cms-password) do_cms_password ;;
  ssl)          do_ssl ;;
  *)            die "Dùng: bash deploy.sh check | apply | cms | cms-password | ssl" ;;
esac
