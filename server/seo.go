package main

import (
	"context"
	_ "embed"
	"encoding/json"
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

//go:embed seed/seo.json
var seoDefaultsJSON []byte

// seoDef là tiêu đề/mô tả mặc định từng trang (cùng file web/scripts/seo.json), có cả bản tiếng Anh.
// seoSite là địa chỉ gốc của website (SITE_URL nếu có), dùng cho đường dẫn chuẩn.
var seoSite string

var seoDef = func() map[string]struct{ Title, Desc, TitleEN, DescEN string } {
	var f struct {
		Site  string `json:"site"`
		Pages map[string]struct {
			Title   string `json:"title"`
			Desc    string `json:"desc"`
			TitleEN string `json:"title_en"`
			DescEN  string `json:"desc_en"`
		} `json:"pages"`
	}
	_ = json.Unmarshal(seoDefaultsJSON, &f)
	seoSite = f.Site
	m := map[string]struct{ Title, Desc, TitleEN, DescEN string }{}
	for slug, p := range f.Pages {
		if slug == "" {
			slug = "home"
		}
		m[slug] = struct{ Title, Desc, TitleEN, DescEN string }{p.Title, p.Desc, p.TitleEN, p.DescEN}
	}
	return m
}()

func init() {
	for _, v := range verifyMetas {
		settingKeys = append(settingKeys, v.key)
	}
	for _, p := range seoPages {
		settingKeys = append(settingKeys, "seot_"+p, "seod_"+p, "seot_en_"+p, "seod_en_"+p)
		settingMax["seot_"+p], settingMax["seot_en_"+p] = 120, 120
		settingMax["seod_"+p], settingMax["seod_en_"+p] = 320, 320
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
func seoFragment(c Content, kind, page, lang string) string {
	e := html.EscapeString
	s := c.Settings
	en := lang == "en"
	switch kind {
	case "c":
		// địa chỉ chuẩn theo ngôn ngữ của URL đang mở (bản dựng sẵn mặc định là /vi)
		if !en || !seoPageRe.MatchString(page) {
			return ""
		}
		u := strings.TrimRight(seoSite, "/") + "/en"
		if page != "home" {
			u += "/" + page
		}
		return "<link rel=\"canonical\" href=\"" + e(u) + "\">\n<meta property=\"og:url\" content=\"" + e(u) + "\">\n<meta property=\"og:locale\" content=\"en_US\">\n<meta property=\"og:locale:alternate\" content=\"vi_VN\">"
	case "t":
		t := s["seot_"+page]
		if en {
			if t = s["seot_en_"+page]; t == "" {
				t = seoDef[page].TitleEN
			}
		}
		if t == "" && page == "home" && !en {
			t = s["site_title"] // ô "Tiêu đề website" cũ áp dụng cho trang chủ khi chưa có tiêu đề riêng
		}
		if t = strings.Join(strings.Fields(t), " "); t != "" {
			return "<title>" + e(t) + "</title>\n<meta property=\"og:title\" content=\"" + e(t) + "\">\n<meta name=\"twitter:title\" content=\"" + e(t) + "\">"
		}
	case "d":
		d := s["seod_"+page]
		if en {
			if d = s["seod_en_"+page]; d == "" {
				d = seoDef[page].DescEN
			}
		} else if d == "" && page == "home" {
			d = s["meta_description"] // ô "Mô tả website" cũ áp dụng cho trang chủ
		}
		if d = strings.Join(strings.Fields(d), " "); d != "" { // gộp xuống dòng/khoảng trắng thừa
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
			q := func(p Pair) string {
				if en && p.EN != "" {
					return p.EN
				}
				return p.VI
			}
			items := make([]map[string]any, 0, len(c.Faq))
			for _, f := range c.Faq {
				if q(f.Q) == "" || q(f.A) == "" {
					continue
				}
				items = append(items, map[string]any{"@type": "Question", "name": q(f.Q), "acceptedAnswer": map[string]any{"@type": "Answer", "text": q(f.A)}})
			}
			ld := jsonBytes(map[string]any{"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": map[bool]string{true: "en", false: "vi"}[en], "mainEntity": items})
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
	a.send(w, r, 200, []byte(seoFragment(c, kind, page, r.URL.Query().Get("l"))), "text/html; charset=utf-8", noStore)
}

var (
	ssiBlockRe   = regexp.MustCompile(`(?s)<!--# block name="([a-z0-9]+)" -->(.*?)<!--# endblock -->`)
	ssiIncludeRe = regexp.MustCompile(`<!--# include virtual="/api/seo/([a-z])\?p=([a-z0-9-]+)(?:&l=\$rh_lg)?" stub="([a-z0-9]+)" -->`)
)

// applySSI làm thay nginx khi backend tự phục vụ site (chạy thử cục bộ): xử lý đúng các lệnh SSI do prerender sinh ra.
func applySSI(c Content, page []byte, lang string) []byte {
	stubs := map[string]string{}
	out := ssiBlockRe.ReplaceAllStringFunc(string(page), func(m string) string {
		sm := ssiBlockRe.FindStringSubmatch(m)
		stubs[sm[1]] = sm[2]
		return ""
	})
	out = ssiIncludeRe.ReplaceAllStringFunc(out, func(m string) string {
		sm := ssiIncludeRe.FindStringSubmatch(m)
		if f := seoFragment(c, sm[1], sm[2], lang); f != "" {
			return f
		}
		return stubs[sm[3]]
	})
	return []byte(out)
}

// translateSEO tự dịch tiêu đề/mô tả SEO từ tiếng Việt sang tiếng Anh khi lưu: chỉ khi ô English còn trống, hoặc đang là bản máy dịch
// mà tiếng Việt đã đổi. Người dùng tự sửa bản English thì giữ nguyên.
func (a *App) translateSEO(ctx context.Context, c *Content, prev Content) {
	if a.tr == nil || a.tr.off {
		return
	}
	for _, p := range seoPages {
		for _, k := range []string{"seot_", "seod_"} {
			vi := strings.TrimSpace(c.Settings[k+p])
			if vi == "" {
				continue
			}
			en := strings.TrimSpace(c.Settings[k+"en_"+p])
			pvi := strings.TrimSpace(prev.Settings[k+p])
			if en != "" {
				if pvi == vi {
					continue // tiếng Việt không đổi
				}
				// tiếng Việt đã đổi: chỉ dịch lại nếu bản English cũ do máy dịch (còn trong bộ nhớ đệm)
				if old, err := a.translateOne(ctx, pvi); pvi == "" || err != nil || strings.TrimSpace(old) != en {
					continue
				}
			}
			if t, err := a.translateOne(ctx, vi); err == nil && t != "" {
				max := settingMax[k+"en_"+p]
				if r := []rune(t); len(r) > max {
					t = string(r[:max])
				}
				c.Settings[k+"en_"+p] = t
			}
		}
	}
}
