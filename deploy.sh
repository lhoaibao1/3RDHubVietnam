#!/usr/bin/env bash
# 3RDHub Vietnam: đưa site tĩnh lên VPS (nginx hoặc apache), không đụng vào các site khác (vd CMS).
#   bash deploy.sh check   chỉ ĐỌC, cho biết server đang có gì, không đổi gì
#   bash deploy.sh apply   cài site (có backup, kiểm tra cấu hình trước khi nạp, tự hoàn tác nếu lỗi)
#   EMAIL=ban@mail.com bash deploy.sh ssl   (tuỳ chọn) xin chứng chỉ HTTPS Let's Encrypt cho nginx
set -euo pipefail

DOMAIN="${DOMAIN:-3rdhubvietnam.tech}"
WEBROOT="${WEBROOT:-/var/www/$DOMAIN}"
ETC="${ETC:-/etc}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE="$HERE/site"
MODE="${1:-check}"
STAMP="$(date +%Y%m%d-%H%M%S)"

say()  { printf '\n\033[1;34m== %s\033[0m\n' "$*"; }
ok()   { printf '\033[1;32m✓ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mX %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "Hãy chạy bằng root (hoặc thêm sudo)."
[ -f "$SITE/index.html" ] || die "Không thấy $SITE/index.html. Giải nén đủ gói rồi chạy lại."

NGINX=""
for c in "$(command -v nginx 2>/dev/null || true)" /www/server/nginx/sbin/nginx /usr/local/nginx/sbin/nginx /usr/sbin/nginx; do
  if [ -n "$c" ] && [ -x "$c" ]; then NGINX="$c"; break; fi
done
APACHE="$(command -v apache2ctl 2>/dev/null || command -v apachectl 2>/dev/null || true)"

reload_nginx() { systemctl reload nginx 2>/dev/null || "$NGINX" -s reload; }

http_code() { # $1=host header
  curl -s -o /dev/null -m 8 -w '%{http_code}' -H "Host: $1" http://127.0.0.1/ 2>/dev/null || echo "---"
}

# in ra các file nginx có server_name chứa domain chính xác (không tính cms.domain)
nginx_domain_files() {
  "$NGINX" -T 2>/dev/null | awk -v d="$DOMAIN" '
    /^# configuration file /{f=$4; sub(":$","",f)}
    /server_name[ \t]/ && !/^[ \t]*#/ {
      s=$0; sub(/.*server_name[ \t]+/,"",s)
      n=split(s,a,/[ \t;{}]+/); for(i=1;i<=n;i++) if(a[i]==d || a[i]=="www."d){print f; break}
    }' | sort -u
}

do_check() {
  say "Hệ thống"
  . "$ETC/os-release" 2>/dev/null && echo "$PRETTY_NAME"
  df -h / | tail -1
  say "Cổng 80/443 do tiến trình nào giữ"
  (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null) | grep -E ':(80|443)[[:space:]]' || echo "(không có tiến trình nào)"
  say "Web server"
  if [ -n "$NGINX" ]; then echo "nginx: $NGINX ($("$NGINX" -v 2>&1))"; else echo "không thấy nginx"; fi
  [ -n "$APACHE" ] && echo "apache: $APACHE" || true
  say "Panel quản lý (nếu có)"
  ls -d /www/server/panel /usr/local/CyberCP /opt/1panel /etc/1panel /home/cloudpanel 2>/dev/null || echo "không thấy aaPanel / CyberPanel / 1Panel / CloudPanel"
  if [ -n "$NGINX" ]; then
    say "Các site nginx đang có (server_name, listen, root, proxy_pass)"
    "$NGINX" -T 2>/dev/null | awk '/^# configuration file /{f=$4; sub(":$","",f)} /^[ \t]*(server_name|listen|root|proxy_pass)[ \t]/ && !/^[ \t]*#/{gsub(/^[ \t]+/,""); print f": "$0}' | head -80
    say "Cấu hình nào đã nhắc tới $DOMAIN"
    f="$(nginx_domain_files || true)"; [ -n "$f" ] && echo "$f" || echo "chưa có (an toàn để thêm mới)"
  fi
  say "Thư mục web"
  ls -la /var/www 2>/dev/null || echo "/var/www chưa có"
  ls -la "$WEBROOT" 2>/dev/null || echo "$WEBROOT chưa có"
  say "Firewall"
  if command -v ufw >/dev/null 2>&1; then ufw status | head -10; else echo "không dùng ufw"; fi
  say "DNS máy này thấy"
  getent hosts "$DOMAIN" "cms.$DOMAIN" || echo "(không phân giải được, bình thường nếu DNS vừa đổi)"
  say "Phản hồi hiện tại của server với từng tên miền"
  echo "$DOMAIN     -> HTTP $(http_code "$DOMAIN")"
  echo "cms.$DOMAIN -> HTTP $(http_code "cms.$DOMAIN")"
  echo; ok "Xong. Chưa có gì bị thay đổi."
}

install_files() {
  mkdir -p "$WEBROOT"
  if [ -n "$(ls -A "$WEBROOT" 2>/dev/null)" ]; then
    tar czf "/root/backup-site-$DOMAIN-$STAMP.tgz" -C "$WEBROOT" . && ok "Đã sao lưu thư mục web cũ: /root/backup-site-$DOMAIN-$STAMP.tgz"
  fi
  cp -a "$SITE"/. "$WEBROOT"/
  find "$WEBROOT" -type d -exec chmod 755 {} +; find "$WEBROOT" -type f -exec chmod 644 {} +
  if id www-data >/dev/null 2>&1; then chown -R www-data:www-data "$WEBROOT"
  elif id www >/dev/null 2>&1; then chown -R www:www "$WEBROOT"
  elif id nginx >/dev/null 2>&1; then chown -R nginx:nginx "$WEBROOT"; fi
  ok "Đã chép site vào $WEBROOT"
}

apply_nginx() {
  local mine others TARGET LINK=""
  if   [ -d "$ETC/nginx/sites-available" ] && [ -d "$ETC/nginx/sites-enabled" ]; then TARGET="$ETC/nginx/sites-available/$DOMAIN.conf"; LINK="$ETC/nginx/sites-enabled/$DOMAIN.conf"
  elif [ -d /www/server/panel/vhost/nginx ]; then TARGET="/www/server/panel/vhost/nginx/$DOMAIN.conf"
  elif [ -d "$ETC/nginx/conf.d" ]; then TARGET="$ETC/nginx/conf.d/$DOMAIN.conf"
  else die "Không xác định được thư mục cấu hình nginx. Chạy 'bash deploy.sh check' rồi gửi kết quả cho người hỗ trợ."; fi

  mine="$(nginx_domain_files || true)"
  others="$(printf '%s\n' "$mine" | grep -v -x -F -e "$TARGET" -e "$LINK" | grep -v '^$' || true)"
  if [ -n "$others" ] && [ "${FORCE:-0}" != 1 ]; then
    warn "Đã có cấu hình khác khai báo $DOMAIN, dừng lại để không ghi đè:"; echo "$others"
    die "Kiểm tra file trên. Nếu chắc chắn muốn thay, chạy lại: FORCE=1 bash deploy.sh apply"
  fi

  CMS_BEFORE="$(http_code "cms.$DOMAIN")"
  tar czf "/root/backup-nginx-$STAMP.tgz" -C "$(dirname "$ETC/nginx")" "$(basename "$ETC/nginx")" 2>/dev/null && ok "Đã sao lưu cấu hình nginx: /root/backup-nginx-$STAMP.tgz" || warn "Không sao lưu được thư mục nginx (tiếp tục vì chỉ thêm file mới)"
  [ -f "$TARGET" ] && cp -a "$TARGET" "$TARGET.bak-$STAMP"

  install_files

  cat > "$TARGET" <<CONF
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
  [ -n "$LINK" ] && ln -sf "$TARGET" "$LINK"

  if "$NGINX" -t >/tmp/nginx-test.$$ 2>&1; then
    ok "nginx -t: cấu hình hợp lệ"
    reload_nginx && ok "Đã nạp lại nginx"
  else
    cat /tmp/nginx-test.$$ >&2
    rm -f "$TARGET" ${LINK:+"$LINK"}
    [ -f "$TARGET.bak-$STAMP" ] && mv "$TARGET.bak-$STAMP" "$TARGET" && { [ -n "$LINK" ] && ln -sf "$TARGET" "$LINK"; }
    die "Cấu hình lỗi, đã gỡ file vừa thêm và KHÔNG nạp lại nginx. Server giữ nguyên như cũ."
  fi
  rm -f /tmp/nginx-test.$$

  if [ "${SKIP_VERIFY:-0}" != 1 ]; then
    say "Kiểm tra sau khi cài"
    echo "$DOMAIN     -> HTTP $(http_code "$DOMAIN")  (mong đợi 200)"
    echo "cms.$DOMAIN -> HTTP $(http_code "cms.$DOMAIN")  (trước đó: $CMS_BEFORE)"
    [ "$(http_code "cms.$DOMAIN")" = "$CMS_BEFORE" ] && ok "CMS không bị ảnh hưởng" || warn "Mã phản hồi của CMS thay đổi, hãy kiểm tra cms.$DOMAIN ngay"
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
}

do_apply() {
  if   [ -n "$NGINX" ];  then apply_nginx
  elif [ -n "$APACHE" ]; then apply_apache
  else die "Không thấy nginx hay apache. Chạy 'bash deploy.sh check' rồi gửi kết quả cho người hỗ trợ."; fi
  echo; ok "Hoàn tất. Mở: http://$DOMAIN"
  echo "Nếu dùng Cloudflare (đám mây cam): vào SSL/TLS và chọn 'Flexible' để chạy HTTPS ngay."
  echo "Muốn HTTPS thật tới VPS (Full/Strict): EMAIL=ban@mail.com bash deploy.sh ssl"
}

do_ssl() {
  [ -n "$NGINX" ] || die "Bước ssl hiện chỉ hỗ trợ nginx."
  : "${EMAIL:?Đặt EMAIL, ví dụ: EMAIL=ban@mail.com bash deploy.sh ssl}"
  command -v certbot >/dev/null 2>&1 || { apt-get update -y && apt-get install -y certbot python3-certbot-nginx; }
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect --non-interactive --agree-tos -m "$EMAIL"
  ok "Đã cấu hình HTTPS."
}

case "$MODE" in
  check) do_check ;;
  apply) do_apply ;;
  ssl)   do_ssl ;;
  *)     die "Dùng: bash deploy.sh check | apply | ssl" ;;
esac
