# 3RDHub Vietnam

Website giới thiệu **3RDHub Vietnam**, nền tảng tiếp thị liên kết thuộc 3RDVN Technology.
Trang tĩnh (HTML + Three.js + GSAP), không cần backend.

- Trang chủ và 6 trang chi tiết: Mô hình, Advertiser, Công nghệ, Đối tác, Hỏi đáp, Liên hệ (đường dẫn dạng `#/ten-trang`)
- Cảnh 3D riêng cho từng trang, đổi ngôn ngữ **VI / EN**, responsive cho điện thoại

## Cấu trúc

| Thư mục / file | Nội dung |
|---|---|
| `site/` | Bản **đã build, sẵn sàng deploy**: `index.html` + `lib/` (Three.js, GSAP đặt sẵn, không tải từ CDN) |
| `deploy.sh` | Script deploy lên VPS (nginx hoặc apache) |
| `src/` | Mã nguồn để chỉnh sửa và build lại |

## Deploy lên VPS

```bash
# trên máy bạn
scp -P <cổng> -r site deploy.sh root@<ip>:/root/3rdhub-deploy/

# trên VPS
cd /root/3rdhub-deploy
bash deploy.sh check   # chỉ đọc, xem server đang có gì
bash deploy.sh apply   # cài site (có sao lưu, kiểm tra cấu hình, tự gỡ nếu lỗi)
EMAIL=ban@mail.com bash deploy.sh ssl   # tuỳ chọn: HTTPS Let's Encrypt (nginx)
```

Mặc định domain là `3rdhubvietnam.tech`; đổi bằng biến môi trường `DOMAIN=...`.
Script chỉ thêm một file cấu hình riêng cho domain, không sửa cấu hình của site khác (ví dụ CMS).
Nếu dùng Cloudflare, đặt SSL/TLS ở chế độ **Flexible** để chạy HTTPS ngay với origin HTTP.

## Chỉnh sửa và build lại

`site/index.html` được ghép từ các file trong `src/` bằng `src/build.py`:

- `pre-modules.html`: trang chủ, cảnh 3D đầu trang, demo hệ thống
- `pages.html`, `pages.css`, `pages.js`: 6 trang chi tiết, hiệu ứng, bộ lọc hỏi đáp
- `scenes3d.js`: cảnh 3D của 6 trang chi tiết
- `i18n.js`, `en.json`: đổi ngôn ngữ và bản dịch tiếng Anh

`build.py` cần bộ icon từ npm (đặt trong thư mục `npm/`):

```bash
mkdir npm && cd npm
npm pack simple-icons@16.36.0 lucide-static@1.64.0
for f in *.tgz; do d=${f%.tgz}; mkdir -p $d && tar xzf $f -C $d; done
cd .. && python3 build.py   # chạy từ thư mục chứa các file nguồn và npm/
```

Kết quả là `fixed.html`; để dùng thư viện cục bộ, đổi các link CDN (`cdnjs.cloudflare.com`) thành `lib/three.min.js`, `lib/gsap.min.js`, `lib/ScrollTrigger.min.js` rồi lưu thành `site/index.html`.
