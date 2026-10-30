package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

const maxJSON = 3 * 1024 * 1024

var settingKeys = []string{"signup_url", "email", "hotline", "hotline_tel", "company_name", "tax_id", "address", "working_hours", "working_hours_en",
	"facebook", "zalo", "tiktok", "youtube", "instagram", "site_title", "meta_description", "analytics_id", "parent_url", "company_name_en", "address_en", "scene_style", "demo_url"}
var sceneStyles = map[string]bool{"classic": true, "isometric": true, "factory": true, "ecosystem": true, "orbit": true, "voxel": true, "blueprint": true, "neon": true}
var urlSettings = map[string]bool{"signup_url": true, "facebook": true, "zalo": true, "tiktok": true, "youtube": true, "instagram": true, "parent_url": true, "demo_url": true}
var settingMax = map[string]int{"meta_description": 400, "address": 300, "company_name": 120, "company_name_en": 120, "address_en": 300, "site_title": 120, "tax_id": 40, "analytics_id": 40}
var legalKeys = []string{"terms", "privacy"}

var (
	urlRe       = regexp.MustCompile(`(?i)^https?://[^\s<>"']{3,500}$`)
	uploadRe    = regexp.MustCompile(`^/uploads/[A-Za-z0-9._-]{1,120}$`)
	emailRe     = regexp.MustCompile(`^[^@\s<>"']{1,100}@[^@\s<>"']{2,150}$`)
	telRe       = regexp.MustCompile(`^\+?[0-9]{6,15}$`)
	telStripRe  = regexp.MustCompile(`[\s.\-()]`)
	analyticsRe = regexp.MustCompile(`^[A-Za-z]{1,3}-[A-Za-z0-9-]{4,20}$`)
	idCleanRe   = regexp.MustCompile(`[^A-Za-z0-9_-]`)
	hashRe      = regexp.MustCompile(`^[0-9a-f]{6,20}$`)
)

// Pair là một đoạn chữ hai ngôn ngữ. X là dấu vết bản English do máy tự dịch (băm của bản tiếng Việt lúc dịch):
// còn X nghĩa là EN do hệ thống dịch và sẽ dịch lại khi tiếng Việt đổi; người dùng tự sửa EN thì X bị xoá.
type Pair struct {
	VI string `json:"vi"`
	EN string `json:"en"`
	X  string `json:"x,omitempty"`
}

type OvItem struct {
	VI string `json:"vi,omitempty"`
	EN string `json:"en,omitempty"`
	X  string `json:"x,omitempty"`
}

// QuotePlan là một gói trên trang Báo giá (nội dung do CMS quản lý).
type QuotePlan struct {
	ID       string `json:"id"`
	Name     Pair   `json:"name"`
	Price    Pair   `json:"price"`
	Unit     Pair   `json:"unit"`
	Desc     Pair   `json:"desc"`
	Features []Pair `json:"features"`
	Hot      bool   `json:"hot"`
}

type Quote struct {
	Plans []QuotePlan `json:"plans"`
}

type Faq struct {
	ID   string `json:"id"`
	Cat  Pair   `json:"cat"`
	Q    Pair   `json:"q"`
	A    Pair   `json:"a"`
	Home bool   `json:"home"`
}

type Partner struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	URL   string `json:"url"`
	Logo  string `json:"logo"`
	Group Pair   `json:"group"`
}

type LegalDoc struct {
	Title   Pair `json:"title"`
	Updated Pair `json:"updated"`
	Body    Pair `json:"body"`
}

type Content struct {
	Ov       map[string]OvItem   `json:"ov"`
	Faq      []Faq               `json:"faq"`
	Partners []Partner           `json:"partners"`
	Settings map[string]string   `json:"settings"`
	Legal    map[string]LegalDoc `json:"legal"`
	Quote    Quote               `json:"quote"`
}

// Defaults là nội dung mặc định nhúng trong chương trình (seed/defaults.json).
type Defaults struct {
	Faq      []Faq               `json:"faq"`
	Partners []Partner           `json:"partners"`
	Settings map[string]string   `json:"settings"`
	Legal    map[string]LegalDoc `json:"legal"`
	Quote    Quote               `json:"quote"`
}

func (c *Content) normalize() {
	if c.Quote.Plans == nil {
		c.Quote.Plans = []QuotePlan{}
	}
	if c.Ov == nil {
		c.Ov = map[string]OvItem{}
	}
	if c.Faq == nil {
		c.Faq = []Faq{}
	}
	if c.Partners == nil {
		c.Partners = []Partner{}
	}
	if c.Settings == nil {
		c.Settings = map[string]string{}
	}
	if c.Legal == nil {
		c.Legal = map[string]LegalDoc{}
	}
}

func defaultContent(d *Defaults) Content {
	c := Content{Faq: d.Faq, Partners: d.Partners, Quote: d.Quote}
	c.normalize()
	return c
}

type valErr struct{ msg string }

func (e valErr) Error() string { return e.msg }

func bad(format string, a ...any) error { return valErr{fmt.Sprintf(format, a...)} }

func isValErr(err error) bool {
	var v valErr
	return errors.As(err, &v)
}

// str lấy chuỗi từ giá trị JSON bất kỳ: nil -> "", không phải chữ -> lỗi, quá dài -> lỗi.
func str(v any, n int, field string) (string, error) {
	if v == nil {
		return "", nil
	}
	s, ok := v.(string)
	if !ok {
		return "", bad("%s phải là chữ", field)
	}
	s = strings.ReplaceAll(strings.ReplaceAll(s, "\r\n", "\n"), "\x00", "")
	if utf8.RuneCountInString(s) > n {
		return "", bad("%s quá dài (tối đa %d ký tự)", field, n)
	}
	return s, nil
}

func strip(v any, n int, field string) (string, error) {
	s, err := str(v, n, field)
	return strings.TrimSpace(s), err
}

func asMap(v any) map[string]any {
	m, _ := v.(map[string]any)
	return m
}

func pairOf(v any, n int, field string) (Pair, error) {
	m := asMap(v)
	vi, err := str(m["vi"], n, field)
	if err != nil {
		return Pair{}, err
	}
	en, err := str(m["en"], n, field)
	x, _ := m["x"].(string)
	if !hashRe.MatchString(x) {
		x = ""
	}
	return Pair{vi, en, x}, err
}

func cleanID(v any, def string) string {
	s := ""
	switch t := v.(type) {
	case nil:
	case string:
		s = t
	case bool, float64:
		if t != false && t != float64(0) {
			s = fmt.Sprint(t)
		}
	default:
		s = fmt.Sprint(t)
	}
	if s == "" {
		s = def
	}
	s = idCleanRe.ReplaceAllString(s, "")
	if len(s) > 40 {
		s = s[:40]
	}
	if s == "" {
		return def
	}
	return s
}

func truthy(v any) bool {
	switch t := v.(type) {
	case nil:
		return false
	case bool:
		return t
	case float64:
		return t != 0
	case string:
		return t != ""
	case []any:
		return len(t) > 0
	case map[string]any:
		return len(t) > 0
	}
	return true
}

// cleanContent kiểm tra và làm sạch nội dung do trang quản trị gửi lên (giống hệt bản Python).
func cleanContent(in any) (Content, error) {
	c, ok := in.(map[string]any)
	if !ok {
		return Content{}, bad("Dữ liệu không hợp lệ")
	}
	out := Content{}
	out.normalize()

	ov := asMap(c["ov"])
	if c["ov"] != nil && ov == nil || len(ov) > 5000 {
		return out, bad("Danh sách chữ tuỳ chỉnh không hợp lệ")
	}
	for k, raw := range ov {
		v, ok := raw.(map[string]any)
		if k == "" || utf8.RuneCountInString(k) > 1500 || !ok {
			continue
		}
		var item OvItem
		if t, err := strip(v["vi"], 6000, "Chữ"); err != nil {
			return out, err
		} else {
			item.VI = t
		}
		if t, err := strip(v["en"], 6000, "Chữ"); err != nil {
			return out, err
		} else {
			item.EN = t
		}
		if x, _ := v["x"].(string); hashRe.MatchString(x) {
			item.X = x
		}
		if item.VI != "" || item.EN != "" {
			out.Ov[k] = item
		}
	}

	var faq []any
	if c["faq"] != nil {
		faq, ok = c["faq"].([]any)
		if !ok || len(faq) > 400 {
			return out, bad("Danh sách hỏi đáp không hợp lệ")
		}
	}
	for i, raw := range faq {
		f, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		def := fmt.Sprintf("f%d", i+1)
		item := Faq{ID: cleanID(f["id"], def), Home: truthy(f["home"])}
		var err error
		if item.Cat, err = pairOf(f["cat"], 200, "Nhóm câu hỏi"); err != nil {
			return out, err
		}
		if item.Q, err = pairOf(f["q"], 500, "Câu hỏi"); err != nil {
			return out, err
		}
		if item.A, err = pairOf(f["a"], 8000, "Câu trả lời"); err != nil {
			return out, err
		}
		if strings.TrimSpace(item.Q.VI) == "" {
			return out, bad("Câu hỏi số %d chưa có nội dung tiếng Việt", i+1)
		}
		if strings.TrimSpace(item.Cat.VI) == "" {
			return out, bad("Câu hỏi số %d chưa có nhóm", i+1)
		}
		out.Faq = append(out.Faq, item)
	}

	var partners []any
	if c["partners"] != nil {
		partners, ok = c["partners"].([]any)
		if !ok || len(partners) > 300 {
			return out, bad("Danh sách đối tác không hợp lệ")
		}
	}
	for i, raw := range partners {
		p, ok := raw.(map[string]any)
		if !ok {
			continue
		}
		name, err := strip(p["name"], 120, "Tên đối tác")
		if err != nil {
			return out, err
		}
		if name == "" {
			return out, bad("Đối tác số %d chưa có tên", i+1)
		}
		url, err := strip(p["url"], 500, "Link đối tác")
		if err != nil {
			return out, err
		}
		if url != "" && !urlRe.MatchString(url) {
			return out, bad("Link của '%s' phải bắt đầu bằng http:// hoặc https://", name)
		}
		logo, err := strip(p["logo"], 200, "Logo")
		if err != nil {
			return out, err
		}
		if logo != "" && !uploadRe.MatchString(logo) {
			return out, bad("Logo của '%s' không hợp lệ", name)
		}
		grp, err := pairOf(p["group"], 120, "Nhóm đối tác")
		if err != nil {
			return out, err
		}
		if strings.TrimSpace(grp.VI) == "" {
			return out, bad("Đối tác '%s' chưa có nhóm", name)
		}
		out.Partners = append(out.Partners, Partner{ID: cleanID(p["id"], fmt.Sprintf("p%d", i+1)), Name: name, URL: url, Logo: logo, Group: grp})
	}

	st := asMap(c["settings"])
	for _, k := range settingKeys {
		max := settingMax[k]
		if max == 0 {
			max = 300
		}
		v, err := strip(st[k], max, k)
		if err != nil {
			return out, err
		}
		if v == "" {
			continue
		}
		if urlSettings[k] && !urlRe.MatchString(v) {
			return out, bad("'%s' phải là đường dẫn bắt đầu bằng http:// hoặc https://", k)
		}
		if k == "email" && !emailRe.MatchString(v) {
			return out, bad("Email không hợp lệ")
		}
		if k == "hotline_tel" {
			v = telStripRe.ReplaceAllString(v, "")
			if !telRe.MatchString(v) {
				return out, bad("Số gọi (hotline_tel) chỉ gồm số, có thể bắt đầu bằng +")
			}
		}
		if k == "scene_style" && !sceneStyles[v] {
			return out, bad("Kiểu cảnh 3D không hợp lệ")
		}
		if k == "analytics_id" && !analyticsRe.MatchString(v) {
			return out, bad("Mã Google Analytics có dạng G-XXXXXXXXXX")
		}
		out.Settings[k] = v
	}

	if q := asMap(c["quote"]); q != nil {
		plans, _ := q["plans"].([]any)
		if len(plans) > 12 {
			return out, bad("Tối đa 12 gói báo giá")
		}
		for i, raw := range plans {
			m := asMap(raw)
			if m == nil {
				continue
			}
			pl := QuotePlan{ID: cleanID(m["id"], fmt.Sprintf("q%d", i+1)), Hot: truthy(m["hot"]), Features: []Pair{}}
			var err error
			if pl.Name, err = pairOf(m["name"], 120, "Tên gói"); err != nil {
				return out, err
			}
			if strings.TrimSpace(pl.Name.VI) == "" {
				return out, bad("Gói báo giá số %d chưa có tên", i+1)
			}
			if pl.Price, err = pairOf(m["price"], 80, "Giá"); err != nil {
				return out, err
			}
			if pl.Unit, err = pairOf(m["unit"], 80, "Đơn vị giá"); err != nil {
				return out, err
			}
			if pl.Desc, err = pairOf(m["desc"], 400, "Mô tả gói"); err != nil {
				return out, err
			}
			fs, _ := m["features"].([]any)
			if len(fs) > 40 {
				return out, bad("Mỗi gói tối đa 40 dòng tính năng")
			}
			for _, f := range fs {
				pf, err := pairOf(f, 300, "Tính năng")
				if err != nil {
					return out, err
				}
				if strings.TrimSpace(pf.VI) != "" {
					pl.Features = append(pl.Features, pf)
				}
			}
			out.Quote.Plans = append(out.Quote.Plans, pl)
		}
	}

	legal := asMap(c["legal"])
	for _, key := range legalKeys {
		d := asMap(legal[key])
		if d == nil {
			continue
		}
		var item LegalDoc
		var err error
		if item.Title, err = pairOf(d["title"], 200, "Tiêu đề trang pháp lý"); err != nil {
			return out, err
		}
		if item.Updated, err = pairOf(d["updated"], 80, "Ngày cập nhật"); err != nil {
			return out, err
		}
		if item.Body, err = pairOf(d["body"], 60000, "Nội dung trang pháp lý"); err != nil {
			return out, err
		}
		any_ := false
		for _, p := range []Pair{item.Title, item.Updated, item.Body} {
			if strings.TrimSpace(p.VI) != "" || strings.TrimSpace(p.EN) != "" {
				any_ = true
			}
		}
		if any_ {
			out.Legal[key] = item
		}
	}
	if b, _ := json.Marshal(out); len(b) > maxJSON {
		return out, bad("Nội dung quá lớn")
	}
	return out, nil
}
