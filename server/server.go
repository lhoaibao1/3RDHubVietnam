package main

import (
	"bytes"
	"context"
	"crypto/sha1"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed seed/defaults.json seed/logos/*.webp
var seedFS embed.FS

const (
	maxUpload = 2 * 1024 * 1024
	adminCSP  = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"
	upCSP     = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox"
)

type App struct {
	cfg      Config
	pool     *pgxpool.Pool
	defaults Defaults
	rl       *limiter
	tr       *translator
	hub      *hubClient
	zoa      *zaloOA
	gd       *guard
	gdOnce   sync.Once
}

func loadDefaults() (Defaults, error) {
	var d Defaults
	b, err := seedFS.ReadFile("seed/defaults.json")
	if err != nil {
		return d, err
	}
	err = json.Unmarshal(b, &d)
	if d.Settings == nil {
		d.Settings = map[string]string{}
	}
	if d.Legal == nil {
		d.Legal = map[string]LegalDoc{}
	}
	return d, err
}

// initData tạo dữ liệu khởi tạo (khoá ký phiên, nội dung mặc định, mật khẩu admin, logo mẫu).
func (a *App) initData(ctx context.Context) error {
	if a.zoa != nil {
		a.zoa.app = a
	}
	if err := os.MkdirAll(a.uploads(), 0o755); err != nil {
		return err
	}
	var v json.RawMessage
	if ok, err := kvGet(ctx, a.pool, "secret", &v); err != nil {
		return err
	} else if !ok {
		if err := kvSetPool(ctx, a.pool, "secret", randHex(32)); err != nil {
			return err
		}
	}
	if ok, err := kvGet(ctx, a.pool, "content", &v); err != nil {
		return err
	} else if !ok {
		if err := kvSetPool(ctx, a.pool, "content", defaultContent(&a.defaults)); err != nil {
			return err
		}
		if err := kvSetPool(ctx, a.pool, "updated", time.Now().Unix()); err != nil {
			return err
		}
	}
	if ok, err := kvGet(ctx, a.pool, "admin_hash", &v); err != nil {
		return err
	} else if !ok {
		pw := a.cfg.AdminPass
		if pw == "" {
			pw = randHex(9)
			path := filepath.Join(a.cfg.DataDir, "initial-admin-password.txt")
			if err := os.WriteFile(path, []byte(pw+"\n"), 0o600); err != nil {
				return err
			}
			log.Printf("Mật khẩu quản trị ban đầu được lưu ở %s", path)
		}
		if err := kvSetPool(ctx, a.pool, "admin_hash", hashPW(pw)); err != nil {
			return err
		}
	}
	// bỏ cấu hình ZNS cũ (App secret, refresh/access token Zalo OA) còn lưu từ bản trước: trang không còn tự làm mới token
	var zraw map[string]json.RawMessage
	if ok, _ := kvGet(ctx, a.pool, "zalo", &zraw); ok && (zraw["refresh"] != nil || zraw["secret"] != nil || zraw["access"] != nil) {
		if err := kvSetPool(ctx, a.pool, "zalo", a.loadZalo(ctx)); err != nil {
			return err
		}
		log.Printf("Đã xoá cấu hình ZNS cũ (token Zalo OA) khỏi CSDL")
	}
	// một lần: danh sách ảnh giao diện đã chỉnh trong CMS được bổ sung các màn Chiến dịch, Đơn hàng mới chụp từ UAT
	var done bool
	if ok, _ := kvGet(ctx, a.pool, "shots_v2", &done); !ok {
		c, _, err := a.currentContent(ctx)
		if err != nil {
			return err
		}
		if merged, changed := mergeShots(c.Product.Shots, a.defaults.Product.Shots); changed {
			c.Product.Shots = merged
			if err := a.saveContent(ctx, c, "Thêm ảnh Chiến dịch, Đơn hàng vào trang Sản phẩm"); err != nil {
				return err
			}
			log.Printf("Đã thêm ảnh Chiến dịch, Đơn hàng vào danh sách ảnh giao diện")
		}
		if err := kvSetPool(ctx, a.pool, "shots_v2", true); err != nil {
			return err
		}
	}
	entries, _ := seedFS.ReadDir("seed/logos")
	for _, e := range entries {
		dst := filepath.Join(a.uploads(), "seed-"+e.Name())
		if _, err := os.Stat(dst); err == nil {
			continue
		}
		b, err := seedFS.ReadFile("seed/logos/" + e.Name())
		if err != nil {
			return err
		}
		if err := os.WriteFile(dst, b, 0o644); err != nil {
			return err
		}
	}
	return nil
}

func (a *App) uploads() string { return filepath.Join(a.cfg.DataDir, "uploads") }

// ---- tiện ích HTTP

func (a *App) host(r *http.Request) string {
	h := r.Host
	if i := strings.LastIndex(h, ":"); i >= 0 && !strings.Contains(h[i:], "]") {
		h = h[:i]
	}
	return strings.ToLower(h)
}

func (a *App) isAdminHost(r *http.Request) bool {
	h := a.host(r)
	if len(a.cfg.CMSHosts) > 0 {
		for _, x := range a.cfg.CMSHosts {
			if x == h {
				return true
			}
		}
		return false
	}
	return strings.HasPrefix(h, "cms.")
}

func clientIP(r *http.Request) string {
	// X-Real-IP do nginx đặt (đã khôi phục IP khách thật khi đi qua Cloudflare); CF-Connecting-IP khách có thể tự gửi nên chỉ dùng khi không có nginx
	ip := r.Header.Get("X-Real-IP")
	if ip == "" {
		ip = r.Header.Get("CF-Connecting-IP")
	}
	if ip == "" {
		ip, _, _ = net.SplitHostPort(r.RemoteAddr)
	}
	if len(ip) > 64 {
		ip = ip[:64]
	}
	return ip
}

func secure(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https") || strings.Contains(r.Header.Get("CF-Visitor"), `"https"`)
}

// siteFrameSrc cho phép trang quản trị (cms.<tên miền>) nhúng website chính để sửa trực tiếp trên trang.
func siteFrameSrc(r *http.Request) string {
	h := strings.ToLower(r.Host)
	if strings.HasPrefix(h, "cms.") && hostPortRe.MatchString(h[4:]) {
		return "'self' https://" + h[4:] + " http://" + h[4:]
	}
	return "'self'"
}

// adminPageCSP cho trang quản trị nhúng website (sửa trên trang) và hiện ảnh mẫu của website (/hub/...).
func adminPageCSP(r *http.Request) string {
	site := siteFrameSrc(r)
	return strings.Replace(adminCSP, "img-src 'self' data: blob:", "img-src data: blob: "+site, 1) + "; frame-src " + site
}

var hostPortRe = regexp.MustCompile(`^[a-z0-9.-]{1,253}(:[0-9]{1,5})?$`)

func (a *App) send(w http.ResponseWriter, r *http.Request, code int, body []byte, ctype string, h map[string]string) {
	hd := w.Header()
	hd.Set("Content-Type", ctype)
	hd.Set("X-Content-Type-Options", "nosniff")
	hd.Set("Referrer-Policy", "same-origin")
	if a.isAdminHost(r) {
		hd.Set("X-Frame-Options", "DENY")
		hd.Set("X-Robots-Tag", "noindex, nofollow")
	}
	for k, v := range h {
		hd.Set(k, v)
	}
	w.WriteHeader(code)
	if r.Method != http.MethodHead {
		w.Write(body)
	}
}

func jsonBytes(v any) []byte {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.Encode(v)
	return bytes.TrimRight(buf.Bytes(), "\n")
}

const jsonType = "application/json; charset=utf-8"

func (a *App) sendJSON(w http.ResponseWriter, r *http.Request, code int, v any, h map[string]string) {
	a.send(w, r, code, jsonBytes(v), jsonType, h)
}

func (a *App) fail(w http.ResponseWriter, r *http.Request, code int, msg string) {
	a.sendJSON(w, r, code, map[string]any{"ok": false, "error": msg}, map[string]string{"Cache-Control": "no-store", "Connection": "close"})
}

var langPrefixRe = regexp.MustCompile(`^/(?:vi|en)(?:/|$)`)

var noStore = map[string]string{"Cache-Control": "no-store"}

var errTooBig = valErr{"Dữ liệu gửi lên quá lớn"}

func readBody(r *http.Request, limit int64) ([]byte, error) {
	b, err := io.ReadAll(io.LimitReader(r.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > limit {
		return nil, errTooBig
	}
	return b, nil
}

func readJSON(r *http.Request, limit int64) (map[string]any, error) {
	raw, err := readBody(r, limit)
	if err != nil {
		return nil, err
	}
	m := map[string]any{}
	if len(bytes.TrimSpace(raw)) == 0 {
		return m, nil
	}
	if err := json.Unmarshal(raw, &m); err != nil {
		return nil, valErr{"Dữ liệu JSON không hợp lệ"}
	}
	return m, nil
}

func (a *App) handleErr(w http.ResponseWriter, r *http.Request, err error) {
	if isValErr(err) {
		a.fail(w, r, 400, err.Error())
		return
	}
	log.Printf("LỖI %s %s: %v", r.Method, r.URL.Path, err)
	a.fail(w, r, 500, "Lỗi máy chủ")
}

func (a *App) serveFile(w http.ResponseWriter, r *http.Request, root, name, cache string, csp string) {
	if un, err := url.PathUnescape(name); err == nil {
		name = un
	}
	rootAbs, err := filepath.EvalSymlinks(root)
	if err != nil {
		a.fail(w, r, 404, "Không tìm thấy")
		return
	}
	full, err := filepath.EvalSymlinks(filepath.Join(rootAbs, filepath.FromSlash("/"+strings.TrimLeft(name, "/"))))
	if err != nil || !strings.HasPrefix(full, rootAbs+string(os.PathSeparator)) {
		a.fail(w, r, 404, "Không tìm thấy")
		return
	}
	if st, err := os.Stat(full); err != nil || !st.Mode().IsRegular() {
		a.fail(w, r, 404, "Không tìm thấy")
		return
	}
	body, err := os.ReadFile(full)
	if err != nil {
		a.fail(w, r, 404, "Không tìm thấy")
		return
	}
	ctype := mime.TypeByExtension(strings.ToLower(filepath.Ext(full)))
	if ctype == "" {
		ctype = "application/octet-stream"
	}
	if strings.HasPrefix(ctype, "text/") || ctype == "application/javascript" || ctype == "application/json" {
		if !strings.Contains(ctype, "charset") {
			ctype += "; charset=utf-8"
		}
	}
	h := map[string]string{"Cache-Control": cache}
	if csp != "" {
		h["Content-Security-Policy"] = csp
	}
	a.send(w, r, 200, body, ctype, h)
}

func (a *App) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("PANIC %s %s: %v", r.Method, r.URL.Path, rec)
			a.fail(w, r, 500, "Lỗi máy chủ")
		}
	}()
	p := r.URL.Path
	get := r.Method == http.MethodGet || r.Method == http.MethodHead
	switch {
	case p == "/api/content" && get:
		a.apiContent(w, r)
	case p == "/api/lead" && r.Method == http.MethodPost:
		a.apiLead(w, r)
	case p == "/api/products" && get:
		a.apiProducts(w, r)
	case p == "/api/register" && r.Method == http.MethodPost:
		a.apiRegister(w, r)
	case p == "/api/hit" && !a.isAdminHost(r):
		a.statsHit(w, r) // báo cáo lượt xem trang từ trình duyệt khách
	case p == "/api/guard/strike" && !a.isAdminHost(r):
		a.guardStrike(w, r) // nginx báo mỗi request bị giới hạn tốc độ (chỉ nhận từ 127.0.0.1)
	case p == "/api/zalo/callback" && get && !a.isAdminHost(r):
		a.zaloCallback(w, r) // Zalo chuyển về sau khi chủ OA đồng ý cấp quyền
	case p == "/api/zalo/webhook" && !a.isAdminHost(r):
		a.zaloWebhook(w, r)
	case p == "/dmca-validation.html" && get && !a.isAdminHost(r):
		// file xác minh quyền sở hữu website của DMCA.com (Claim Site); mã sửa trong CMS, Cài đặt
		c, _, err := a.currentContent(r.Context())
		if err != nil {
			a.handleErr(w, r, err)
			return
		}
		code := c.Settings["dmca_verify"]
		if code == "" {
			code = a.defaults.Settings["dmca_verify"]
		}
		if code == "" {
			a.fail(w, r, 404, "Không tìm thấy")
			return
		}
		a.send(w, r, 200, []byte(code), "text/html; charset=utf-8", noStore)
	case strings.HasPrefix(p, "/api/seo/") && len(p) == len("/api/seo/t") && strings.Contains("tdvl", p[len(p)-1:]) && get && !a.isAdminHost(r):
		a.apiSEO(w, r, p[len(p)-1:])
	case legalPDFRe.MatchString(p) && get:
		a.apiLegalPDF(w, r)
	case p == "/healthz" && get:
		a.send(w, r, 200, []byte("ok"), "text/plain; charset=utf-8", noStore)
	case strings.HasPrefix(p, "/uploads/") && get:
		a.serveFile(w, r, a.uploads(), p[len("/uploads/"):], "public, max-age=86400", upCSP)
	case a.isAdminHost(r):
		if strings.HasPrefix(p, "/api/admin/") {
			a.apiAdmin(w, r, p[len("/api/admin/"):])
		} else if get {
			name := strings.TrimPrefix(p, "/")
			if name == "" {
				name = "index.html"
			}
			a.serveFile(w, r, a.cfg.AdminDir, name, "no-cache", adminPageCSP(r))
		} else {
			a.fail(w, r, 404, "Không tìm thấy")
		}
	case a.cfg.SiteDir != "" && get && !strings.HasPrefix(p, "/api/"):
		// /vi/san-pham và /en/san-pham dùng chung trang dựng sẵn (như nginx), ngôn ngữ do giao diện xử lý
		name := strings.TrimPrefix(langPrefixRe.ReplaceAllString(p, "/"), "/")
		if name == "" {
			name = "index.html"
		}
		if st, err := os.Stat(filepath.Join(a.cfg.SiteDir, filepath.FromSlash(name))); (err != nil || !st.Mode().IsRegular()) && !strings.Contains(filepath.Base(name), ".") {
			// như nginx try_files: /mo-hinh -> mo-hinh.html (trang dựng sẵn), còn lại về trang chủ
			if st2, err2 := os.Stat(filepath.Join(a.cfg.SiteDir, filepath.FromSlash(name)+".html")); err2 == nil && st2.Mode().IsRegular() {
				name += ".html"
			} else {
				name = "index.html"
			}
		}
		if strings.HasSuffix(name, ".html") && !strings.ContainsAny(name, "/\\") {
			// trang dựng sẵn: xử lý các khối SEO như nginx SSI ở máy chủ thật
			if b, err := os.ReadFile(filepath.Join(a.cfg.SiteDir, name)); err == nil {
				c, _, _ := a.currentContent(r.Context())
				a.send(w, r, 200, applySSI(c, b), "text/html; charset=utf-8", map[string]string{"Cache-Control": "no-cache"})
				return
			}
		}
		a.serveFile(w, r, a.cfg.SiteDir, name, "no-cache", "")
	default:
		a.fail(w, r, 404, "Không tìm thấy")
	}
}

// ---- API công khai

func (a *App) currentContent(ctx context.Context) (Content, int64, error) {
	c := defaultContent(&a.defaults)
	if _, err := kvGet(ctx, a.pool, "content", &c); err != nil {
		return c, 0, err
	}
	c.normalize()
	if c.Product.Shots == nil { // chưa từng sửa ảnh giao diện trong CMS: dùng bộ ảnh mặc định
		c.Product.Shots = append([]Shot(nil), a.defaults.Product.Shots...)
	}
	c.Product.Shots = upgradeShots(c.Product.Shots, a.defaults.Product.Shots)
	var upd int64
	if _, err := kvGet(ctx, a.pool, "updated", &upd); err != nil {
		return c, 0, err
	}
	return c, upd, nil
}

func (a *App) apiContent(w http.ResponseWriter, r *http.Request) {
	c, upd, err := a.currentContent(r.Context())
	if err != nil {
		a.handleErr(w, r, err)
		return
	}
	body := jsonBytes(map[string]any{"v": upd, "ov": c.Ov, "faq": c.Faq, "partners": c.Partners, "settings": c.Settings, "legal": c.Legal, "quote": c.Quote, "clients": c.Clients, "product": c.Product})
	sum := sha1.Sum(body)
	etag := `"` + hex.EncodeToString(sum[:])[:20] + `"`
	h := map[string]string{"ETag": etag, "Cache-Control": "no-cache"}
	if r.Header.Get("If-None-Match") == etag {
		a.send(w, r, 304, nil, jsonType, h)
		return
	}
	a.send(w, r, 200, body, jsonType, h)
}

func (a *App) apiLead(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	win := 10 * time.Minute
	if !a.rl.ok("lead", ip, 6, win) || !a.rl.ok("lead", "*", 150, win) {
		a.fail(w, r, 429, "Bạn gửi quá nhiều lần, vui lòng thử lại sau ít phút.")
		return
	}
	d, err := readJSON(r, 40*1024)
	if err != nil {
		a.handleErr(w, r, err)
		return
	}
	if truthy(d["website"]) { // bẫy bot
		a.sendJSON(w, r, 200, map[string]any{"ok": true}, nil)
		return
	}
	var phone, company, need, msg, email string
	var leadID int64
	lang := "vi"
	name, err := strip(d["name"], 120, "Họ tên")
	if err == nil {
		if phone, err = strip(d["phone"], 40, "Số điện thoại"); err == nil {
			if len([]rune(name)) < 2 {
				err = bad("Nhập họ và tên.")
			} else if len(regexp.MustCompile(`\D`).ReplaceAllString(phone, "")) < 9 {
				err = bad("Số điện thoại cần ít nhất 9 chữ số.")
			}
		}
		if err == nil {
			company, err = strip(d["company"], 200, "giá trị")
		}
		if err == nil {
			need, err = strip(d["need"], 200, "giá trị")
		}
		if err == nil {
			msg, err = strip(d["message"], 4000, "giá trị")
		}
		if err == nil {
			email, err = strip(d["email"], 200, "Email")
			if err == nil && email != "" && (!emailRe.MatchString(email) || !noCRLF(email)) {
				err = bad("Email không hợp lệ.")
			}
		}
		if err == nil {
			if d["lang"] == "en" {
				lang = "en"
			}
			ua := r.Header.Get("User-Agent")
			if len(ua) > 300 {
				ua = strings.ToValidUTF8(ua[:300], "")
			}
			err = a.pool.QueryRow(r.Context(), `INSERT INTO leads(ts,name,phone,company,need,message,lang,ip,ua,email) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
				time.Now().Unix(), name, phone, company, need, msg, lang, ip, ua, email).Scan(&leadID)
		}
	}
	if err != nil {
		a.handleErr(w, r, err)
		return
	}
	base := "http://" + r.Host
	if secure(r) {
		base = "https://" + r.Host
	}
	go a.dispatchLead(leadRow{ID: leadID, TS: time.Now().Unix(), Name: name, Phone: phone, Company: company, Need: need, Message: msg, Lang: lang, Email: email}, base)
	res := map[string]any{"ok": true}
	if a.zoa.ready() { // mã để khách nhắn vào Zalo OA; chỉ hiện cho khách khi đã bật ZALO_OA_PUBLIC=1
		if code, exp, err := a.assignZaloCode(r.Context(), leadID); err == nil && a.zoa.publicOn() {
			res["zalo"] = map[string]any{"code": code, "url": a.zoa.oaURL(), "expires_at": time.Unix(exp, 0).UTC().Format(time.RFC3339)}
		} else if err != nil {
			log.Printf("Zalo OA: không tạo được mã cho yêu cầu #%d: %v", leadID, err)
		}
	}
	a.sendJSON(w, r, 200, res, nil)
}

var errNotFound = errors.New("not found")
