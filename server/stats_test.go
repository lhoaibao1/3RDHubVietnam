package main

import (
	"strings"
	"testing"
)

func TestStats(t *testing.T) {
	a := testApp(t)
	chrome := "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
	iphone := "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
	hit := func(ip, ua, body string, extra map[string]string) int {
		h := map[string]string{"User-Agent": ua, "X-Real-IP": ip, "Content-Type": "application/json"}
		for k, v := range extra {
			h[k] = v
		}
		return do(a, "POST", "example.vn", "/api/hit", []byte(body), h).code
	}
	// 2 khách: A xem 2 trang (từ Google), B xem 1 trang (từ Facebook, iPhone, Việt Nam)
	hit("1.1.1.1", chrome, `{"p":"/san-pham","l":"vi","r":"https://www.google.com/search?q=3rdhub","w":1440}`, map[string]string{"CF-IPCountry": "VN"})
	hit("1.1.1.1", chrome, `{"p":"/baogia","l":"vi","r":"","w":1440}`, map[string]string{"CF-IPCountry": "VN"})
	hit("2.2.2.2", iphone, `{"p":"/","l":"en","r":"https://l.facebook.com/","w":390}`, map[string]string{"CF-IPCountry": "US"})
	hit("3.3.3.3", chrome, `{"p":"/","l":"vi","r":"","u":"zalo-oa","w":1280}`, nil)
	// bỏ qua: bot, đường dẫn lạ, nội dung hỏng
	for _, c := range []int{
		hit("4.4.4.4", "Googlebot/2.1 (+http://www.google.com/bot.html)", `{"p":"/","l":"vi"}`, nil),
		hit("5.5.5.5", chrome, `{"p":"/<script>","l":"vi"}`, nil),
		hit("5.5.5.5", chrome, `không phải json`, nil),
		hit("5.5.5.5", "curl/8.0", `{"p":"/"}`, nil),
	} {
		if c != 204 {
			t.Fatalf("luôn trả 204: %d", c)
		}
	}
	ck := login(t, a)
	r := do(a, "GET", cms, "/api/admin/stats?days=7", nil, map[string]string{"X-CMS": "1", "Cookie": ck})
	j := r.json(t)
	tot := j["totals"].(map[string]any)
	if r.code != 200 || tot["views"].(float64) != 4 || tot["visitors"].(float64) != 3 || tot["online"].(float64) != 3 {
		t.Fatalf("%d %s", r.code, r.body)
	}
	src := map[string]string{}
	for _, s := range j["sources"].([]any) {
		m := s.(map[string]any)
		src[m["ch"].(string)+":"+m["k"].(string)] = "x"
	}
	for _, k := range []string{"search:google.com", "social:l.facebook.com", "campaign:zalo-oa", "direct:"} {
		if src[k] == "" {
			t.Fatalf("thiếu nguồn %s: %v", k, src)
		}
	}
	dev := map[string]float64{}
	for _, s := range j["devices"].([]any) {
		m := s.(map[string]any)
		dev[m["k"].(string)] = m["n"].(float64)
	}
	if dev["desktop"] != 3 || dev["mobile"] != 1 {
		t.Fatalf("thiết bị: %v", dev)
	}
	if n := len(j["series"].([]any)); n != 7 {
		t.Fatalf("7 ngày phải có 7 mốc: %d", n)
	}
	last := j["series"].([]any)[6].(map[string]any)
	if last["views"].(float64) != 4 || last["visitors"].(float64) != 3 {
		t.Fatalf("hôm nay: %v", last)
	}
	if h := do(a, "GET", cms, "/api/admin/stats?days=1", nil, map[string]string{"X-CMS": "1", "Cookie": ck}).json(t); len(h["series"].([]any)) != 24 {
		t.Fatalf("1 ngày phải có 24 mốc giờ")
	}
	// không lưu IP hay User-Agent
	var ips int
	a.pool.QueryRow(t.Context(), `SELECT count(*) FROM stats_hits WHERE vid LIKE '%1.1.1.1%' OR path LIKE '%Mozilla%' OR ref LIKE '%Mozilla%'`).Scan(&ips)
	if ips != 0 {
		t.Fatal("không được lưu IP hay User-Agent")
	}
	if strings.Contains(string(r.body), "1.1.1.1") {
		t.Fatal("thống kê không được lộ IP")
	}
	if do(a, "GET", cms, "/api/admin/stats", nil, nil).code != 401 {
		t.Fatal("phải đăng nhập")
	}
	if do(a, "GET", "example.vn", "/api/hit", nil, nil).code != 404 {
		t.Fatal("GET /api/hit phải 404")
	}
}
