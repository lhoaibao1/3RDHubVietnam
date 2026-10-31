package main

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

func TestSEOFragmentAndSSI(t *testing.T) {
	c := Content{Settings: map[string]string{"seot_san-pham": `A & "B"`, "verify_google": "abc123", "meta_description": "mô tả cũ"}, Faq: []Faq{{Q: Pair{VI: "Hỏi?"}, A: Pair{VI: "Đáp </script>"}}}}
	if f := seoFragment(c, "t", "san-pham", "vi"); !strings.Contains(f, "<title>A &amp; &#34;B&#34;</title>") {
		t.Fatalf("title: %s", f)
	}
	h := Content{Settings: map[string]string{"site_title": "Tên cũ  của web", "meta_description": "dòng 1.\n  dòng 2."}}
	if f := seoFragment(h, "t", "home", "vi"); !strings.Contains(f, "<title>Tên cũ của web</title>") {
		t.Fatalf("trang chủ phải dùng Tiêu đề website khi chưa có tiêu đề riêng: %s", f)
	}
	if f := seoFragment(h, "d", "home", "vi"); !strings.Contains(f, `content="dòng 1. dòng 2."`) {
		t.Fatalf("mô tả phải gộp xuống dòng: %s", f)
	}
	if seoFragment(h, "t", "mo-hinh", "vi") != "" {
		t.Fatal("site_title chỉ áp dụng cho trang chủ")
	}
	if seoFragment(c, "t", "mo-hinh", "vi") != "" || seoFragment(c, "d", "mo-hinh", "vi") != "" {
		t.Fatal("trang chưa sửa phải trả rỗng để dùng bản dựng sẵn")
	}
	if f := seoFragment(c, "d", "home", "vi"); !strings.Contains(f, `content="mô tả cũ"`) {
		t.Fatal("trang chủ dùng meta_description cũ khi chưa có mô tả riêng")
	}
	if f := seoFragment(c, "v", "x", "vi"); f != "<meta name=\"google-site-verification\" content=\"abc123\">\n" {
		t.Fatalf("verify: %q", f)
	}
	if f := seoFragment(c, "l", "hoi-dap", "vi"); !strings.Contains(f, `"FAQPage"`) || strings.Contains(f, "</script>\"") || strings.Count(f, "</script>") != 1 {
		t.Fatalf("faq ld: %s", f)
	}
	page := `<head><!--# block name="st" --><title>Mặc định</title><!--# endblock --><!--# include virtual="/api/seo/t?p=san-pham" stub="st" -->` +
		`<!--# block name="sd" --><meta name="description" content="x"><!--# endblock --><!--# include virtual="/api/seo/d?p=mo-hinh" stub="sd" --></head>`
	out := string(applySSI(c, []byte(page), "vi"))
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

func TestSEOEnglish(t *testing.T) {
	c := Content{Settings: map[string]string{"seot_en_san-pham": "My products", "seot_san-pham": "Sản phẩm của tôi"}}
	if f := seoFragment(c, "t", "san-pham", "en"); !strings.Contains(f, "<title>My products</title>") {
		t.Fatalf("en title: %s", f)
	}
	if f := seoFragment(c, "t", "mo-hinh", "en"); !strings.Contains(f, "How it works") {
		t.Fatalf("en phải có mặc định tiếng Anh dù chưa sửa: %s", f)
	}
	if f := seoFragment(c, "d", "home", "en"); !strings.Contains(f, "affiliate marketing platform") || strings.Contains(f, "tiếp thị") {
		t.Fatalf("en desc: %s", f)
	}
	if f := seoFragment(c, "c", "san-pham", "en"); !strings.Contains(f, `href="https://3rdhubvietnam.tech/en/san-pham"`) || !strings.Contains(f, "en_US") {
		t.Fatalf("canonical en: %s", f)
	}
	if seoFragment(c, "c", "san-pham", "vi") != "" {
		t.Fatal("vi dùng khối dựng sẵn")
	}
	page := `<!--# block name="st" --><title>VI</title><!--# endblock --><!--# include virtual="/api/seo/t?p=san-pham&l=$rh_lg" stub="st" -->`
	if out := string(applySSI(c, []byte(page), "en")); !strings.Contains(out, "My products") {
		t.Fatalf("ssi en: %s", out)
	}
	if out := string(applySSI(Content{}, []byte(page), "vi")); !strings.Contains(out, "<title>VI</title>") {
		t.Fatalf("ssi vi: %s", out)
	}
	for p := range seoDef {
		if seoDef[p].TitleEN == "" || seoDef[p].DescEN == "" {
			t.Fatalf("thiếu mặc định tiếng Anh: %s", p)
		}
	}
}

func TestSEODefaultsInSync(t *testing.T) {
	b, err := os.ReadFile("../web/scripts/seo.json")
	if err != nil {
		t.Skip("không có web/scripts")
	}
	if !bytes.Equal(b, seoDefaultsJSON) {
		t.Fatal("server/seed/seo.json phải giống web/scripts/seo.json (chạy: cp web/scripts/seo.json server/seed/seo.json)")
	}
}
