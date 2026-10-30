# 3RDHub Vietnam

Website **3RDHub Vietnam** (nền tảng tiếp thị liên kết, 3RDVN Technology) kèm **CMS** để tự quản lý nội dung.

| Lớp | Công nghệ |
|---|---|
| Website công khai (`web/`) | **Vue 3 + Vite + TypeScript + Pinia + Vue Router**, cảnh 3D bằng **three.js** (mỗi trang một cảnh), GSAP, VI / EN |
| Trang quản trị CMS (`web/admin/`) | **Vue 3 + TypeScript + Pinia**, cùng bộ công cụ build |
| Backend (`server/`) | **Go** (chỉ thêm một thư viện: `pgx`), API + phục vụ trang quản trị |
| Cơ sở dữ liệu | **PostgreSQL** (migration nhúng sẵn trong chương trình Go) |
| Máy chủ | nginx + systemd, triển khai bằng `deploy.sh` |

Giao diện được **build sẵn** vào `site/` và `admin/` (đã commit), nên **VPS không cần Node.js**. VPS chỉ cần
PostgreSQL và Go, và `deploy.sh` tự cài cả hai.

## Cấu trúc

| Thư mục / file | Nội dung |
|---|---|
| `web/` | Mã nguồn giao diện (Vue + TypeScript). `web/src` là website, `web/admin` là trang quản trị |
| `site/` | Website **đã build**, nginx phục vụ trực tiếp |
| `admin/` | Trang quản trị **đã build**, do backend Go phục vụ ở `cms.<domain>` |
| `server/` | Backend Go: API, xác thực, migration PostgreSQL, `vendor/` (không cần mạng khi build) |
| `tools/` | `export-sqlite.py` (chuyển dữ liệu từ bản CMS cũ), `test-deploy.sh`, `e2e/` (thử bằng trình duyệt thật) |
| `deploy.sh` | Triển khai lên VPS Ubuntu |

## Tính năng giao diện

- **Ngôn ngữ tự động**: lần đầu vào site theo ngôn ngữ trình duyệt (tiếng Việt thì hiện tiếng Việt, còn lại hiện tiếng Anh), nhớ lựa chọn sau đó. Nút cờ ở menu đổi ngôn ngữ bằng một chạm, có hiệu ứng chuyển mượt.
- **Sáng / tối**: theo hệ thống lúc đầu, nút mặt trời / mặt trăng đổi bằng hiệu ứng loang tròn; các cảnh 3D đổi ánh sáng và màu theo chế độ.
- **Cookie**: lần đầu vào site hiện thông báo (Chấp nhận tất cả / Chỉ cần thiết / Tuỳ chọn), lựa chọn lưu ở trình duyệt; Google Analytics chỉ được nạp sau khi khách đồng ý cookie phân tích; nút "Cài đặt cookie" ở chân trang để đổi lại.
- **Cuộn trang**: thanh tiến độ, nội dung hiện dần theo nhiều hướng, mỗi khu vực một nền và hoạ tiết riêng (`web/src/styles/backgrounds.css`).
- **SEO / chia sẻ link**: `npm run build` dựng sẵn trang HTML riêng cho từng đường dẫn (tiêu đề, mô tả, ảnh chia sẻ, JSON-LD), kèm `sitemap.xml` và `robots.txt`
  (nội dung ở `web/scripts/seo.json`, địa chỉ gốc đặt bằng `SITE_URL`). Ảnh chia sẻ `web/public/og/*.png` tạo từ cảnh 3D thật bằng `node tools/make-og.js`.
- **Trang pháp lý**: Điều khoản và Bảo mật viết theo pháp luật Việt Nam hiện hành (Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15, Luật Thương mại điện tử 122/2025/QH15...),
  tự điền thông tin công ty từ mục Cài đặt (các mã `{{company_name}}`, `{{tax_id}}`, `{{address}}`, `{{email}}`, `{{hotline}}`, `{{parent_url}}`).

## Làm việc trên máy bạn

```bash
make web                                   # cài thư viện, kiểm tra kiểu (vue-tsc) và build ra site/ + admin/
make server-test TEST_DATABASE_URL='postgres://postgres@127.0.0.1:5432/cmstest?sslmode=disable'
make dev-server  DATABASE_URL='postgres://postgres@127.0.0.1:5432/dev?sslmode=disable'
```

Chạy giao diện ở chế độ dev (tự tải lại): `cd web && npm run dev` (website, cổng 5173) hoặc `npm run dev:admin`
(quản trị, cổng 5174); cả hai chuyển tiếp `/api` và `/uploads` sang backend ở cổng 8787.
Đăng nhập thử vào CMS bằng host `cms.localhost` (vd. `http://cms.localhost:8787`).

**Sau khi sửa giao diện nhớ chạy `make web` và commit cả `site/` lẫn `admin/`**, vì VPS chỉ lấy bản đã build.

### Chữ trên website

Trong template Vue chỉ cần viết **tiếng Việt**. Plugin `web/build/i18nTransform.ts` biến mọi chữ tĩnh thành
`$t("…")` lúc build: bản tiếng Anh lấy từ `web/src/lib/en.json`, còn chữ tuỳ chỉnh từ CMS được tra theo chính chuỗi tiếng Việt đó.
Thêm chữ mới thì: thêm bản tiếng Anh vào `en.json` và đưa vào `web/admin/src/strings.json` (danh mục chữ sửa được trong CMS).
`npm run check:strings` (trong `web/`) báo chuỗi nào còn thiếu bản dịch hoặc chưa sửa được trong CMS.
Không dịch: nội dung trong thẻ `code`/`pre`/`svg`, phần tử có `data-nl`, khối terminal.

## Deploy lên VPS

```bash
# trên VPS, trong thư mục repo
bash deploy.sh check   # chỉ đọc: xem server đang có gì (nên chạy trước)
bash deploy.sh apply   # cài website; nếu backend đã cài thì cập nhật luôn backend
bash deploy.sh cms     # cài/cập nhật backend (in ra mật khẩu quản trị lần đầu)
EMAIL=ban@mail.com bash deploy.sh ssl   # tuỳ chọn: HTTPS Let's Encrypt (nginx)
```

`deploy.sh cms` tự làm hết, kể cả trên máy chưa có gì:

1. Cài **PostgreSQL** (`apt`), tạo vai trò và CSDL `tdhubcms`. Backend nối qua **unix socket, xác thực bằng người dùng hệ thống**
   (peer): không có mật khẩu CSDL nào được tạo ra hay lưu ở đâu, và PostgreSQL chỉ nghe trên localhost.
2. Cài **Go** nếu máy chưa có bản ≥ 1.22 (tải bản chính thức từ go.dev, kiểm tra checksum), rồi **build** backend từ `server/`
   (dùng `vendor/`, chỉ build lại khi mã nguồn Go đổi).
3. Chạy migration, tạo dịch vụ systemd `3rdhub-cms` (người dùng riêng, nghe `127.0.0.1`), cấu hình nginx cho `cms.<domain>`
   và nối `/api/content`, `/api/lead`, `/uploads/` vào website.
4. **Nâng cấp từ bản cũ (Python + SQLite)**: sao lưu bản cũ vào `/root/backup-cms-legacy-*.tgz`, nạp toàn bộ nội dung, lịch sử,
   yêu cầu khách, mật khẩu quản trị và ảnh tải lên vào PostgreSQL, rồi đổi dịch vụ sang bản Go. Nếu bản mới không chạy được,
   tự quay lại bản cũ. File SQLite cũ được giữ lại (`cms.db.migrated-*`).

Mặc định domain là `3rdhubvietnam.tech`, CMS ở `cms.3rdhubvietnam.tech` (đổi bằng `DOMAIN=...`, `CMS_SUB=...`).
Script chỉ **thêm** cấu hình riêng cho domain, có sao lưu, chạy `nginx -t` trước khi nạp, tự gỡ nếu lỗi,
và dừng lại nếu tên miền đã được khai báo ở nơi khác (trừ khi `FORCE=1`). Không sửa cấu hình của site khác.
Chạy lại nhiều lần vẫn an toàn (phù hợp cho cron): không đổi thì không sao lưu, không nạp lại nginx, không build lại, không khởi động lại;
có khoá `flock` nên hai lần chạy không chồng lên nhau.

Cloudflare: thêm bản ghi DNS `cms` trỏ về IP VPS. SSL/TLS ở chế độ **Flexible** chạy được ngay với origin HTTP
(hoặc chạy bước `ssl` rồi dùng Full). Quên mật khẩu quản trị: `bash deploy.sh cms-password`.

Thử `deploy.sh` mà không đụng hệ thống thật: `PGHOST=<thư mục socket> PGPORT=<cổng> bash tools/test-deploy.sh`
(cây thư mục giả, nginx giả, một PostgreSQL thử; gồm cả kịch bản nâng cấp từ bản Python + SQLite).

## CMS làm được gì

- **Sửa trên trang**: website mở ngay trong CMS; rê chuột thấy viền cam quanh chữ sửa được, bấm vào là sửa ở cột bên phải và thấy kết quả ngay. Vùng viền tím (hỏi đáp, đối tác, khách hàng, báo giá, thông tin công ty) bấm vào để mở đúng mục quản lý. Không nhớ chữ ở đâu thì dùng **Tìm chữ để sửa**.
- **Danh sách**: Hỏi đáp, Đối tác (chỉ logo), Khách hàng ("Khách hàng của chúng tôi" ở trang chủ, Sản phẩm, Báo giá), Báo giá (các gói của trang `/baogia`), Điều khoản và Bảo mật.
- **Thông tin**: Công ty, liên hệ, mạng xã hội (Facebook, Zalo, TikTok, YouTube, Instagram, LinkedIn), link demo, link đăng ký; SEO và Google Analytics.
- **Hệ thống**: Giao diện 3D (8 kiểu, có xem thử), Email (SMTP), đổi mật khẩu.
- **Vận hành**: Yêu cầu khách (trạng thái, ghi chú, xuất CSV), Lịch sử (60 bản gần nhất, khôi phục một cú bấm).

Mọi chỗ chỉ cần viết tiếng Việt, bản tiếng Anh tự dịch khi lưu. Hình ảnh, nội dung cảnh 3D và bố cục là phần thiết kế (nằm trong `web/`); mã các kiểu 3D mới ở `web/src/three/styles/` (`skin.ts` phong cách, `parts.ts` chi tiết, `concepts.ts` cảnh riêng từng trang, `host.ts` ghép cảnh với skin; nhãn trong cảnh là HTML nên chữ luôn nét).

## Tự dịch và email

- **Tự dịch Việt → Anh**: chỉ cần viết tiếng Việt trong CMS. Khi bấm Lưu, backend dịch những đoạn English còn trống hoặc đang là bản máy dịch mà tiếng Việt đã đổi (chữ trên trang, hỏi đáp, nhóm đối tác, trang pháp lý, báo giá). Ô English do bạn tự sửa thì được giữ nguyên. Kết quả được nhớ trong bảng `tr_cache`. Mặc định dùng điểm cuối dịch miễn phí không chính thức của Google; đặt `TRANSLATE_KEY` (Google Cloud Translation API) để dùng bản chính thức, hoặc `TRANSLATE=off` để tắt. Máy chủ phải ra được internet.
- **Thông báo khi có người đăng ký** (CMS, mục *Email & Zalo báo tin*): email chuyển tiếp cho đội ngũ (nhiều địa chỉ, bấm Trả lời là email thẳng cho khách), email xác nhận giao diện đẹp gửi khách (theo ngôn ngữ khách dùng, có xem mẫu), tin nhắn **Zalo Bot** cho đội ngũ (token từ bot.zaloplatforms.com, nút tìm chat ID) và tin **Zalo OA ZNS** gửi tới số điện thoại khách (App ID, Secret key, Refresh token, mẫu ZNS đã duyệt; hệ thống tự làm mới token). Mọi khoá được mã hoá bằng `secret.key`, có nhật ký 40 lần gửi gần nhất.
- **Email SMTP**: tab *Email (SMTP)* trong CMS (mặc định điền sẵn `mail.3rdhubvietnam.tech`, cổng 465 SSL, tài khoản `hello@3rdhubvietnam.tech`). Mật khẩu chỉ nhập trong CMS, được mã hoá AES-256-GCM bằng khoá `secret.key` nằm trong thư mục dữ liệu của máy chủ, không có trong repo, không có trong `/api/content` và không hiện lại. Có nút gửi thử và tuỳ chọn báo email khi có yêu cầu mới (tắt mặc định).

## Đăng ký sản phẩm cho khách (/dang-ky) qua 3RDHub

Trang `/dang-ky` (không nằm trên menu, dùng làm link gửi khách, ví dụ `/dang-ky?product=FE&ref=RD260001&utm_source=fb`).
Khách điền form, backend Go chuyển tiếp sang 3RDHub rồi trả về mã `KH-xxxx`. Khách bấm **Mở Zalo OA**, bấm Quan tâm, gửi mã vào khung chat. **3RDHub là nơi duy nhất kết nối Zalo OA**: trang này không gọi API Zalo và không giữ token Zalo.

- Trình duyệt chỉ gọi `GET /api/products` và `POST /api/register` của trang. Backend thêm khoá, gọi `GET/POST {HUB_API_BASE}/api/v1/public/customer-products|customer-leads` và chỉ trả lại `code`, `zalo_url`, `expires_at`, tên sản phẩm.
- Biến môi trường (đặt trong `/etc/3rdhub-cms.env`, **không commit giá trị**), rồi `systemctl restart 3rdhub-cms`:
  - `HUB_API_BASE`: `https://uat-app.3rdvn.io.vn` khi thử, `https://app.3rdvn.io.vn` khi chạy thật.
  - `HUB_SITE_KEY`: khoá lấy trong 3RDHub. Chỉ nằm ở backend.
  - Chưa đặt hai biến này thì trang hiện "Chưa mở đăng ký trực tuyến".
- **Bản giả (mock)** khi 3RDHub chưa có endpoint: `HUB_MOCK=1` (không cần `HUB_API_BASE`). Sản phẩm giả có chữ `[Thử]`. Số điện thoại thử lỗi: `0900000400` (400), `0900000401` (401), `0900000409` (trùng), `0900000429` (429), `0900000500` (500), `0900000000` (mất kết nối).
- Chống spam: ô ẩn honeypot (bot nhận thành công giả, không gửi đi), giới hạn 5 lần / 10 phút / IP (và 200 / 10 phút toàn trang).
- Không ghi họ tên, số điện thoại vào log hay analytics. Chỉ ghi sự kiện `lead_submitted` kèm mã sản phẩm, và chỉ khi khách đã đồng ý cookie phân tích.
- Kiểm thử: `go test` (`hub_test.go`) và `HUB_MOCK=1 HUB_SITE_KEY=<chuỗi bất kỳ>` chạy backend, rồi `HUB_SITE_KEY=<chuỗi đó> node tools/e2e/register.js`.

## Bảo mật (tóm tắt)

- Trang quản trị chỉ mở ở host `cms.*` (hoặc danh sách `CMS_HOSTS`); ở tên miền chính `/api/admin/*` trả 404.
- Đăng nhập: PBKDF2-SHA256 (200.000 vòng), cookie `HttpOnly` + `SameSite=Strict` (+ `Secure` khi qua HTTPS), mọi yêu cầu ghi cần
  header `X-CMS: 1`; giới hạn đăng nhập sai 8 lần / 10 phút / IP.
- Form liên hệ có honeypot và giới hạn 6 yêu cầu / 10 phút / IP.
- Ảnh tải lên chỉ nhận PNG/JPG/WEBP/GIF (kiểm tra byte đầu file, ≤ 2MB) và được phục vụ với CSP `sandbox`.
- Trang quản trị gửi CSP chặt (`default-src 'self'`, không nhúng iframe).

## Lưu ý nội dung

Trang **Công nghệ** mô tả bộ công nghệ 3RDVN Technology dùng để xây hệ thống affiliate cho khách (Vue, Go, PostgreSQL, Redis, Docker, Nginx…).
Hãy chỉnh lại trong CMS (mục *Nội dung chữ*) hoặc trong `web/src/pages/modules/TechPage.vue` cho khớp với công nghệ thật của bạn.
Nội dung Điều khoản và Chính sách bảo mật là **bản mẫu**, nên để luật sư xem lại trước khi dùng chính thức.
