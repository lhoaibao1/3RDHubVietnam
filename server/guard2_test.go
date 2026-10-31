package main

import (
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// strikeC giả lập nginx báo 429 kèm cookie thiết bị.
func strikeC(a *App, ip, ua, cookie string) {
	req := httptest.NewRequest("GET", "/api/guard/strike", nil)
	req.RemoteAddr = "127.0.0.1:1"
	req.Header.Set("X-Real-IP", ip)
	req.Header.Set("User-Agent", ua)
	req.Header.Set("Cookie", cookie)
	a.ServeHTTP(httptest.NewRecorder(), req)
}

func TestGuardDeviceAcrossProxies(t *testing.T) {
	a := testApp(t)
	a.cfg.GuardDir = t.TempDir()
	a.gd = newGuard(a.cfg.GuardDir)
	dv := "0123456789abcdef0123"
	ua := "Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A) Chrome/126 Mobile Safari/537.36"
	// một thiết bị đổi proxy liên tục: mỗi IP chỉ bị 3 lần nên IP nào cũng chưa bị cấm riêng, nhưng thiết bị bị cấm
	for r := 0; r < 4; r++ {
		for i := 1; i <= 6; i++ {
			strikeC(a, "198.51.100."+itoa(10+i), ua, "rh_dv="+dv+"; rh_md=SM-S911B")
		}
	}
	m := bansOf(t, a)
	if _, ok := m["dv|"+dv]; !ok {
		t.Fatalf("thiết bị phải bị cấm: %v", m)
	}
	a.guardSync(testCtx())
	raw, _ := os.ReadFile(filepath.Join(a.cfg.GuardDir, "ban-dv.conf"))
	if !strings.Contains(string(raw), `"`+dv+`" 1;`) {
		t.Fatalf("file thiết bị: %s", raw)
	}
	// model Android lấy từ User-Agent khi chưa có cookie
	if mm := androidModelRe.FindStringSubmatch(ua); mm == nil || mm[1] != "SM-S911B" {
		t.Fatalf("model: %v", mm)
	}
}

func TestGuardModelUACountryTools(t *testing.T) {
	a := testApp(t)
	a.cfg.GuardDir = t.TempDir()
	a.gd = newGuard(a.cfg.GuardDir)
	ctx := testCtx()
	for _, b := range [][3]string{{"model", "SM-S911B", ""}, {"ua", "BadBot", ""}, {"cc", "ru", ""}, {"cc", "CN", ""}, {"dv", "ABCDEF0123456789ABCD", ""}} {
		if err := a.guardBan(ctx, b[0], b[1], "", "thử", "admin", 0, false); err != nil {
			t.Fatalf("%v: %v", b, err)
		}
	}
	for _, bad := range [][2]string{{"cc", "VN"}, {"cc", "RUS"}, {"model", "<x>"}, {"ua", "ab"}, {"dv", "xyz"}, {"abc", "1"}} {
		if err := a.guardBan(ctx, bad[0], bad[1], "", "x", "admin", 0, false); err == nil {
			t.Fatalf("lẽ ra phải từ chối %v", bad)
		}
	}
	a.guardSync(ctx)
	rd := func(n string) string { b, _ := os.ReadFile(filepath.Join(a.cfg.GuardDir, n)); return string(b) }
	if !strings.Contains(rd("ban-cc.conf"), `"RU" 1;`) || !strings.Contains(rd("ban-cc.conf"), `"CN" 1;`) || !strings.Contains(rd("ban-dv.conf"), `"abcdef0123456789abcd" 1;`) {
		t.Fatalf("%s %s", rd("ban-cc.conf"), rd("ban-dv.conf"))
	}
	// biểu thức chính quy model: khớp trong User-Agent và cookie, không khớp model khác chứa chuỗi này
	line := ""
	for _, l := range strings.Split(rd("ban-model.conf"), "\n") {
		if strings.HasPrefix(l, `"~*`) {
			line = l
		}
	}
	rx := regexp.MustCompile("(?i)" + strings.ReplaceAll(strings.TrimSuffix(strings.TrimPrefix(line, `"~*`), `" 1;`), `\\`, `\`))
	for in, want := range map[string]bool{
		"Mozilla/5.0 (Linux; Android 14; SM-S911B Build/UP1A)|": true, "x|SM-S911B|": true, `x||"SM-S911B"`: true,
		"Mozilla/5.0 (Linux; Android 14; SM-S911B2 Build/UP1A)|": false, "Mozilla/5.0 (Windows)|": false,
	} {
		if rx.MatchString(in) != want {
			t.Fatalf("%q mong %v", in, want)
		}
	}
	if !strings.Contains(rd("ban-ua.conf"), `"~*(?:BadBot)" 1;`) {
		t.Fatal(rd("ban-ua.conf"))
	}
	if !strings.Contains(rd("tool-block.conf"), "1 1;") || !strings.Contains(rd("zones.conf"), "rate=20r/s") {
		t.Fatalf("%s %s", rd("tool-block.conf"), rd("zones.conf"))
	}
	// mức "Tối đa" và tắt chặn công cụ
	f := guardFiles(nil, guardCfg{Level: "max", ToolsOff: true})
	if !strings.Contains(f["zones.conf"], "zone=rh_ip:20m rate=5r/s") || strings.Contains(f["tool-block.conf"], "1 1;") {
		t.Fatalf("%v", f)
	}
}

func TestGuardSubnetEscalation(t *testing.T) {
	a := testApp(t)
	a.gd = newGuard("")
	for _, ip := range []string{"203.0.113.5", "203.0.113.77", "203.0.113.200"} {
		if err := a.guardBan(testCtx(), "ip", ip, "", "tự động", "auto", 3600e9, true); err != nil {
			t.Fatal(err)
		}
	}
	if b, ok := bansOf(t, a)["ip|203.0.113.0/24"]; !ok || b.Source != "auto" {
		t.Fatalf("3 IP cùng /24 thì cấm cả dải: %v", bansOf(t, a))
	}
	// IP rải rác ở các dải khác nhau thì không
	if err := a.guardBan(testCtx(), "ip", "198.51.100.1", "", "x", "auto", 3600e9, true); err != nil {
		t.Fatal(err)
	}
	if _, ok := bansOf(t, a)["ip|198.51.100.0/24"]; ok {
		t.Fatal("không được cấm dải khi chỉ có 1 IP")
	}
}
