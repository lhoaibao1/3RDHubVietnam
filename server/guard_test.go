package main

import (
	"bytes"
	"context"
	"io"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
	"time"
)

// strike giả lập nginx chuyển một request bị 429 sang backend.
func strike(a *App, peer, ip, ua string) int {
	req := httptest.NewRequest("GET", "/api/guard/strike", nil)
	req.Host = "example.vn"
	req.RemoteAddr = peer + ":4000"
	req.Header.Set("X-Real-IP", ip)
	req.Header.Set("User-Agent", ua)
	req.Header.Set("Accept-Language", "vi-VN")
	req.Header.Set("X-Orig-URI", "/api/content")
	w := httptest.NewRecorder()
	a.ServeHTTP(w, req)
	io.Copy(io.Discard, w.Result().Body)
	return w.Code
}

func bansOf(t *testing.T, a *App) map[string]guardBan {
	t.Helper()
	list, err := a.guardActiveBans(testCtx(), false)
	if err != nil {
		t.Fatal(err)
	}
	m := map[string]guardBan{}
	for _, b := range list {
		m[b.Kind+"|"+b.Value] = b
	}
	return m
}

func TestGuardIPBan(t *testing.T) {
	a := testApp(t)
	a.cfg.GuardDir = t.TempDir()
	a.gd = newGuard(a.cfg.GuardDir)

	if c := strike(a, "8.8.8.8", "5.5.5.5", "bot"); c != 404 {
		t.Fatalf("chỉ nhận từ máy chủ nội bộ, nhận %d", c)
	}
	for i := 0; i < 9; i++ {
		if c := strike(a, "127.0.0.1", "5.5.5.5", "bot"); c != 429 {
			t.Fatalf("phải trả 429, nhận %d", c)
		}
	}
	if len(bansOf(t, a)) != 0 {
		t.Fatal("chưa đủ 10 lần, chưa được cấm")
	}
	strike(a, "127.0.0.1", "5.5.5.5", "bot")
	b, ok := bansOf(t, a)["ip|5.5.5.5"]
	if !ok || b.Source != "auto" || b.Expires < time.Now().Add(55*time.Minute).Unix() {
		t.Fatalf("IP phải bị cấm 1 giờ: %+v", b)
	}
	a.guardSync(testCtx())
	got, _ := os.ReadFile(filepath.Join(a.cfg.GuardDir, "ban-ip.conf"))
	if !strings.Contains(string(got), "5.5.5.5/32 1;") {
		t.Fatalf("file cho nginx thiếu IP bị cấm: %s", got)
	}
	if _, err := os.Stat(filepath.Join(a.cfg.GuardDir, "reload")); err != nil {
		t.Fatal("phải chạm file reload để nginx nạp lại")
	}

	// tái phạm: cấm lâu hơn (gấp 4)
	if err := a.guardBan(testCtx(), "ip", "5.5.5.5", "", "lần 2", "auto", time.Hour, true); err != nil {
		t.Fatal(err)
	}
	if b2 := bansOf(t, a)["ip|5.5.5.5"]; b2.Times != 2 || b2.Expires < time.Now().Add(3*time.Hour).Unix() {
		t.Fatalf("tái phạm phải bị cấm lâu hơn: %+v", b2)
	}
}

func TestGuardNeverBansProtected(t *testing.T) {
	a := testApp(t)
	a.gd = newGuard("")
	cfg := defaultGuardCfg()
	cfg.Allow = []string{"9.9.9.0/24"}
	for _, ip := range []string{"104.16.1.1", "172.67.5.5", "2606:4700::1", "10.0.0.5", "127.0.0.1", "192.168.1.1", "9.9.9.9"} {
		for i := 0; i < 50; i++ {
			a.guardRecord(testCtx(), mustAddr(ip), "ua|vi||", "ua", "/", cfg)
		}
	}
	if n := len(bansOf(t, a)); n != 0 {
		t.Fatalf("IP Cloudflare, nội bộ, trong danh sách cho phép không được cấm, đang có %d lệnh", n)
	}
	for _, v := range []string{"104.16.1.1", "10.0.0.0/8", "1.0.0.0/8", "104.16.0.0/16", "127.0.0.1"} {
		if err := a.guardBan(testCtx(), "ip", v, "", "x", "admin", 0, false); err == nil {
			t.Fatalf("lẽ ra phải từ chối cấm %s", v)
		}
	}
	if err := a.guardBan(testCtx(), "ip", "203.0.113.0/24", "", "dải /24 hợp lệ", "admin", 0, false); err != nil {
		t.Fatal(err)
	}
}

func TestGuardFingerprintBan(t *testing.T) {
	a := testApp(t)
	a.cfg.GuardDir = t.TempDir()
	a.gd = newGuard(a.cfg.GuardDir)
	ua := "Mozilla/5.0 (X11; Linux x86_64) BotNet/1.0 (+evil.example)"
	// 6 IP, mỗi IP bị 5 lần, nhưng không IP nào đủ 10 lần để bị cấm riêng; tổng 150 thì cấm cả trình duyệt
	cfg := defaultGuardCfg()
	cfg.IPStrikes = 1000
	cfg.FPStrikes = 30
	for r := 0; r < 5; r++ {
		for i := 1; i <= 6; i++ {
			a.guardRecord(testCtx(), mustAddr("198.51.100."+itoa(i)), ua+"|vi-VN|gzip||", ua, "/", cfg)
		}
	}
	m := bansOf(t, a)
	fp := ua + "|vi-VN|gzip||"
	if _, ok := m["fp|"+fp]; !ok {
		t.Fatalf("trình duyệt phải bị cấm: %v", m)
	}
	a.guardSync(testCtx())
	raw, _ := os.ReadFile(filepath.Join(a.cfg.GuardDir, "ban-fp.conf"))
	line := ""
	for _, l := range strings.Split(string(raw), "\n") {
		if strings.HasPrefix(l, `"~^`) {
			line = l
		}
	}
	if line == "" {
		t.Fatalf("thiếu dòng regex: %s", raw)
	}
	// bỏ dấu nháy và hậu tố " 1;", đổi \\ về \ như nginx đọc, rồi thử khớp
	rx := strings.TrimSuffix(line, `" 1;`)
	rx = strings.TrimPrefix(rx, `"~`)
	rx = strings.ReplaceAll(rx, `\\`, `\`)
	re := regexp.MustCompile(rx)
	if !re.MatchString(fp) {
		t.Fatalf("regex %s phải khớp chữ ký bị cấm", rx)
	}
	if re.MatchString("Mozilla/5.0 (Windows NT 10.0) Chrome/120|vi-VN|gzip||") {
		t.Fatal("không được khớp trình duyệt thường")
	}
}

func TestGuardFiles(t *testing.T) {
	f := guardFiles([]guardBan{{Kind: "ip", Value: "1.2.3.4"}, {Kind: "ip", Value: "2001:db8::/48"}, {Kind: "fp", Value: `a"b\c$|x`}}, []string{"5.6.7.8"})
	if !strings.Contains(f["ban-ip.conf"], "1.2.3.4/32 1;") || !strings.Contains(f["ban-ip.conf"], "2001:db8::/48 1;") || !strings.Contains(f["allow-ip.conf"], "5.6.7.8/32 1;") {
		t.Fatalf("%v", f)
	}
	if !strings.Contains(f["ban-fp.conf"], `a\"b\\\\c\\$\\|x`) {
		t.Fatalf("ký tự đặc biệt phải được thoát đúng cho nginx: %s", f["ban-fp.conf"])
	}
	if fpBannable("tiếng việt|x") || fpBannable("") || !fpBannable("Mozilla|vi||") {
		t.Fatal("fpBannable")
	}
}

func TestGuardAdminAPI(t *testing.T) {
	a := testApp(t)
	a.gd = newGuard("")
	ck := login(t, a)
	h := map[string]string{"X-CMS": "1", "Cookie": ck, "Content-Type": "application/json", "X-Real-IP": "203.0.113.7"}
	post := func(path, body string) resp {
		return do(a, "POST", cms, "/api/admin/"+path, []byte(body), h)
	}
	r := do(a, "GET", cms, "/api/admin/guard", nil, h)
	j := r.json(t)
	if r.code != 200 || j["own_ip"] != "203.0.113.7" || j["config"].(map[string]any)["enabled"] != true {
		t.Fatalf("%d %v", r.code, j)
	}
	if r := post("guard/ban", `{"kind":"ip","value":"203.0.113.7","hours":1}`); r.code != 400 {
		t.Fatalf("không được cấm IP của chính mình: %d %s", r.code, r.body)
	}
	if r := post("guard/ban", `{"kind":"ip","value":"198.51.100.9","hours":24,"reason":"thử"}`); r.code != 200 {
		t.Fatalf("%d %s", r.code, r.body)
	}
	if r := post("guard/ban", `{"kind":"ip","value":"abc"}`); r.code != 400 {
		t.Fatalf("IP sai phải bị từ chối: %d", r.code)
	}
	list := do(a, "GET", cms, "/api/admin/guard", nil, h).json(t)["bans"].([]any)
	if len(list) != 1 {
		t.Fatalf("%v", list)
	}
	id := int(list[0].(map[string]any)["id"].(float64))
	if r := post("guard/unban", `{"id":`+itoa(id)+`}`); r.code != 200 || len(r.json(t)["bans"].([]any)) != 0 {
		t.Fatalf("%d %s", r.code, r.body)
	}
	put := func(body string) resp { return do(a, "PUT", cms, "/api/admin/guard/config", []byte(body), h) }
	if r := put(`{"enabled":true,"allow":["1.1.1.300"]}`); r.code != 400 {
		t.Fatalf("danh sách cho phép sai phải bị từ chối: %d", r.code)
	}
	r = put(`{"enabled":false,"ip_strikes":20,"allow":["203.0.113.7"]}`)
	c := r.json(t)["config"].(map[string]any)
	if r.code != 200 || c["enabled"] != false || c["ip_strikes"].(float64) != 20 || c["fp_strikes"].(float64) != 150 {
		t.Fatalf("%d %v", r.code, c)
	}
	// khi tắt, request bị 429 không còn bị tính
	req := httptest.NewRequest("GET", "/api/guard/strike", bytes.NewReader(nil))
	req.RemoteAddr = "127.0.0.1:1"
	req.Header.Set("X-Real-IP", "198.51.100.77")
	for i := 0; i < 30; i++ {
		w := httptest.NewRecorder()
		a.ServeHTTP(w, req)
	}
	if len(bansOf(t, a)) != 0 {
		t.Fatal("tắt bảo vệ thì không tự cấm")
	}
	// không đăng nhập thì không xem được
	if r := do(a, "GET", cms, "/api/admin/guard", nil, nil); r.code != 401 {
		t.Fatalf("%d", r.code)
	}
}

func testCtx() context.Context { return context.Background() }
