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
	if n := len(shots()); n != 13 {
		t.Fatalf("mặc định phải có 13 ảnh: %d", n)
	}
	put := func(product string) resp {
		return do(a, "PUT", cms, "/api/admin/content", []byte(`{"content":{"product":`+product+`}}`), h)
	}
	// lưu sản phẩm mà không gửi shots (CMS cũ): giữ bộ mặc định
	if r := put(`{"modules":[]}`); r.code != 200 || len(shots()) != 13 {
		t.Fatalf("thiếu shots phải giữ mặc định: %d %s", r.code, r.body)
	}
	// bộ 10 ảnh mặc định cũ đã lưu trên máy chủ: tự chuyển sang bộ mới
	old := []string{}
	for _, id := range strings.Split(oldShotIDs, ",") {
		old = append(old, `{"id":"`+id+`","img":"/hub/`+id+`.webp","label":{"vi":"`+id+`"}}`)
	}
	if r := put(`{"shots":[` + strings.Join(old, ",") + `]}`); r.code != 200 || len(shots()) != 13 || shots()[5].(map[string]any)["img"] != "/hub/order-list.webp" {
		t.Fatalf("nâng cấp bộ ảnh cũ: %d %v", r.code, shots())
	}
	// danh sách đã chỉnh có ảnh đổi tên: trỏ sang tên mới
	if r := put(`{"shots":[{"id":"x","img":"/hub/orders.webp","label":{"vi":"Đơn"}}]}`); r.code != 200 || shots()[0].(map[string]any)["img"] != "/hub/order-list.webp" {
		t.Fatalf("đổi tên ảnh: %v", shots())
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

// PDF các chính sách: đủ 8 trang + bản tổng hợp, tiếng Việt và tiếng Anh, theo nội dung CMS.
func TestLegalPDF(t *testing.T) {
	a := testApp(t)
	for _, d := range legalDocs {
		for _, q := range []string{"", "?lang=en"} {
			r := do(a, "GET", "3rdhubvietnam.tech", "/api/legal/"+d.Key+".pdf"+q, nil, nil)
			if r.code != 200 || r.hdr.Get("Content-Type") != "application/pdf" || !strings.HasPrefix(string(r.body), "%PDF-") || !strings.Contains(r.hdr.Get("Content-Disposition"), d.Slug) {
				t.Fatalf("%s%s: %d %s", d.Key, q, r.code, r.hdr)
			}
		}
	}
	all := do(a, "GET", "3rdhubvietnam.tech", "/api/legal/all.pdf", nil, nil)
	if all.code != 200 || len(all.body) < 20000 {
		t.Fatalf("all: %d %d", all.code, len(all.body))
	}
	if r := do(a, "GET", "3rdhubvietnam.tech", "/api/legal/khac.pdf", nil, nil); r.code != 404 {
		t.Fatalf("khoá lạ: %d", r.code)
	}
	// nội dung: thay mã công ty, bảng giá đầy đủ VNĐ
	c, _, _ := a.currentContent(t.Context())
	_, _, body := a.legalText(c, "pricing", "vi")
	if !strings.Contains(body, "15tr (15.000.000 VNĐ)") || strings.Contains(body, "{{") || !strings.Contains(body, "Công ty TNHH Công nghệ 3RDVN") {
		t.Fatalf("pricing: %s", body[:400])
	}
	_, _, en := a.legalText(c, "support", "en")
	if !strings.Contains(en, "3RDVN Technology Co., Ltd") || strings.Contains(en, "{{") {
		t.Fatalf("support en: %s", en[:300])
	}
	// CMS sửa chính sách mới là PDF đổi theo
	ck := login(t, a)
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	doc := `{"legal":{"refund":{"title":{"vi":"Hoàn tiền (sửa)"},"updated":{"vi":"01/11/2026"},"body":{"vi":"## 1. Mục mới\nNội dung mới."}}}}`
	if r := do(a, "PUT", cms, "/api/admin/content", []byte(`{"content":`+doc+`}`), h); r.code != 200 {
		t.Fatalf("lưu: %d %s", r.code, r.body)
	}
	c, _, _ = a.currentContent(t.Context())
	if tt, up, b := a.legalText(c, "refund", "vi"); tt != "Hoàn tiền (sửa)" || up != "01/11/2026" || !strings.Contains(b, "Nội dung mới") {
		t.Fatalf("sau khi sửa: %s %s %s", tt, up, b)
	}
}

// Danh sách ảnh đã chỉnh còn 7 ảnh (đã gỡ Chiến dịch, Đơn hàng, Thành viên): khởi động lại thì được bổ sung một lần.
func TestShotsUpgradeOnStart(t *testing.T) {
	a := testApp(t)
	keep := []string{"dashboard", "tracking", "clicks", "access", "settings", "advertisers", "apidocs"}
	var saved []Shot
	for _, id := range keep {
		saved = append(saved, Shot{ID: id, Img: "/hub/" + id + ".webp", Label: Pair{VI: "Tên riêng " + id}})
	}
	saved = append(saved, Shot{ID: "u1", Img: "/uploads/x.webp", Label: Pair{VI: "Ảnh tự tải"}})
	c, _, _ := a.currentContent(t.Context())
	c.Product.Shots = saved
	if err := a.saveContent(t.Context(), c, "thử"); err != nil {
		t.Fatal(err)
	}
	pool := a.pool
	pool.Exec(t.Context(), `DELETE FROM kv WHERE key='shots_v2'`)
	if err := a.initData(t.Context()); err != nil {
		t.Fatal(err)
	}
	c, _, _ = a.currentContent(t.Context())
	var ids []string
	for _, x := range c.Product.Shots {
		ids = append(ids, x.ID)
	}
	want := "dashboard,campaign-list,campaign-detail,campaign-new,tracking,order-list,order-leads,clicks,team-members,access,settings,advertisers,apidocs,u1"
	if strings.Join(ids, ",") != want || c.Product.Shots[0].Label.VI != "Tên riêng dashboard" {
		t.Fatalf("sau nâng cấp: %s", strings.Join(ids, ","))
	}
	// chỉ chạy một lần: gỡ lại thì không tự thêm nữa
	c.Product.Shots = saved
	a.saveContent(t.Context(), c, "gỡ lại")
	a.initData(t.Context())
	c, _, _ = a.currentContent(t.Context())
	if len(c.Product.Shots) != len(saved) {
		t.Fatalf("không được thêm lần hai: %d", len(c.Product.Shots))
	}
}
