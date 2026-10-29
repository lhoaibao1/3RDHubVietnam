#!/usr/bin/env bash
# 3RDHub Vietnam: đưa site tĩnh + CMS lên VPS Ubuntu (nginx hoặc apache cho site, nginx cho CMS).
# Không đụng vào các site khác trên server (vd. một site có sẵn).
#
#   bash deploy.sh check          chỉ ĐỌC, cho biết server đang có gì, không đổi gì
#   bash deploy.sh apply          cài site tĩnh (sao lưu, kiểm tra cấu hình, tự gỡ nếu lỗi)
#   bash deploy.sh cms            cài CMS: dịch vụ nền + cms.<domain> + nối API vào site (chạy sau 'apply' cũng được, trước cũng được)
#   bash deploy.sh cms-password   đặt lại mật khẩu quản trị CMS (in mật khẩu mới ra màn hình)
#   EMAIL=ban@mail.com bash deploy.sh ssl   (tuỳ chọn) HTTPS Let's Encrypt cho nginx
#
# Biến tuỳ chọn: DOMAIN (mặc định 3rdhubvietnam.tech), CMS_SUB (mặc định cms.$DOMAIN),
#   ADMIN_PASSWORD (mật khẩu quản trị ban đầu; bỏ trống thì tự tạo), FORCE=1 (ghi đè khi trùng tên miền)
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
MODE="${1:-check}"
STAMP="$(date +%Y%m%d-%H%M%S)"

say()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mX %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Hãy chạy bằng root (hoặc thêm sudo)."

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
  command -v python3 >/dev/null 2>&1 && echo "python3: $(python3 -V 2>&1)" || echo "python3: chưa cài (CMS cần python3 >= 3.8)"
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
  if cms_installed; then echo "đã cài, cổng $(cms_port)"; systemctl is-active 3rdhub-cms 2>/dev/null || true; else echo "chưa cài"; fi
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
    # CMS: chỉ mở 3 đường dẫn công khai. Trang quản trị nằm ở $CMS_SUB
    location = /api/content {
$(proxy_block "$port")
    }
    location = /api/lead {
        client_max_body_size 64k;
$(proxy_block "$port")
    }
    location /uploads/ {
$(proxy_block "$port")
    }
    location /api/ { return 404; }
"
  fi
  cat <<CONF
# 3RDHub Vietnam: site tĩnh. Tạo bởi deploy.sh $STAMP
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
    location /lib/ {
        expires 30d;
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
  echo; ok "Hoàn tất. Mở: http://$DOMAIN"
  echo "Nếu dùng Cloudflare (đám mây cam): vào SSL/TLS và chọn 'Flexible' để chạy HTTPS ngay."
  echo "Muốn thêm CMS: bash deploy.sh cms"
}

# ----------------------------------------------------------------- CMS
free_port() {
  python3 - <<'PY'
import socket
for p in range(8787, 8830):
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", p)); s.close(); print(p); break
    except OSError:
        s.close()
PY
}

do_cms() {
  [ -n "$NGINX" ] || die "CMS hiện chỉ cấu hình tự động cho nginx. Chạy 'bash deploy.sh check' rồi gửi kết quả cho người hỗ trợ."
  [ -f "$HERE/cms/server.py" ] || die "Thiếu thư mục cms/ trong gói."
  command -v python3 >/dev/null 2>&1 || { say "Cài python3"; apt-get update -y && apt-get install -y python3; }
  python3 -c 'import sys,sqlite3; sys.exit(0 if sys.version_info>=(3,8) else 1)' || die "Cần python3 >= 3.8 có sqlite3."

  say "Cài mã nguồn CMS vào $CMS_DIR"
  local RESTART=0
  cmp -s "$HERE/cms/server.py" "$CMS_DIR/server.py" 2>/dev/null || RESTART=1   # giao diện admin và dữ liệu mặc định đọc lại mỗi yêu cầu, chỉ server.py mới cần khởi động lại
  mkdir -p "$CMS_DIR"
  cp -a "$HERE/cms/." "$CMS_DIR/"
  find "$CMS_DIR" -type d -exec chmod 755 {} +; find "$CMS_DIR" -type f -exec chmod 644 {} +
  mkdir -p "$CMS_DATA"
  if [ "${SKIP_SYSTEM:-0}" != 1 ]; then
    id tdhubcms >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin tdhubcms
    chown -R tdhubcms:tdhubcms "$CMS_DATA"; chmod 750 "$CMS_DATA"
  fi

  local NEWPASS=""
  if [ ! -f "$CMS_ENV" ]; then
    local port pass; port="$(free_port)"; [ -n "$port" ] || die "Không tìm được cổng trống từ 8787 đến 8829."
    pass="${ADMIN_PASSWORD:-$(python3 -c 'import secrets;print(secrets.token_urlsafe(12))')}"
    umask 077
    cat > "$CMS_ENV" <<ENV
PORT=$port
BIND=127.0.0.1
CMS_DATA=$CMS_DATA
CMS_HOSTS=$CMS_SUB
CMS_ADMIN_PASSWORD=$pass
ENV
    umask 022
    NEWPASS="$pass"; RESTART=1
    ok "Đã tạo $CMS_ENV (cổng $port)"
  fi
  local PORT; PORT="$(cms_port)"

  mkdir -p "$UNIT_DIR"
  local UNITF="$UNIT_DIR/3rdhub-cms.service"
  cat > "$UNITF.new" <<UNIT
[Unit]
Description=3RDHub CMS
After=network.target

[Service]
User=tdhubcms
Group=tdhubcms
WorkingDirectory=$CMS_DIR
EnvironmentFile=$CMS_ENV
ExecStart=$(command -v python3) $CMS_DIR/server.py
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
    if [ "$RESTART" = 1 ]; then
      systemctl daemon-reload && systemctl enable 3rdhub-cms >/dev/null 2>&1 && systemctl restart 3rdhub-cms
      ok "Đã khởi động lại CMS (mã nguồn hoặc cấu hình dịch vụ có đổi)"
    else
      ok "CMS không đổi mã nguồn, giữ nguyên tiến trình đang chạy"
    fi
    local i; for i in $(seq 1 30); do curl -fsS "http://127.0.0.1:$PORT/api/content" >/dev/null 2>&1 && break; sleep 0.5; done
    curl -fsS "http://127.0.0.1:$PORT/api/content" >/dev/null 2>&1 || { journalctl -u 3rdhub-cms -n 30 --no-pager >&2 || true; die "CMS không khởi động được. Xem log ở trên."; }
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
  local pw; pw="$(python3 -c 'import secrets;print(secrets.token_urlsafe(12))')"
  runuser -u tdhubcms -- env CMS_DATA="$CMS_DATA" python3 "$CMS_DIR/server.py" --reset-password "$pw" >/dev/null
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
