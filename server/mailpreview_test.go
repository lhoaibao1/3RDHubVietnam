package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

// MAIL_PREVIEW_DIR=/đường/dẫn go test -run MailPreview: ghi các thư mẫu ra file HTML để xem bằng trình duyệt.
func TestMailPreview(t *testing.T) {
	dir := os.Getenv("MAIL_PREVIEW_DIR")
	if dir == "" {
		t.Skip("đặt MAIL_PREVIEW_DIR để xuất thư mẫu")
	}
	b := brand{Company: "Công ty TNHH Công nghệ 3RDVN", Address: "Tổ 10 Tỉnh Thủy, Phường Quảng Phú, Thành phố Đà Nẵng", Hotline: "(+84) 398 192 414", Tel: "+84398192414", Email: "hello@3rdhubvietnam.tech", Site: "http://127.0.0.1:8787", Parent: "https://3rdvn.io.vn", Logo: "http://127.0.0.1:8787/icon-192.png"}
	l := leadRow{ID: 128, TS: time.Now().Unix(), Name: "Nguyễn Văn An", Phone: "0901 234 567", Email: "an.nguyen@congty.vn", Company: "Công ty CP Thương mại Minh Phát", Need: "Hệ thống affiliate riêng", Message: "Chúng tôi cần triển khai hệ thống tiếp thị liên kết cho 3 sản phẩm tài chính, dự kiến 200 publisher. Mong được tư vấn và gửi báo giá.", Lang: "vi"}
	_, _, staff := staffMail(b, l, "https://cms.3rdhubvietnam.tech")
	_, _, cust := customerMail(b, l)
	l.Lang = "en"
	_, _, custEN := customerMail(b, l)
	for n, h := range map[string]string{"staff": staff, "customer": cust, "customer_en": custEN} {
		if err := os.WriteFile(filepath.Join(dir, n+".html"), []byte(h), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}
