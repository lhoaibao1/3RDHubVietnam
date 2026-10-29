# 3RDHub Vietnam

Website **3RDHub Vietnam** (nền tảng tiếp thị liên kết, 3RDVN Technology) kèm **CMS** để tự quản lý nội dung.

- Site: HTML + Three.js + GSAP, trang chủ và 6 trang chi tiết (đường dẫn `#/ten-trang`), 2 trang pháp lý, chân trang thông tin công ty, cảnh 3D riêng từng trang, đổi ngôn ngữ **VI / EN**, responsive.
- CMS: backend Python (chỉ thư viện chuẩn, không cần cài gói nào) + trang quản trị tại `cms.<domain>`.

## Cấu trúc

| Thư mục / file | Nội dung |
|---|---|
| `site/` | Bản **đã build, sẵn deploy**: `index.html` + `lib/` (Three.js, GSAP đặt sẵn, không tải từ CDN) |
| `cms/` | CMS: `server.py` (API + trang quản trị), `admin/` (giao diện), `defaults.json`, `seed/` (logo đối tác mặc định) |
| `deploy.sh` | Deploy lên VPS Ubuntu: site tĩnh + CMS |
| `src/` | Mã nguồn site và công cụ build |

## Deploy lên VPS

```bash
# trên máy bạn
scp -P <cổng> -r site cms deploy.sh root@<ip>:/root/3rdhub-deploy/

# trên VPS
cd /root/3rdhub-deploy
bash deploy.sh check   # chỉ đọc: xem server đang có gì (nên chạy trước)
bash deploy.sh apply   # cài site tĩnh
bash deploy.sh cms     # cài CMS (in ra mật khẩu quản trị lần đầu)
EMAIL=ban@mail.com bash deploy.sh ssl   # tuỳ chọn: HTTPS Let's Encrypt (nginx)
```

Mặc định domain là `3rdhubvietnam.tech`, CMS ở `cms.3rdhubvietnam.tech` (đổi bằng `DOMAIN=...`, `CMS_SUB=...`).
Script chỉ **thêm** cấu hình riêng cho domain, có sao lưu, chạy `nginx -t` trước khi nạp, tự gỡ nếu lỗi,
và dừng lại nếu tên miền đã được khai báo ở nơi khác (trừ khi `FORCE=1`). Không sửa cấu hình của site khác.

Cloudflare: thêm bản ghi DNS `cms` trỏ về IP VPS. SSL/TLS ở chế độ **Flexible** chạy được ngay với origin HTTP
(hoặc chạy bước `ssl` rồi dùng Full).

Quên mật khẩu quản trị: `bash deploy.sh cms-password`.

`deploy.sh` chạy lại nhiều lần vẫn an toàn (phù hợp để cron/tự động gọi): nếu site, cấu hình nginx hay mã CMS không đổi thì
không sao lưu, không nạp lại nginx, không khởi động lại CMS. CMS chỉ khởi động lại khi `cms/server.py` hoặc cấu hình dịch vụ đổi.
Sao lưu trong `/root/` được tự dọn, giữ 10 bản mới nhất mỗi loại (đổi bằng `KEEP_BACKUPS=n`).

## CMS làm được gì

- **Nội dung chữ**: sửa hơn 450 đoạn chữ (tiếng Việt và English) trên trang chủ và 6 trang chi tiết; "Về gốc" từng đoạn.
- **Hỏi đáp**: thêm, sửa, xoá, sắp xếp, chia nhóm; chọn câu nào hiện ở trang chủ.
- **Đối tác**: thêm, sửa, xoá, sắp xếp, tải logo.
- **Trang pháp lý**: sửa Điều khoản sử dụng và Chính sách bảo mật (VI/EN, có xem trước). Hai trang nằm riêng trên website: `/dieu-khoan`, `/bao-mat`.
- **Yêu cầu khách**: form liên hệ lưu vào CMS (trạng thái, ghi chú, xuất CSV).
- **Cài đặt**: thông tin công ty (tên, mã số thuế, địa chỉ, giờ làm việc), email, hotline, link đăng ký, mạng xã hội (Facebook, Zalo, TikTok, YouTube, Instagram), SEO (tiêu đề, mô tả), mã Google Analytics; đổi mật khẩu.
- **Lịch sử**: 60 phiên bản gần nhất, khôi phục bằng một cú bấm.

Hình ảnh, cảnh 3D và bố cục là phần thiết kế, sửa trong mã nguồn.

### Cách hoạt động

- Site tĩnh gọi `GET /api/content` (cùng tên miền, nginx chuyển tiếp tới CMS) để lấy chữ, hỏi đáp, đối tác, cài đặt.
  Nếu không gọi được thì site vẫn chạy bằng nội dung mặc định có sẵn trong `index.html`. Nội dung được lưu đệm trong trình duyệt để lần sau hiện ngay.
- Form liên hệ gọi `POST /api/lead`. Nếu không gửi được, site mở email soạn sẵn.
- Trang quản trị và API quản trị chỉ có ở `cms.<domain>` (tên miền chính trả 404 cho `/api/admin/*`).
- Dữ liệu: SQLite tại `/var/lib/3rdhub-cms/cms.db`, logo tải lên tại `/var/lib/3rdhub-cms/uploads/`. Hãy sao lưu thư mục này.
- Bảo mật: mật khẩu PBKDF2, cookie HttpOnly + SameSite=Strict, header `X-CMS` chống CSRF, giới hạn đăng nhập và số lần gửi form, kiểm tra loại file tải lên theo nội dung, dịch vụ chạy bằng user riêng, chỉ nghe trên 127.0.0.1.

## Chạy thử cục bộ

```bash
cd cms
CMS_DATA=/tmp/cmsdata CMS_ADMIN_PASSWORD='mat-khau-thu-123' SITE_DIR=../site python3 server.py
# site:     http://localhost:8787/
# quản trị: http://cms.localhost:8787/
```

## Build lại site từ mã nguồn

`site/index.html` được ghép từ `src/` bằng `src/mksite.py` (cần bộ icon npm đặt trong `npm/`, xem `src/build.py`):

- `pre-modules.html`: trang chủ, cảnh 3D đầu trang, demo hệ thống
- `pages.html`, `pages.css`, `pages.js`: 6 trang chi tiết, hiệu ứng, hỏi đáp, đối tác
- `scenes3d.js`: cảnh 3D của 6 trang chi tiết
- `i18n.js`, `en.json`: đổi ngôn ngữ, bản dịch, áp dụng nội dung từ CMS
- `cms-client.js`: tải nội dung từ CMS
- `legal.json`: nội dung mặc định của Điều khoản và Chính sách bảo mật (VI/EN)
- `make_assets.js`, `assets/`: favicon, icon app, ảnh chia sẻ mạng xã hội (`node make_assets.js` tạo lại từ logo)
- `extract_defaults.js`, `extract_strings.js`: tạo lại dữ liệu mặc định và danh sách chữ cho CMS (chạy sau khi đổi nội dung gốc)

```bash
mkdir npm && cd npm
npm pack simple-icons@16.36.0 lucide-static@1.64.0
for f in *.tgz; do d=${f%.tgz}; mkdir -p $d && tar xzf $f -C $d; done
cd .. && python3 mksite.py site_out   # chạy trong thư mục chứa các file nguồn, cần thư mục lib/ (three, gsap)
```
