package main

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Cần PostgreSQL thật: TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/cmstest?sslmode=disable go test ./...
func testApp(t *testing.T) *App {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("đặt TEST_DATABASE_URL để chạy test với PostgreSQL")
	}
	ctx := context.Background()
	pool, err := openDB(ctx, url)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	for _, tb := range []string{"kv", "revisions", "leads", "tr_cache", "zalo_outbox", "zalo_seen", "guard_bans", "stats_hits", "schema_migrations"} {
		pool.Exec(ctx, "DROP TABLE IF EXISTS "+tb)
	}
	if err := migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	if err := migrate(ctx, pool); err != nil { // chạy lại phải êm
		t.Fatal(err)
	}
	d, err := loadDefaults()
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	admin := filepath.Join(dir, "admin")
	os.MkdirAll(admin, 0o755)
	os.WriteFile(filepath.Join(admin, "index.html"), []byte("<html>admin</html>"), 0o644)
	site := filepath.Join(dir, "site")
	os.MkdirAll(site, 0o755)
	os.WriteFile(filepath.Join(site, "index.html"), []byte("<html>site</html>"), 0o644)
	a := &App{cfg: Config{DataDir: dir, AdminDir: admin, SiteDir: site, AdminPass: "matkhau-thu-nghiem", SessionTTL: 3600}, pool: pool, defaults: d, rl: newLimiter(), zoa: newZaloOA(Config{})}
	if err := a.initData(ctx); err != nil {
		t.Fatal(err)
	}
	return a
}

type resp struct {
	code int
	body []byte
	hdr  http.Header
}

func (r resp) json(t *testing.T) map[string]any {
	m := map[string]any{}
	if err := json.Unmarshal(r.body, &m); err != nil {
		t.Fatalf("không phải JSON: %s", r.body)
	}
	return m
}

func do(a *App, method, host, path string, body []byte, hdr map[string]string) resp {
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Host = host
	req.RemoteAddr = "1.2.3.4:5555"
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	a.ServeHTTP(w, req)
	b, _ := io.ReadAll(w.Result().Body)
	return resp{w.Code, b, w.Result().Header}
}

const cms = "cms.example.vn"

func login(t *testing.T, a *App) string {
	r := do(a, "POST", cms, "/api/admin/login", []byte(`{"password":"matkhau-thu-nghiem"}`), map[string]string{"X-CMS": "1"})
	if r.code != 200 {
		t.Fatalf("login %d %s", r.code, r.body)
	}
	ck := r.hdr.Get("Set-Cookie")
	return strings.SplitN(ck, ";", 2)[0]
}

func TestPublicContentAndETag(t *testing.T) {
	a := testApp(t)
	r := do(a, "GET", "example.vn", "/api/content", nil, nil)
	if r.code != 200 {
		t.Fatal(r.code)
	}
	j := r.json(t)
	if len(j["faq"].([]any)) != 18 || len(j["partners"].([]any)) != 11 {
		t.Fatalf("mặc định sai: %v", j)
	}
	for _, k := range []string{"v", "ov", "settings", "legal"} {
		if _, ok := j[k]; !ok {
			t.Fatal("thiếu", k)
		}
	}
	et := r.hdr.Get("ETag")
	if r2 := do(a, "GET", "example.vn", "/api/content", nil, map[string]string{"If-None-Match": et}); r2.code != 304 {
		t.Fatalf("etag %d", r2.code)
	}
	if r3 := do(a, "GET", "example.vn", "/api/admin/me", nil, nil); r3.code == 200 {
		t.Fatal("admin không được mở trên host công khai")
	}
	if r4 := do(a, "GET", "example.vn", "/dieu-khoan", nil, nil); r4.code != 200 || !strings.Contains(string(r4.body), "site") {
		t.Fatal("SPA fallback")
	}
	if r5 := do(a, "GET", "example.vn", "/uploads/seed-vpbank.webp", nil, nil); r5.code != 200 || !strings.Contains(r5.hdr.Get("Content-Security-Policy"), "sandbox") {
		t.Fatal("logo mẫu", r5.code)
	}
	if r6 := do(a, "GET", "example.vn", "/uploads/../../etc/passwd", nil, nil); r6.code != 404 {
		t.Fatal("path traversal", r6.code)
	}
}

func TestLead(t *testing.T) {
	a := testApp(t)
	post := func(s string) resp { return do(a, "POST", "example.vn", "/api/lead", []byte(s), nil) }
	if r := post(`{"name":"A","phone":"0901234567"}`); r.code != 400 {
		t.Fatal("tên ngắn", r.code)
	}
	if r := post(`{"name":"Nguyễn An","phone":"123"}`); r.code != 400 {
		t.Fatal("sđt ngắn", r.code)
	}
	if r := post(`{"name":"Bot","phone":"0901234567","website":"x"}`); r.code != 200 {
		t.Fatal("honeypot")
	}
	if r := post(`{"name":"Nguyễn An","phone":"090 123 4567","company":"ABC","message":"xin chào\u0000","lang":"en"}`); r.code != 200 {
		t.Fatalf("hợp lệ %d %s", r.code, r.body)
	}
	ck := login(t, a)
	r := do(a, "GET", cms, "/api/admin/leads", nil, map[string]string{"Cookie": ck})
	var ls []map[string]any
	json.Unmarshal(r.body, &ls)
	if len(ls) != 1 || ls[0]["name"] != "Nguyễn An" || ls[0]["lang"] != "en" || ls[0]["status"] != "new" {
		t.Fatalf("leads: %s", r.body)
	}
	id := int(ls[0]["id"].(float64))
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	if r := do(a, "PATCH", cms, "/api/admin/leads/"+itoa(id), []byte(`{"status":"done","note":"đã gọi"}`), h); r.code != 200 {
		t.Fatal("patch", r.code, r.body)
	}
	if r := do(a, "PATCH", cms, "/api/admin/leads/"+itoa(id), []byte(`{"status":"xx"}`), h); r.code != 400 {
		t.Fatal("status xấu")
	}
	if r := do(a, "GET", cms, "/api/admin/leads?status=done&q=ABC", nil, h); !strings.Contains(string(r.body), "đã gọi") {
		t.Fatalf("lọc: %s", r.body)
	}
	if r := do(a, "GET", cms, "/api/admin/leads?q=%25", nil, h); strings.Contains(string(r.body), "Nguyễn") {
		t.Fatal("ký tự % phải được escape")
	}
	if r := do(a, "GET", cms, "/api/admin/leads.csv", nil, h); r.code != 200 || !bytes.HasPrefix(r.body, []byte{0xEF, 0xBB, 0xBF}) || !strings.Contains(string(r.body), "Nguyễn An") {
		t.Fatalf("csv %d", r.code)
	}
	if r := do(a, "DELETE", cms, "/api/admin/leads/"+itoa(id), nil, h); r.code != 200 {
		t.Fatal("delete")
	}
	// giới hạn tần suất: 6 lần / 10 phút / IP
	a2 := testApp(t)
	var last int
	for i := 0; i < 8; i++ {
		last = do(a2, "POST", "example.vn", "/api/lead", []byte(`{"name":"Nguyễn An","phone":"0901234567"}`), nil).code
	}
	if last != 429 {
		t.Fatal("rate limit", last)
	}
}

func itoa(i int) string { b, _ := json.Marshal(i); return string(b) }

func TestAuth(t *testing.T) {
	a := testApp(t)
	if r := do(a, "GET", cms, "/api/admin/me", nil, nil); r.code != 401 {
		t.Fatal("chưa đăng nhập phải 401")
	}
	if r := do(a, "POST", cms, "/api/admin/login", []byte(`{"password":"sai"}`), nil); r.code != 401 {
		t.Fatal("sai mật khẩu")
	}
	ck := login(t, a)
	r := do(a, "POST", cms, "/api/admin/login", []byte(`{"password":"matkhau-thu-nghiem"}`), map[string]string{"X-Forwarded-Proto": "https"})
	c := r.hdr.Get("Set-Cookie")
	for _, f := range []string{"HttpOnly", "SameSite=Strict", "Secure", "Max-Age=3600"} {
		if !strings.Contains(c, f) {
			t.Fatal("cookie thiếu", f, c)
		}
	}
	if r := do(a, "GET", cms, "/api/admin/me", nil, map[string]string{"Cookie": ck}); r.code != 200 {
		t.Fatal("me", r.code)
	}
	// ghi mà thiếu X-CMS: bị từ chối
	if r := do(a, "PUT", cms, "/api/admin/content", []byte(`{}`), map[string]string{"Cookie": ck}); r.code != 401 {
		t.Fatal("thiếu X-CMS", r.code)
	}
	bad := ck[:len(ck)-4] + "AAAA"
	if r := do(a, "GET", cms, "/api/admin/me", nil, map[string]string{"Cookie": bad}); r.code != 401 {
		t.Fatal("token giả")
	}
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	if r := do(a, "POST", cms, "/api/admin/password", []byte(`{"current":"sai","new":"mat-khau-moi-dai"}`), h); r.code != 400 {
		t.Fatal("pw hiện tại sai")
	}
	if r := do(a, "POST", cms, "/api/admin/password", []byte(`{"current":"matkhau-thu-nghiem","new":"ngan"}`), h); r.code != 400 {
		t.Fatal("pw ngắn")
	}
	r = do(a, "POST", cms, "/api/admin/password", []byte(`{"current":"matkhau-thu-nghiem","new":"mat-khau-moi-dai"}`), h)
	if r.code != 200 {
		t.Fatal("đổi pw", r.code, r.body)
	}
	// phiên cũ hết hiệu lực, phiên mới (cookie trả về) dùng được
	if r := do(a, "GET", cms, "/api/admin/me", nil, map[string]string{"Cookie": ck}); r.code != 401 {
		t.Fatal("phiên cũ phải hết hiệu lực")
	}
	nck := strings.SplitN(r.hdr.Get("Set-Cookie"), ";", 2)[0]
	if r := do(a, "GET", cms, "/api/admin/me", nil, map[string]string{"Cookie": nck}); r.code != 200 {
		t.Fatal("phiên mới")
	}
	// khoá đăng nhập sau 8 lần sai
	var last int
	for i := 0; i < 10; i++ {
		last = do(a, "POST", cms, "/api/admin/login", []byte(`{"password":"x"}`), nil).code
	}
	if last != 429 {
		t.Fatal("login rate limit", last)
	}
	if r := do(a, "GET", cms, "/", nil, nil); r.code != 200 || !strings.Contains(r.hdr.Get("Content-Security-Policy"), "frame-ancestors 'none'") || r.hdr.Get("X-Frame-Options") != "DENY" {
		t.Fatal("trang admin thiếu header bảo mật")
	}
}

func TestPBKDF2Compat(t *testing.T) {
	// giá trị tham chiếu tạo bằng Python: hashlib.pbkdf2_hmac('sha256', b'matkhau', bytes.fromhex('00112233445566778899aabbccddeeff'), 1000).hex()
	want := os.Getenv("PBKDF2_REF")
	if want == "" {
		t.Skip()
	}
	salt := []byte{0, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88, 0x99, 0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff}
	got := pbkdf2SHA256([]byte("matkhau"), salt, 1000, 32)
	if h := strings.ToLower(toHex(got)); h != want {
		t.Fatalf("%s != %s", h, want)
	}
}

func toHex(b []byte) string {
	const d = "0123456789abcdef"
	s := make([]byte, 0, len(b)*2)
	for _, x := range b {
		s = append(s, d[x>>4], d[x&15])
	}
	return string(s)
}

func TestContentSaveRestore(t *testing.T) {
	a := testApp(t)
	ck := login(t, a)
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	boot := do(a, "GET", cms, "/api/admin/bootstrap", nil, h).json(t)
	if boot["content"] == nil || boot["defaults"] == nil {
		t.Fatal("bootstrap")
	}
	put := func(content string) resp {
		return do(a, "PUT", cms, "/api/admin/content", []byte(`{"note":"thử","content":`+content+`}`), h)
	}
	for name, body := range map[string]string{
		"faq thiếu hỏi":    `{"faq":[{"cat":{"vi":"A"},"q":{"vi":""}}]}`,
		"faq thiếu nhóm":   `{"faq":[{"q":{"vi":"Hỏi"}}]}`,
		"đối tác link xấu": `{"partners":[{"name":"X","url":"ftp://x","group":{"vi":"G"}}]}`,
		"logo xấu":         `{"partners":[{"name":"X","logo":"http://evil/x.png","group":{"vi":"G"}}]}`,
		"email xấu":        `{"settings":{"email":"abc"}}`,
		"tel xấu":          `{"settings":{"hotline_tel":"abc"}}`,
		"ga xấu":           `{"settings":{"analytics_id":"zzz"}}`,
		"url xấu":          `{"settings":{"facebook":"javascript:alert(1)"}}`,
		"kiểu 3D xấu":      `{"settings":{"scene_style":"hacker"}}`,
		"không phải chữ":   `{"ov":{"a":{"vi":5}}}`,
	} {
		if r := put(body); r.code != 400 {
			t.Errorf("%s: mong 400, được %d %s", name, r.code, r.body)
		}
	}
	good := `{"ov":{"Xin chào":{"vi":"  Chào bạn ","en":"Hello"},"rỗng":{}},"faq":[{"id":"x y!","cat":{"vi":"Chung","en":"General"},"q":{"vi":"Hỏi?","en":"Q?"},"a":{"vi":"Đáp","en":"A"},"home":true}],
	  "partners":[{"name":"Đối tác","url":"https://a.vn","logo":"/uploads/seed-vpbank.webp","group":{"vi":"Ngân hàng"}}],
	  "settings":{"email":"a@b.vn","hotline_tel":"+84 90-123.4567","unknown":"bỏ","analytics_id":"G-ABCDE12345","scene_style":"factory"},
	  "legal":{"terms":{"title":{"vi":"Điều khoản"}},"privacy":{}}}`
	r := put(good)
	if r.code != 200 {
		t.Fatalf("lưu %d %s", r.code, r.body)
	}
	c := r.json(t)["content"].(map[string]any)
	ov := c["ov"].(map[string]any)
	if len(ov) != 1 || ov["Xin chào"].(map[string]any)["vi"] != "Chào bạn" {
		t.Fatalf("ov: %v", ov)
	}
	if c["settings"].(map[string]any)["hotline_tel"] != "+84901234567" || c["settings"].(map[string]any)["unknown"] != nil || c["settings"].(map[string]any)["scene_style"] != "factory" {
		t.Fatalf("settings: %v", c["settings"])
	}
	if c["faq"].([]any)[0].(map[string]any)["id"] != "xy" {
		t.Fatal("id phải được làm sạch")
	}
	if _, ok := c["legal"].(map[string]any)["privacy"]; ok {
		t.Fatal("legal rỗng phải bỏ")
	}
	pub := do(a, "GET", "example.vn", "/api/content", nil, nil).json(t)
	if len(pub["faq"].([]any)) != 1 || pub["v"].(float64) == 0 {
		t.Fatalf("công khai: %v", pub)
	}
	// lịch sử + khôi phục
	for i := 0; i < 3; i++ {
		put(`{"faq":[]}`)
	}
	var revs []map[string]any
	json.Unmarshal(do(a, "GET", cms, "/api/admin/revisions", nil, h).body, &revs)
	if len(revs) != 4 {
		t.Fatalf("revisions %d", len(revs))
	}
	oldest := revs[len(revs)-1]
	if oldest["faq"].(float64) != 1 {
		t.Fatalf("rev cũ nhất: %v", oldest)
	}
	if r := do(a, "POST", cms, "/api/admin/revisions/"+itoa(int(oldest["id"].(float64)))+"/restore", nil, h); r.code != 200 {
		t.Fatal("restore", r.code, r.body)
	}
	if pub := do(a, "GET", "example.vn", "/api/content", nil, nil).json(t); len(pub["faq"].([]any)) != 1 {
		t.Fatal("sau khôi phục")
	}
	if r := do(a, "POST", cms, "/api/admin/revisions/99999/restore", nil, h); r.code != 404 {
		t.Fatal("rev không tồn tại")
	}
	// chỉ giữ 60 bản
	for i := 0; i < 65; i++ {
		put(`{"faq":[]}`)
	}
	revs = nil
	json.Unmarshal(do(a, "GET", cms, "/api/admin/revisions", nil, h).body, &revs)
	if len(revs) != 60 {
		t.Fatalf("giữ %d bản", len(revs))
	}
}

func TestUpload(t *testing.T) {
	a := testApp(t)
	ck := login(t, a)
	h := map[string]string{"Cookie": ck, "X-CMS": "1", "X-Filename": "Logo%20C%C3%B4ng%20ty.PNG"}
	png := append([]byte("\x89PNG\r\n\x1a\n"), make([]byte, 50)...)
	r := do(a, "POST", cms, "/api/admin/upload", png, h)
	if r.code != 200 {
		t.Fatal(r.code, r.body)
	}
	p := r.json(t)["path"].(string)
	if !uploadRe.MatchString(p) || !strings.HasSuffix(p, ".png") {
		t.Fatal("path", p)
	}
	if g := do(a, "GET", "example.vn", p, nil, nil); g.code != 200 || !bytes.Equal(g.body, png) {
		t.Fatal("tải lại", g.code)
	}
	if r := do(a, "POST", cms, "/api/admin/upload", []byte("<svg onload=alert(1)>"), h); r.code != 400 {
		t.Fatal("svg phải bị từ chối")
	}
	if r := do(a, "POST", cms, "/api/admin/upload", append(png, make([]byte, 3<<20)...), h); r.code != 400 {
		t.Fatal("quá 2MB", r.code)
	}
}

func TestImportLegacy(t *testing.T) {
	a := testApp(t)
	f := filepath.Join(t.TempDir(), "dump.json")
	dump := `{"kv":{"secret":"abc123","admin_hash":"pbkdf2$1000$00ff$00","updated":1700000000,
	  "content":{"ov":{"Xin chào":{"vi":"Chào","en":"Hi"}},"faq":[],"partners":[],"settings":{"email":"x@y.vn"},"legal":{}}},
	  "revisions":[{"ts":1700000000,"note":"cũ","snapshot":{"faq":[]}}],
	  "leads":[{"ts":1700000001,"name":"Cũ","phone":"0900000000","company":"","need":"","message":"hi","lang":"vi","ip":"1.1.1.1","ua":"x","status":"contacted","note":"n"}]}`
	os.WriteFile(f, []byte(dump), 0o644)
	if err := a.importLegacy(context.Background(), f); err != nil {
		t.Fatal(err)
	}
	pub := do(a, "GET", "example.vn", "/api/content", nil, nil).json(t)
	if pub["settings"].(map[string]any)["email"] != "x@y.vn" || pub["v"].(float64) != 1700000000 {
		t.Fatalf("%v", pub)
	}
	var hash string
	kvGet(context.Background(), a.pool, "admin_hash", &hash)
	if hash != "pbkdf2$1000$00ff$00" {
		t.Fatal("phải giữ mật khẩu cũ")
	}
	if err := a.importLegacy(context.Background(), f); err == nil {
		t.Fatal("import lần hai phải bị từ chối")
	}
}
