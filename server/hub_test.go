package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func hubApp(c Config) *App {
	return &App{cfg: c, rl: newLimiter(), hub: newHubClient(c)}
}

func regBody(phone string, extra map[string]any) []byte {
	m := map[string]any{"full_name": "Nguyễn Văn A", "phone": phone, "product_code": "FE", "province": "Hồ Chí Minh", "note": "",
		"consent": true, "consent_text": "Tôi đồng ý ...", "source_url": "https://3rdhubvietnam.tech/dang-ky?product=FE",
		"utm": map[string]any{"source": "fb"}, "ref": "RD260001"}
	for k, v := range extra {
		m[k] = v
	}
	return jsonBytes(m)
}

func TestHubRegisterMock(t *testing.T) {
	a := hubApp(Config{HubMock: true})
	ip := 0
	post := func(body []byte) resp {
		ip++ // mỗi lần một IP để không đụng giới hạn tần suất của trang
		req := httptest.NewRequest("POST", "/api/register", strings.NewReader(string(body)))
		req.Host = "example.vn"
		req.RemoteAddr = "10.0.0." + string(rune('0'+ip%10)) + string(rune('0'+ip/10)) + ":1"
		w := httptest.NewRecorder()
		a.ServeHTTP(w, req)
		b, _ := io.ReadAll(w.Result().Body)
		return resp{w.Code, b, w.Result().Header}
	}
	errOf := func(r resp) map[string]any { e, _ := r.json(t)["error"].(map[string]any); return e }

	r := do(a, "GET", "example.vn", "/api/products", nil, nil)
	if r.code != 200 || !strings.Contains(string(r.body), `"code":"FE"`) {
		t.Fatalf("products %d %s", r.code, r.body)
	}

	// thành công, số có +84 và khoảng trắng
	r = post(regBody("+84 912 345 678", nil))
	if r.code != 201 {
		t.Fatalf("register %d %s", r.code, r.body)
	}
	d := r.json(t)["data"].(map[string]any)
	if !strings.HasPrefix(d["code"].(string), "KH-") || d["zalo_url"] != "https://zalo.me/147468245835855615" || d["expires_at"] == "" || d["product_name"] == "" {
		t.Fatalf("data %v", d)
	}
	if _, ok := d["lead_id"]; ok {
		t.Fatal("không trả lead_id cho trình duyệt")
	}

	cases := []struct {
		body  []byte
		code  int
		ecode string
		field string
	}{
		{regBody("091234567", nil), 400, "validation", "phone"},
		{regBody("0212345678", nil), 400, "validation", "phone"},
		{regBody("0912345678", map[string]any{"full_name": " "}), 400, "validation", "full_name"},
		{regBody("0912345678", map[string]any{"consent": false}), 400, "validation", "consent"},
		{regBody("0912345678", map[string]any{"consent_text": ""}), 400, "validation", "consent"},
		{regBody("0912345678", map[string]any{"product_code": "XX"}), 400, "validation", "product_code"},
		{regBody("0900000400", nil), 400, "validation", ""},
		{regBody("0900000429", nil), 429, "rate_limited", ""},
		{regBody("0900000401", nil), 503, "unavailable", ""},
		{regBody("0900000500", nil), 502, "unavailable", ""},
		{regBody("0900000000", nil), 502, "unavailable", ""},
	}
	for i, c := range cases {
		r := post(c.body)
		e := errOf(r)
		if r.code != c.code || e == nil || e["code"] != c.ecode || (c.field != "" && e["field"] != c.field) || e["message"] == "" {
			t.Fatalf("ca %d: %d %s", i, r.code, r.body)
		}
	}
	if m := errOf(post(regBody("0900000429", nil)))["message"]; m != "Bạn gửi quá nhiều lần, vui lòng thử lại sau 15 phút." {
		t.Fatalf("phải dùng câu của 3RDHub: %v", m)
	}

	// trùng: vẫn là thành công kèm mã
	r = post(regBody("0900000409", nil))
	if r.code != 201 || r.json(t)["data"].(map[string]any)["duplicate"] != true {
		t.Fatalf("duplicate %d %s", r.code, r.body)
	}

	// bẫy bot: thành công giả
	r = post(regBody("0912345678", map[string]any{"website": "spam"}))
	if r.code != 201 {
		t.Fatalf("honeypot %d", r.code)
	}

	// giới hạn theo IP của trang: lần thứ 6 trong 10 phút bị chặn
	for i := 0; i < 5; i++ {
		do(a, "POST", "example.vn", "/api/register", regBody("0912345678", nil), nil)
	}
	if r := do(a, "POST", "example.vn", "/api/register", regBody("0912345678", nil), nil); r.code != 429 || errOf(r)["code"] != "rate_limited" {
		t.Fatalf("giới hạn IP %d %s", r.code, r.body)
	}
}

func TestHubNotConfigured(t *testing.T) {
	a := hubApp(Config{})
	if r := do(a, "GET", "example.vn", "/api/products", nil, nil); r.code != 503 {
		t.Fatalf("chưa cấu hình phải 503: %d", r.code)
	}
	if r := do(a, "POST", "example.vn", "/api/register", regBody("0912345678", nil), nil); r.code != 503 {
		t.Fatalf("chưa cấu hình phải 503: %d", r.code)
	}
}

// Gọi 3RDHub thật qua HTTP: đúng header, đúng body, khoá không lọt ra phản hồi cho trình duyệt.
func TestHubRealHTTP(t *testing.T) {
	const key = "khoa-bi-mat-123"
	var got map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Token "+key || r.Header.Get("Content-Type") != "application/json" {
			w.WriteHeader(401)
			w.Write([]byte(`{"error":{"code":"unauthorized","message":"x"}}`))
			return
		}
		if r.URL.Path == "/api/v1/public/customer-products" {
			w.Write([]byte(`{"data":[{"code":"FE","name":"FE Credit – Vay tiêu dùng","partner":"FE Credit"}]}`))
			return
		}
		json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(201)
		w.Write([]byte(`{"data":{"lead_id":"1","code":"KH-4821","zalo_url":"javascript:alert(1)","expires_at":"2026-11-06T00:00:00Z"}}`))
	}))
	defer srv.Close()
	a := hubApp(Config{HubBase: srv.URL + "/", HubKey: key})
	r := do(a, "POST", "example.vn", "/api/register", regBody("0912 345 678", map[string]any{"ref": "bad ref!"}), nil)
	if r.code != 201 || strings.Contains(string(r.body), key) {
		t.Fatalf("%d %s", r.code, r.body)
	}
	d := r.json(t)["data"].(map[string]any)
	if d["code"] != "KH-4821" || d["zalo_url"] != "" || d["product_name"] != "FE Credit – Vay tiêu dùng" {
		t.Fatalf("data %v", d)
	}
	if got["phone"] != "0912345678" || got["consent"] != true || got["consent_text"] != "Tôi đồng ý ..." || got["ref"] != "" || got["province"] != "Hồ Chí Minh" {
		t.Fatalf("body gửi 3RDHub sai: %v", got)
	}
	if u := got["utm"].(map[string]any); u["source"] != "fb" || u["medium"] != "" {
		t.Fatalf("utm %v", u)
	}
	if _, ok := got["website"]; ok {
		t.Fatal("không gửi ô bẫy bot sang 3RDHub")
	}
	// khoá sai: trình duyệt chỉ thấy lỗi chung
	b := hubApp(Config{HubBase: srv.URL, HubKey: "sai"})
	if r := do(b, "GET", "example.vn", "/api/products", nil, nil); r.code != 502 || strings.Contains(string(r.body), "sai") {
		t.Fatalf("%d %s", r.code, r.body)
	}
}
