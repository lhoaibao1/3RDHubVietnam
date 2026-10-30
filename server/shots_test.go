package main

import (
	"strings"
	"testing"
)

// Ảnh giao diện ở trang Sản phẩm: chưa sửa thì dùng bộ mặc định; gỡ bớt, gỡ hết (ẩn khu ảnh), ảnh không hợp lệ bị chặn.
func TestProductShots(t *testing.T) {
	a := testApp(t)
	srv, _ := fakeTranslate(t)
	a.tr = &translator{client: srv.Client(), url: srv.URL}
	ck := login(t, a)
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	shots := func() []any {
		p := do(a, "GET", "example.vn", "/api/content", nil, nil).json(t)["product"].(map[string]any)
		s, _ := p["shots"].([]any)
		return s
	}
	if n := len(shots()); n != 10 {
		t.Fatalf("mặc định phải có 10 ảnh: %d", n)
	}
	put := func(product string) resp {
		return do(a, "PUT", cms, "/api/admin/content", []byte(`{"content":{"product":`+product+`}}`), h)
	}
	// lưu sản phẩm mà không gửi shots (CMS cũ): giữ bộ mặc định
	if r := put(`{"modules":[]}`); r.code != 200 || len(shots()) != 10 {
		t.Fatalf("thiếu shots phải giữ mặc định: %d %s", r.code, r.body)
	}
	// gỡ bớt, đổi tên, thêm ảnh tải lên; nhãn tự dịch
	r := put(`{"shots":[{"id":"orders","img":"/hub/orders.webp","label":{"vi":"Đơn hàng mới"}},{"id":"x1","img":"/uploads/abc123.webp","label":{"vi":"Báo cáo"}}]}`)
	if r.code != 200 {
		t.Fatalf("lưu %d %s", r.code, r.body)
	}
	s := shots()
	if len(s) != 2 || s[1].(map[string]any)["img"] != "/uploads/abc123.webp" || !strings.HasPrefix(s[0].(map[string]any)["label"].(map[string]any)["en"].(string), "EN: ") {
		t.Fatalf("sau khi sửa: %v", s)
	}
	// gỡ hết: khu ảnh ẩn (không quay lại bộ mặc định)
	if r := put(`{"shots":[]}`); r.code != 200 || len(shots()) != 0 {
		t.Fatalf("gỡ hết: %d %v", r.code, shots())
	}
	if p := do(a, "GET", "example.vn", "/api/content", nil, nil); !strings.Contains(string(p.body), `"shots":[]`) {
		t.Fatalf("phải trả mảng rỗng: %s", p.body)
	}
	// ảnh ngoài /hub/ và /uploads/ bị chặn
	for _, img := range []string{"https://evil.example/x.png", "/hub/../admin.webp", "javascript:alert(1)", ""} {
		if r := put(`{"shots":[{"id":"z","img":"` + img + `","label":{"vi":"x"}}]}`); r.code != 400 {
			t.Fatalf("ảnh %q phải bị chặn: %d", img, r.code)
		}
	}
}
