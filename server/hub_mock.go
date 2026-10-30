package main

// Bản giả của 3RDHub (bật bằng HUB_MOCK=1) theo đúng hợp đồng API, dùng khi 3RDHub UAT chưa có endpoint.
// Chạy ngay trong tiến trình (không mở cổng mạng). Một số số điện thoại đặc biệt để thử các tình huống lỗi:
//   0900000400 → 400 validation   0900000401 → 401 unauthorized   0900000409 → 409 duplicate (kèm data)
//   0900000429 → 429 rate_limited 0900000500 → 500                0900000000 → mất kết nối

import (
	"crypto/sha1"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"time"
)

type hubMock struct {
	key   string
	prods []hubProduct
}

func newHubMock(key string) *hubMock {
	return &hubMock{key: key, prods: []hubProduct{
		{Code: "FE", Name: "[Thử] FE Credit – Vay tiêu dùng", Partner: "FE Credit"},
		{Code: "VPB-CC", Name: "[Thử] VPBank – Thẻ tín dụng", Partner: "VPBank"},
		{Code: "TNEX", Name: "[Thử] TNEX – Mở tài khoản", Partner: "TNEX"},
	}}
}

type mockTransport struct{ m *hubMock }

func (t mockTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.Method == http.MethodPost {
		var b struct {
			Phone   string `json:"phone"`
			Product string `json:"product_code"`
		}
		if req.Body != nil {
			_ = json.NewDecoder(req.Body).Decode(&b)
			req.Body.Close()
			req.Body = http.NoBody
		}
		if b.Phone == "0900000000" {
			return nil, errors.New("mock: mất kết nối")
		}
		req.Header.Set("X-Mock-Phone", b.Phone)
		req.Header.Set("X-Mock-Product", b.Product)
	}
	rec := httptest.NewRecorder()
	t.m.ServeHTTP(rec, req)
	return rec.Result(), nil
}

func (m *hubMock) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	out := func(code int, v any) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(v)
	}
	er := func(code int, c, msg string) {
		out(code, map[string]any{"error": map[string]string{"code": c, "message": msg}})
	}
	if r.Header.Get("Authorization") != "Token "+m.key {
		er(401, "unauthorized", "Khoá không hợp lệ.")
		return
	}
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/api/v1/public/customer-products":
		out(200, map[string]any{"data": m.prods})
	case r.Method == http.MethodPost && r.URL.Path == "/api/v1/public/customer-leads":
		phone := r.Header.Get("X-Mock-Phone")
		sum := sha1.Sum([]byte(phone))
		data := map[string]string{
			"lead_id":    fmt.Sprintf("mock-%x", sum[:6]),
			"code":       fmt.Sprintf("KH-%04d", (int(sum[0])<<8|int(sum[1]))%10000),
			"zalo_url":   "https://zalo.me/147468245835855615",
			"expires_at": time.Now().Add(7 * 24 * time.Hour).UTC().Truncate(time.Hour).Format(time.RFC3339),
		}
		known := false
		for _, p := range m.prods {
			known = known || p.Code == r.Header.Get("X-Mock-Product")
		}
		if !known {
			er(400, "validation", "Sản phẩm không tồn tại.")
			return
		}
		switch phone {
		case "0900000400":
			er(400, "validation", "Số điện thoại không nằm trong vùng hỗ trợ của sản phẩm này.")
		case "0900000401":
			er(401, "unauthorized", "Khoá không hợp lệ.")
		case "0900000409":
			out(409, map[string]any{"data": data, "error": map[string]string{"code": "duplicate", "message": "Số này vừa đăng ký sản phẩm này."}})
		case "0900000429":
			er(429, "rate_limited", "Bạn gửi quá nhiều lần, vui lòng thử lại sau 15 phút.")
		case "0900000500":
			out(500, map[string]any{})
		default:
			out(201, map[string]any{"data": data})
		}
	default:
		er(404, "not_found", "Không tìm thấy.")
	}
}
