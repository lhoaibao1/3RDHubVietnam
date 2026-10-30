package main

import (
	"strings"
	"testing"
)

func TestSEOFragmentAndSSI(t *testing.T) {
	c := Content{Settings: map[string]string{"seot_san-pham": `A & "B"`, "verify_google": "abc123", "meta_description": "mô tả cũ"}, Faq: []Faq{{Q: Pair{VI: "Hỏi?"}, A: Pair{VI: "Đáp </script>"}}}}
	if f := seoFragment(c, "t", "san-pham"); !strings.Contains(f, "<title>A &amp; &#34;B&#34;</title>") {
		t.Fatalf("title: %s", f)
	}
	if seoFragment(c, "t", "mo-hinh") != "" || seoFragment(c, "d", "mo-hinh") != "" {
		t.Fatal("trang chưa sửa phải trả rỗng để dùng bản dựng sẵn")
	}
	if f := seoFragment(c, "d", "home"); !strings.Contains(f, `content="mô tả cũ"`) {
		t.Fatal("trang chủ dùng meta_description cũ khi chưa có mô tả riêng")
	}
	if f := seoFragment(c, "v", "x"); f != "<meta name=\"google-site-verification\" content=\"abc123\">\n" {
		t.Fatalf("verify: %q", f)
	}
	if f := seoFragment(c, "l", "hoi-dap"); !strings.Contains(f, `"FAQPage"`) || strings.Contains(f, "</script>\"") || strings.Count(f, "</script>") != 1 {
		t.Fatalf("faq ld: %s", f)
	}
	page := `<head><!--# block name="st" --><title>Mặc định</title><!--# endblock --><!--# include virtual="/api/seo/t?p=san-pham" stub="st" -->` +
		`<!--# block name="sd" --><meta name="description" content="x"><!--# endblock --><!--# include virtual="/api/seo/d?p=mo-hinh" stub="sd" --></head>`
	out := string(applySSI(c, []byte(page)))
	if strings.Contains(out, "<!--#") || strings.Contains(out, "Mặc định") || !strings.Contains(out, `<meta name="description" content="x">`) {
		t.Fatalf("ssi: %s", out)
	}
}

func TestCleanVerify(t *testing.T) {
	for in, want := range map[string]string{
		`<meta name="google-site-verification" content="Ab_C-1" />`: "Ab_C-1",
		"xyz123": "xyz123",
		`<meta name='msvalidate.01' content='0FA1B2'>`: "0FA1B2",
	} {
		if got, ok := cleanVerify(in); !ok || got != want {
			t.Fatalf("%s → %q %v", in, got, ok)
		}
	}
	if _, ok := cleanVerify(`"><script>`); ok {
		t.Fatal("mã có ký tự lạ phải bị từ chối")
	}
}
