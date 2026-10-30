package main

import (
	"bufio"
	"encoding/base64"
	"encoding/json"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"testing"
)

// fakeTranslate giả lập điểm cuối dịch của Google: trả "EN: " + bản gốc.
func fakeTranslate(t *testing.T) (*httptest.Server, *int) {
	n := new(int)
	var mu sync.Mutex
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.ParseForm()
		q := r.PostForm.Get("q")
		mu.Lock()
		*n++
		mu.Unlock()
		b, _ := json.Marshal([]any{[]any{[]any{"EN: " + q, q}}, nil, "vi"})
		w.Write(b)
	}))
	t.Cleanup(srv.Close)
	return srv, n
}

func TestAutoTranslate(t *testing.T) {
	a := testApp(t)
	srv, calls := fakeTranslate(t)
	a.tr = &translator{client: srv.Client(), url: srv.URL}
	ck := login(t, a)
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	put := func(content string) map[string]any {
		r := do(a, "PUT", cms, "/api/admin/content", []byte(`{"content":`+content+`}`), h)
		if r.code != 200 {
			t.Fatalf("lưu %d %s", r.code, r.body)
		}
		return r.json(t)
	}
	ov := func(j map[string]any, k string) map[string]any {
		return j["content"].(map[string]any)["ov"].(map[string]any)[k].(map[string]any)
	}
	// 1) chỉ có tiếng Việt: tự có bản English
	j := put(`{"ov":{"Xin chào":{"vi":"Chào bạn {{company_name}}"}}}`)
	o := ov(j, "Xin chào")
	if o["en"] != "EN: Chào bạn {{company_name}}" || o["x"] == nil || j["translated"].(float64) != 1 {
		t.Fatalf("lần 1: %v %v", o, j["translated"])
	}
	// 2) lưu lại không đổi: không dịch lại
	before := *calls
	j = put(`{"ov":{"Xin chào":` + mustJSON(o) + `}}`)
	if *calls != before || j["translated"].(float64) != 0 {
		t.Fatalf("không được dịch lại: %d -> %d", before, *calls)
	}
	// 3) đổi tiếng Việt: dịch lại vì EN là bản máy dịch
	o2 := map[string]any{"vi": "Tạm biệt", "en": o["en"], "x": o["x"]}
	j = put(`{"ov":{"Xin chào":` + mustJSON(o2) + `}}`)
	if ov(j, "Xin chào")["en"] != "EN: Tạm biệt" {
		t.Fatalf("lần 3: %v", ov(j, "Xin chào"))
	}
	// 4) người dùng tự sửa English: giữ nguyên, bỏ cờ tự dịch, đổi tiếng Việt cũng không ghi đè
	o3 := ov(j, "Xin chào")
	o3["en"] = "Goodbye (tay)"
	j = put(`{"ov":{"Xin chào":` + mustJSON(o3) + `}}`)
	o4 := ov(j, "Xin chào")
	if o4["en"] != "Goodbye (tay)" || o4["x"] != nil {
		t.Fatalf("lần 4: %v", o4)
	}
	o4["vi"] = "Hẹn gặp lại"
	j = put(`{"ov":{"Xin chào":` + mustJSON(o4) + `}}`)
	if ov(j, "Xin chào")["en"] != "Goodbye (tay)" {
		t.Fatalf("lần 5 ghi đè bản tự sửa: %v", ov(j, "Xin chào"))
	}
	// 6) hỏi đáp và báo giá cũng tự dịch
	j = put(`{"faq":[{"id":"a1","cat":{"vi":"Chung"},"q":{"vi":"Câu hỏi?"},"a":{"vi":"Trả lời."}}],"quote":{"plans":[{"id":"p1","name":{"vi":"Gói A"},"price":{"vi":"Liên hệ"},"features":[{"vi":"Tính năng một"}]}]}}`)
	c := j["content"].(map[string]any)
	faq := c["faq"].([]any)[0].(map[string]any)
	if faq["q"].(map[string]any)["en"] != "EN: Câu hỏi?" || faq["cat"].(map[string]any)["en"] != "EN: Chung" {
		t.Fatalf("faq: %v", faq)
	}
	pl := c["quote"].(map[string]any)["plans"].([]any)[0].(map[string]any)
	if pl["name"].(map[string]any)["en"] != "EN: Gói A" || pl["features"].([]any)[0].(map[string]any)["en"] != "EN: Tính năng một" {
		t.Fatalf("quote: %v", pl)
	}
	// 7b) khách hàng: mô tả tự dịch, logo phải là ảnh đã tải lên
	j = put(`{"clients":[{"id":"k1","name":"Công ty A","desc":{"vi":"Khách hàng thân thiết"}}]}`)
	cl := j["content"].(map[string]any)["clients"].([]any)[0].(map[string]any)
	if cl["desc"].(map[string]any)["en"] == "" || cl["name"] != "Công ty A" {
		t.Fatalf("clients: %v", cl)
	}
	if r := do(a, "PUT", cms, "/api/admin/content", []byte(`{"content":{"clients":[{"name":"X","logo":"http://evil/x.png"}]}}`), h); r.code != 400 {
		t.Fatalf("logo xấu phải 400, được %d", r.code)
	}
	// 7) dịch lỗi thì vẫn lưu được, EN để trống
	srv.Close()
	j = put(`{"ov":{"Lỗi":{"vi":"Chữ mới"}}}`)
	if ov(j, "Lỗi")["en"] != nil && ov(j, "Lỗi")["en"] != "" || j["translate_failed"].(float64) != 1 {
		t.Fatalf("lỗi dịch: %v", j)
	}
	// 8) báo giá không hợp lệ
	if r := do(a, "PUT", cms, "/api/admin/content", []byte(`{"content":{"quote":{"plans":[{"name":{"vi":""}}]}}}`), h); r.code != 400 {
		t.Fatalf("gói thiếu tên phải 400, được %d", r.code)
	}
	// công khai có quote
	pub := do(a, "GET", "example.vn", "/api/content", nil, nil).json(t)
	if _, ok := pub["clients"]; !ok {
		t.Fatal("thiếu clients ở /api/content")
	}
	if r := do(a, "GET", cms, "/", nil, nil); !strings.Contains(r.hdr.Get("Content-Security-Policy"), "frame-src 'self' https://example.vn") {
		t.Fatalf("CSP trang quản trị phải cho nhúng website chính: %s", r.hdr.Get("Content-Security-Policy"))
	}
	if _, ok := pub["quote"]; !ok {
		t.Fatal("thiếu quote ở /api/content")
	}
}

func mustJSON(v any) string { b, _ := json.Marshal(v); return string(b) }

// fakeSMTP là máy chủ SMTP tối thiểu (không mã hoá, không đăng nhập) để thử gửi thư.
func fakeSMTP(t *testing.T) (host string, port int, msgs chan string) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { l.Close() })
	msgs = make(chan string, 4)
	go func() {
		for {
			c, err := l.Accept()
			if err != nil {
				return
			}
			go func(c net.Conn) {
				defer c.Close()
				rd := bufio.NewReader(c)
				c.Write([]byte("220 fake ESMTP\r\n"))
				var data strings.Builder
				in := false
				for {
					line, err := rd.ReadString('\n')
					if err != nil {
						return
					}
					if in {
						if line == ".\r\n" {
							in = false
							msgs <- data.String()
							c.Write([]byte("250 queued\r\n"))
						} else {
							data.WriteString(line)
						}
						continue
					}
					cmd := strings.ToUpper(strings.TrimSpace(line))
					switch {
					case strings.HasPrefix(cmd, "EHLO"), strings.HasPrefix(cmd, "HELO"):
						c.Write([]byte("250 fake\r\n"))
					case strings.HasPrefix(cmd, "DATA"):
						in = true
						c.Write([]byte("354 go\r\n"))
					case strings.HasPrefix(cmd, "QUIT"):
						c.Write([]byte("221 bye\r\n"))
						return
					default:
						c.Write([]byte("250 ok\r\n"))
					}
				}
			}(c)
		}
	}()
	h, p, _ := net.SplitHostPort(l.Addr().String())
	port, _ = strconv.Atoi(p)
	return h, port, msgs
}

func TestSMTPConfigAndSend(t *testing.T) {
	a := testApp(t)
	ck := login(t, a)
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	// mặc định điền sẵn theo hộp thư iNET, chưa có mật khẩu
	g := do(a, "GET", cms, "/api/admin/smtp", nil, h).json(t)
	if g["has_password"] != false || g["smtp"].(map[string]any)["host"] != "mail.3rdhubvietnam.tech" || g["smtp"].(map[string]any)["port"].(float64) != 465 {
		t.Fatalf("mặc định: %v", g)
	}
	host, port, msgs := fakeSMTP(t)
	body := map[string]any{"host": host, "port": port, "security": "none", "user": "", "from_email": "hello@3rdhubvietnam.tech", "from_name": "3RDHub Vietnam", "notify_to": "ops@example.vn", "notify_leads": true, "password": "bi-mat-123"}
	r := do(a, "PUT", cms, "/api/admin/smtp", []byte(mustJSON(body)), h)
	if r.code != 200 || strings.Contains(string(r.body), "bi-mat-123") || r.json(t)["has_password"] != true {
		t.Fatalf("lưu smtp %d %s", r.code, r.body)
	}
	// mật khẩu không nằm ở đâu công khai, trong DB chỉ ở dạng mã hoá
	if pub := do(a, "GET", "example.vn", "/api/content", nil, nil); strings.Contains(string(pub.body), "bi-mat-123") || strings.Contains(string(pub.body), "pass_enc") {
		t.Fatal("rò mật khẩu ở /api/content")
	}
	var raw string
	a.pool.QueryRow(t.Context(), `SELECT value::text FROM kv WHERE key='smtp'`).Scan(&raw)
	if strings.Contains(raw, "bi-mat-123") || !strings.Contains(raw, "pass_enc") {
		t.Fatalf("mật khẩu phải được mã hoá: %s", raw)
	}
	if pw, err := a.unseal(a.loadSMTP(t.Context()).PassEnc); err != nil || pw != "bi-mat-123" {
		t.Fatalf("giải mã: %q %v", pw, err)
	}
	// lưu lại không gửi mật khẩu thì giữ mật khẩu cũ
	body2 := map[string]any{"host": host, "port": port, "security": "none", "user": "", "from_email": "hello@3rdhubvietnam.tech", "notify_to": "ops@example.vn", "notify_leads": true}
	if r := do(a, "PUT", cms, "/api/admin/smtp", []byte(mustJSON(body2)), h); r.json(t)["has_password"] != true {
		t.Fatal("mất mật khẩu khi lưu lại")
	}
	// gửi thử
	if r := do(a, "POST", cms, "/api/admin/smtp-test", []byte(`{"to":"a@b.vn"}`), h); r.code != 200 {
		t.Fatalf("gửi thử %d %s", r.code, r.body)
	}
	m := <-msgs
	if !strings.Contains(m, "To: a@b.vn") || !strings.Contains(m, "Subject: =?utf-8?q?") || !strings.Contains(m, "Content-Transfer-Encoding: base64") {
		t.Fatalf("thư sai: %s", m)
	}
	// yêu cầu mới từ form → thư thông báo (đã bật)
	lead := `{"name":"Nguyễn Văn A","phone":"0901234567","company":"Cty","need":"Báo giá","message":"Cần báo giá hệ thống"}`
	if r := do(a, "POST", "example.vn", "/api/lead", []byte(lead), nil); r.code != 200 {
		t.Fatalf("lead %d", r.code)
	}
	m = <-msgs
	body64 := m[strings.Index(m, "\r\n\r\n")+4:]
	dec, _ := base64.StdEncoding.DecodeString(strings.ReplaceAll(strings.TrimSpace(body64), "\r\n", ""))
	if !strings.Contains(m, "To: ops@example.vn") || !strings.Contains(string(dec), "Nguyễn Văn A") {
		t.Fatalf("thư thông báo: %s | %s", m, dec)
	}
	// dữ liệu xấu
	for name, bd := range map[string]map[string]any{
		"host xấu":  {"host": "a b", "port": 465, "security": "ssl", "from_email": "x@y.vn"},
		"cổng xấu":  {"host": "mail.x.vn", "port": 0, "security": "ssl", "from_email": "x@y.vn"},
		"kiểu xấu":  {"host": "mail.x.vn", "port": 465, "security": "ftp", "from_email": "x@y.vn"},
		"email xấu": {"host": "mail.x.vn", "port": 465, "security": "ssl", "from_email": "x\r\nBcc: z@z.vn"},
	} {
		if r := do(a, "PUT", cms, "/api/admin/smtp", []byte(mustJSON(bd)), h); r.code != 400 {
			t.Errorf("%s: mong 400, được %d", name, r.code)
		}
	}
	if r := do(a, "GET", "example.vn", "/api/admin/smtp", nil, nil); r.code != 404 {
		t.Errorf("smtp không được lộ ở tên miền chính: %d", r.code)
	}
	_ = url.Values{}
}
