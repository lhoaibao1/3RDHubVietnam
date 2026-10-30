package main

// Xuất các trang chính sách (Điều khoản, Bảo mật, Giá, Thanh toán...) ra PDF từ đúng nội dung đang hiện trên website
// (sửa trong CMS là PDF đổi theo). Dùng cho hồ sơ thông báo website với Bộ Công Thương.
// GET /api/legal/<khoá>.pdf?lang=vi|en, hoặc /api/legal/all.pdf để tải tất cả trong một file.

import (
	"bytes"
	"embed"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-pdf/fpdf"
)

//go:embed seed/fonts/*.ttf
var fontFS embed.FS

// legalDocs: thứ tự và đường dẫn trên website của từng chính sách (khớp với web/src/lib/content.ts LEGAL_DOCS).
var legalDocs = []struct{ Key, Slug string }{
	{"privacy", "bao-mat"}, {"complaints", "khieu-nai"}, {"pricing", "chinh-sach-gia"}, {"payment", "chinh-sach-thanh-toan"},
	{"service", "dieu-kien-dich-vu"}, {"refund", "cung-cap-va-hoan-tien"}, {"support", "ho-tro"}, {"terms", "dieu-khoan"},
}

var (
	legalPDFRe = regexp.MustCompile(`^/api/legal/([a-z]+)\.pdf$`)
	tokenRe    = regexp.MustCompile(`\{\{\s*([a-z_]+)\s*\}\}`)
	inlineRe   = regexp.MustCompile(`\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)`)
)

// defaultsEN: bản tiếng Anh mặc định của tên công ty, địa chỉ (giống DEF_SETTINGS phía website).
var defaultsEN = map[string]string{"company_name": "3RDVN Technology Co., Ltd", "address": "Group 10 Tinh Thuy, Quang Phu Ward, Da Nang City, Vietnam"}

// legalText trả tiêu đề, ngày cập nhật, nội dung (đã thay mã) của một chính sách theo ngôn ngữ; bản CMS trống thì lấy mặc định.
func (a *App) legalText(c Content, key, lang string) (title, updated, body string) {
	cur, def := c.Legal[key], a.defaults.Legal[key]
	pick := func(cp, dp Pair) string {
		for _, v := range []string{map[bool]string{true: cp.EN, false: cp.VI}[lang == "en"], map[bool]string{true: dp.EN, false: dp.VI}[lang == "en"], cp.VI, dp.VI} {
			if strings.TrimSpace(v) != "" {
				return v
			}
		}
		return ""
	}
	title, updated, body = pick(cur.Title, def.Title), pick(cur.Updated, def.Updated), pick(cur.Body, def.Body)
	return title, updated, a.fillLegal(c, body, lang)
}

func (a *App) setting(c Content, k, lang string) string {
	get := func(k string) string {
		if v := c.Settings[k]; v != "" {
			return v
		}
		return a.defaults.Settings[k]
	}
	if lang == "en" {
		if v := c.Settings[k+"_en"]; v != "" {
			return v
		}
		if v := c.Settings[k]; v != "" && v != a.defaults.Settings[k] {
			return v
		}
		if v := defaultsEN[k]; v != "" {
			return v
		}
	}
	return get(k)
}

// priceList là danh sách gói hiện hành (mã {{price_list}} trong Chính sách giá), giống trang Báo giá.
func priceList(c Content, d *Defaults, lang string) string {
	plans := c.Quote.Plans
	if len(plans) == 0 {
		plans = d.Quote.Plans
	}
	pk := func(p Pair) string {
		if lang == "en" && p.EN != "" {
			return p.EN
		}
		return p.VI
	}
	var b strings.Builder
	for _, p := range plans {
		fmt.Fprintf(&b, "- **%s: %s** %s. %s\n", pk(p.Name), fullPrice(pk(p.Price), lang), pk(p.Unit), strings.TrimSuffix(pk(p.Desc), "."))
	}
	return strings.TrimRight(b.String(), "\n")
}

var trieuRe = regexp.MustCompile(`(?i)^\s*(\d+(?:[.,]\d+)?)\s*(tr|triệu|m)\s*$`)

// fullPrice ghi thêm số tiền đầy đủ cho giá viết tắt: "15tr" -> "15tr (15.000.000 VNĐ)".
func fullPrice(p, lang string) string {
	m := trieuRe.FindStringSubmatch(p)
	if m == nil {
		return p
	}
	var n float64
	fmt.Sscanf(strings.ReplaceAll(m[1], ",", "."), "%g", &n)
	v := int64(n*1e6 + 0.5)
	s := fmt.Sprint(v)
	sep, cur := ".", " VNĐ"
	if lang == "en" {
		sep, cur = ",", " VND"
	}
	var out []byte
	for i := range s {
		if i > 0 && (len(s)-i)%3 == 0 {
			out = append(out, sep...)
		}
		out = append(out, s[i])
	}
	return p + " (" + string(out) + cur + ")"
}

func (a *App) fillLegal(c Content, body, lang string) string {
	body = strings.ReplaceAll(body, "{{price_list}}", priceList(c, &a.defaults, lang))
	return tokenRe.ReplaceAllStringFunc(body, func(m string) string {
		k := tokenRe.FindStringSubmatch(m)[1]
		if v := a.setting(c, k, lang); v != "" {
			return v
		}
		return m
	})
}

/* ---------------- vẽ PDF ---------------- */

type legalPDF struct {
	*fpdf.Fpdf
	site string
	lang string
}

func newLegalPDF(site, lang, company string) (*legalPDF, error) {
	f := fpdf.New("P", "mm", "A4", "")
	for _, x := range [][2]string{{"", "Regular"}, {"B", "Bold"}, {"S", "SemiBold"}} {
		b, err := fontFS.ReadFile("seed/fonts/BeVietnamPro-" + x[1] + ".ttf")
		if err != nil {
			return nil, err
		}
		name := "bvp"
		if x[0] == "S" {
			name = "bvps"
			x[0] = ""
		}
		f.AddUTF8FontFromBytes(name, x[0], b)
	}
	f.SetMargins(20, 22, 20)
	f.SetAutoPageBreak(true, 20)
	f.AliasNbPages("{nb}")
	f.SetCreator("3RDHub Vietnam", true)
	f.SetAuthor(company, true)
	p := &legalPDF{Fpdf: f, site: site, lang: lang}
	f.SetFooterFunc(func() {
		f.SetY(-13)
		f.SetFont("bvp", "", 8)
		f.SetTextColor(120, 128, 150)
		f.CellFormat(0, 5, company+" · "+strings.TrimPrefix(strings.TrimPrefix(site, "https://"), "http://"), "", 0, "L", false, 0, "")
		pg := "Trang %d/{nb}"
		if lang == "en" {
			pg = "Page %d/{nb}"
		}
		f.SetX(20)
		f.CellFormat(0, 5, fmt.Sprintf(pg, f.PageNo()), "", 0, "R", false, 0, "")
	})
	return p, f.Error()
}

var ink = [3]int{11, 42, 111}
var ink2 = [3]int{60, 66, 88}
var orange = [3]int{230, 90, 30}

func (p *legalPDF) color(c [3]int) { p.SetTextColor(c[0], c[1], c[2]) }

// inline viết một dòng có **đậm** và [liên kết](url); xuống dòng tự động theo lề trái hiện tại.
func (p *legalPDF) inline(text string, size, lh float64, style string) {
	pos := 0
	for _, m := range inlineRe.FindAllStringSubmatchIndex(text, -1) {
		if m[0] > pos {
			p.SetFont("bvp", style, size)
			p.Write(lh, text[pos:m[0]])
		}
		if m[2] >= 0 {
			p.SetFont("bvp", "B", size)
			p.Write(lh, text[m[2]:m[3]])
		} else {
			label, href := text[m[4]:m[5]], text[m[6]:m[7]]
			if strings.HasPrefix(href, "/") {
				href = p.site + href
			}
			p.SetFont("bvp", style, size)
			p.color(orange)
			p.WriteLinkString(lh, label, href)
			p.color(ink2)
		}
		pos = m[1]
	}
	if pos < len(text) {
		p.SetFont("bvp", style, size)
		p.Write(lh, text[pos:])
	}
}

// doc vẽ một chính sách bắt đầu ở trang mới.
func (p *legalPDF) doc(company, title, updated, body, url string) {
	p.AddPage()
	p.SetFont("bvp", "B", 9)
	p.color(orange)
	p.CellFormat(0, 5, strings.ToUpper(company), "", 1, "L", false, 0, "")
	p.Ln(2)
	p.SetFont("bvp", "B", 20)
	p.color(ink)
	p.MultiCell(0, 9, title, "", "L", false)
	p.Ln(1)
	p.SetFont("bvp", "", 9.5)
	p.color(ink2)
	lbl := "Cập nhật lần cuối: "
	if p.lang == "en" {
		lbl = "Last updated: "
	}
	p.Write(5, lbl+updated+" · ")
	p.color(orange)
	p.WriteLinkString(5, strings.TrimPrefix(strings.TrimPrefix(url, "https://"), "http://"), url)
	p.Ln(7)
	p.SetDrawColor(228, 224, 216)
	p.Line(20, p.GetY(), 190, p.GetY())
	p.Ln(5)
	para := false
	for _, raw := range strings.Split(strings.ReplaceAll(body, "\r", ""), "\n") {
		l := strings.TrimSpace(raw)
		switch {
		case l == "":
			if para {
				p.Ln(6.5)
				para = false
			}
		case strings.HasPrefix(l, "### "):
			p.endPara(&para)
			p.keepWithNext()
			p.Ln(2)
			p.color(ink)
			p.inline(l[4:], 11.5, 6, "B")
			p.Ln(7.5)
		case strings.HasPrefix(l, "## "):
			p.endPara(&para)
			p.keepWithNext()
			p.Ln(3)
			p.color(ink)
			p.SetFont("bvps", "", 13)
			p.inline(l[3:], 13, 6.5, "B")
			p.Ln(8.5)
		case strings.HasPrefix(l, "- ") || strings.HasPrefix(l, "* "):
			p.endPara(&para)
			p.color(ink2)
			p.SetFont("bvp", "", 10.5)
			p.SetX(24)
			p.Write(5.6, "•")
			p.SetLeftMargin(29)
			p.SetX(29)
			p.inline(l[2:], 10.5, 5.6, "")
			p.SetLeftMargin(20)
			p.Ln(7)
		default:
			if para {
				p.Ln(5.6)
			}
			p.color(ink2)
			p.inline(l, 10.5, 5.6, "")
			para = true
		}
	}
	p.endPara(&para)
}

// keepWithNext: tiêu đề mục không đứng một mình ở cuối trang.
func (p *legalPDF) keepWithNext() {
	if p.GetY() > 297-20-28 {
		p.AddPage()
	}
}

func (p *legalPDF) endPara(para *bool) {
	if *para {
		p.Ln(8)
		*para = false
	}
}

func (a *App) apiLegalPDF(w http.ResponseWriter, r *http.Request) {
	key := legalPDFRe.FindStringSubmatch(r.URL.Path)[1]
	lang := "vi"
	if r.URL.Query().Get("lang") == "en" {
		lang = "en"
	}
	var docs []struct{ Key, Slug string }
	for _, d := range legalDocs {
		if key == "all" || d.Key == key {
			docs = append(docs, d)
		}
	}
	if len(docs) == 0 {
		a.fail(w, r, 404, "Không tìm thấy")
		return
	}
	c, upd, err := a.currentContent(r.Context())
	if err != nil {
		a.handleErr(w, r, err)
		return
	}
	site := "https://" + strings.ToLower(r.Host)
	if !secure(r) && (strings.HasPrefix(r.Host, "localhost") || strings.HasPrefix(r.Host, "127.")) {
		site = "http://" + strings.ToLower(r.Host)
	}
	company := a.setting(c, "company_name", lang)
	p, err := newLegalPDF(site, lang, company)
	if err != nil {
		a.handleErr(w, r, err)
		return
	}
	name := docs[0].Slug
	if key == "all" {
		name = "chinh-sach-3rdhub-vietnam"
		t := "Các chính sách của website 3RDHub Vietnam"
		if lang == "en" {
			t = "3RDHub Vietnam website policies"
		}
		p.SetTitle(t, true)
		p.cover(c, a, t, company, lang, docs)
	}
	for _, d := range docs {
		title, updated, body := a.legalText(c, d.Key, lang)
		if key != "all" {
			p.SetTitle(title, true)
		}
		p.doc(company, title, updated, body, site+"/"+d.Slug)
	}
	var buf bytes.Buffer
	if err := p.Output(&buf); err != nil {
		a.handleErr(w, r, err)
		return
	}
	if lang == "en" {
		name += "-en"
	}
	a.send(w, r, 200, buf.Bytes(), "application/pdf", map[string]string{
		"Content-Disposition": `attachment; filename="` + name + `.pdf"`,
		"Cache-Control":       "no-cache",
		"Last-Modified":       time.Unix(upd, 0).UTC().Format(http.TimeFormat),
	})
}

// cover là trang đầu của file tổng hợp: tên công ty, thông tin pháp lý và mục lục có liên kết.
func (p *legalPDF) cover(c Content, a *App, title, company, lang string, docs []struct{ Key, Slug string }) {
	p.AddPage()
	p.Ln(30)
	p.SetFont("bvp", "B", 10)
	p.color(orange)
	p.CellFormat(0, 6, strings.ToUpper(company), "", 1, "L", false, 0, "")
	p.SetFont("bvp", "B", 24)
	p.color(ink)
	p.MultiCell(0, 11, title, "", "L", false)
	p.Ln(4)
	p.SetFont("bvp", "", 10.5)
	p.color(ink2)
	lb := [3]string{"Mã số thuế", "Địa chỉ", "Liên hệ"}
	if lang == "en" {
		lb = [3]string{"Tax ID", "Address", "Contact"}
	}
	for i, v := range []string{a.setting(c, "tax_id", lang), a.setting(c, "address", lang), a.setting(c, "hotline", lang) + " · " + a.setting(c, "email", lang)} {
		p.MultiCell(0, 6, lb[i]+": "+v, "", "L", false)
	}
	p.Write(6, "Website: ")
	p.color(orange)
	p.WriteLinkString(6, strings.TrimPrefix(p.site, "https://"), p.site)
	p.Ln(14)
	p.SetFont("bvp", "B", 13)
	p.color(ink)
	toc := "Mục lục"
	if lang == "en" {
		toc = "Contents"
	}
	p.CellFormat(0, 8, toc, "", 1, "L", false, 0, "")
	p.SetFont("bvp", "", 11)
	for i, d := range docs {
		t, _, _ := a.legalText(c, d.Key, lang)
		p.color(ink2)
		p.Write(8, fmt.Sprintf("%d. ", i+1))
		p.color(ink)
		p.WriteLinkString(8, t, p.site+"/"+d.Slug)
		p.Ln(8)
	}
}
