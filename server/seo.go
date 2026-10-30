package main

import (
	"html"
	"net/http"
	"regexp"
	"strings"
)

// SEO sửa trong CMS (tab SEO): tiêu đề/mô tả riêng từng trang, mã xác minh Google/Bing/Cốc Cốc/Facebook/Zalo.
// Trang HTML dựng sẵn (web/scripts/prerender.mjs) có các khối mặc định kèm lệnh SSI của nginx:
//   <!--# block name="st" -->...thẻ mặc định...<!--# endblock --><!--# include virtual="/api/seo/t?p=san-pham" stub="st" -->
// nginx gọi /api/seo/<loại>; trả rỗng (chưa sửa trong CMS) hoặc backend lỗi thì nginx dùng khối mặc định,
// nên website vẫn chạy bình thường khi backend tạm dừng.

// seoPages khớp với các trang trong web/scripts/seo.json ("" là trang chủ = "home").
var seoPages = []string{"home", "mo-hinh", "advertiser", "san-pham", "cong-nghe", "doi-tac", "hoi-dap", "lien-he", "baogia", "dang-ky",
	"chinh-sach", "dieu-khoan", "bao-mat", "khieu-nai", "chinh-sach-gia", "chinh-sach-thanh-toan", "dieu-kien-dich-vu", "cung-cap-va-hoan-tien", "ho-tro"}

// Mã xác minh website: khoá cài đặt → tên thẻ meta.
var verifyMetas = []struct{ key, name string }{
	{"verify_google", "google-site-verification"},
	{"verify_bing", "msvalidate.01"},
	{"verify_coccoc", "coccoc-verification"},
	{"verify_facebook", "facebook-domain-verification"},
	{"verify_zalo", "zalo-platform-site-verification"},
}

var (
	verifyRe      = regexp.MustCompile(`^[A-Za-z0-9_+/=.:-]{4,200}$`)
	metaContentRe = regexp.MustCompile(`content\s*=\s*["']([^"']*)["']`)
	seoPageRe     = regexp.MustCompile(`^[a-z0-9-]{1,40}$`)
)

func init() {
	for _, v := range verifyMetas {
		settingKeys = append(settingKeys, v.key)
	}
	for _, p := range seoPages {
		settingKeys = append(settingKeys, "seot_"+p, "seod_"+p)
		settingMax["seot_"+p] = 120
		settingMax["seod_"+p] = 320
	}
}

// cleanVerify nhận cả mã trần lẫn nguyên thẻ <meta ... content="..."> người dùng dán từ Google/Bing.
func cleanVerify(v string) (string, bool) {
	if m := metaContentRe.FindStringSubmatch(v); m != nil {
		v = strings.TrimSpace(m[1])
	}
	return v, verifyRe.MatchString(v)
}

// seoFragment trả về đoạn HTML thay cho khối mặc định; "" nghĩa là dùng khối mặc định.
func seoFragment(c Content, kind, page string) string {
	e := html.EscapeString
	s := c.Settings
	switch kind {
	case "t":
		if t := s["seot_"+page]; t != "" {
			return "<title>" + e(t) + "</title>\n<meta property=\"og:title\" content=\"" + e(t) + "\">\n<meta name=\"twitter:title\" content=\"" + e(t) + "\">"
		}
	case "d":
		d := s["seod_"+page]
		if d == "" && page == "home" {
			d = s["meta_description"] // ô "Mô tả website" cũ áp dụng cho trang chủ
		}
		if d != "" {
			return "<meta name=\"description\" content=\"" + e(d) + "\">\n<meta property=\"og:description\" content=\"" + e(d) + "\">\n<meta name=\"twitter:description\" content=\"" + e(d) + "\">"
		}
	case "v":
		var b strings.Builder
		for _, v := range verifyMetas {
			if code := s[v.key]; code != "" {
				b.WriteString("<meta name=\"" + v.name + "\" content=\"" + e(code) + "\">\n")
			}
		}
		return b.String()
	case "l":
		// dữ liệu có cấu trúc lấy theo nội dung hiện tại (Google yêu cầu khớp với chữ trên trang)
		if page == "hoi-dap" && len(c.Faq) > 0 {
			items := make([]map[string]any, 0, len(c.Faq))
			for _, f := range c.Faq {
				if f.Q.VI == "" || f.A.VI == "" {
					continue
				}
				items = append(items, map[string]any{"@type": "Question", "name": f.Q.VI, "acceptedAnswer": map[string]any{"@type": "Answer", "text": f.A.VI}})
			}
			ld := jsonBytes(map[string]any{"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": "vi", "mainEntity": items})
			// chặn "</script>" trong nội dung làm vỡ thẻ
			return "<script type=\"application/ld+json\">" + strings.ReplaceAll(string(ld), "</", "<\\/") + "</script>"
		}
	}
	return ""
}

func (a *App) apiSEO(w http.ResponseWriter, r *http.Request, kind string) {
	page := r.URL.Query().Get("p")
	if !seoPageRe.MatchString(page) {
		a.send(w, r, 200, nil, "text/html; charset=utf-8", noStore)
		return
	}
	c, _, err := a.currentContent(r.Context())
	if err != nil {
		// lỗi CSDL: trả rỗng để nginx dùng khối mặc định thay vì làm hỏng trang
		a.send(w, r, 200, nil, "text/html; charset=utf-8", noStore)
		return
	}
	a.send(w, r, 200, []byte(seoFragment(c, kind, page)), "text/html; charset=utf-8", noStore)
}

var (
	ssiBlockRe   = regexp.MustCompile(`(?s)<!--# block name="([a-z0-9]+)" -->(.*?)<!--# endblock -->`)
	ssiIncludeRe = regexp.MustCompile(`<!--# include virtual="/api/seo/([a-z])\?p=([a-z0-9-]+)" stub="([a-z0-9]+)" -->`)
)

// applySSI làm thay nginx khi backend tự phục vụ site (chạy thử cục bộ): xử lý đúng các lệnh SSI do prerender sinh ra.
func applySSI(c Content, page []byte) []byte {
	stubs := map[string]string{}
	out := ssiBlockRe.ReplaceAllStringFunc(string(page), func(m string) string {
		sm := ssiBlockRe.FindStringSubmatch(m)
		stubs[sm[1]] = sm[2]
		return ""
	})
	out = ssiIncludeRe.ReplaceAllStringFunc(out, func(m string) string {
		sm := ssiIncludeRe.FindStringSubmatch(m)
		if f := seoFragment(c, sm[1], sm[2]); f != "" {
			return f
		}
		return stubs[sm[3]]
	})
	return []byte(out)
}
