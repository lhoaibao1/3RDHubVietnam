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
	"facebook", "zalo", "tiktok", "youtube", "instagram", "site_title", "meta_description", "analytics_id", "parent_url", "company_name_en", "address_en", "scene_style", "demo_url", "linkedin", "bct_url", "dmca_id", "dmca_verify"}

// Giao diện chọn trong CMS (khớp với web/src/lib/look.ts): hiệu ứng cuộn và nền từng khu vực ("hoạ tiết|#màu1|#màu2").
var scrollFx = map[string]bool{"rise": true, "fade": true, "zoom": true, "pop": true, "slide": true, "flip": true, "tilt": true, "skew": true, "blur": true, "curtain": true, "swing": true, "none": true}
var bgAreas = []string{"home-biz", "home-tech", "home-partners", "home-faq", "home-contact", "mo-hinh", "advertiser", "san-pham", "bao-gia", "cong-nghe", "doi-tac", "hoi-dap", "lien-he", "dang-ky", "chinh-sach"}
var bgRe = regexp.MustCompile(`^(grid|dots|polka|sparkle|circuit|rings|waves|topo|diag|hatch|stripes|vlines|checker|zig|cubes|bokeh|aurora|none)(\|#[0-9a-fA-F]{6}){0,2}$`)

func init() {
	settingKeys = append(settingKeys, "scroll_fx")
	for _, a := range bgAreas {
		settingKeys = append(settingKeys, "bg_"+a)
	}
}

var sceneStyles = map[string]bool{"classic": true, "isometric": true, "factory": true, "ecosystem": true, "orbit": true, "voxel": true, "blueprint": true, "neon": true}
var urlSettings = map[string]bool{"signup_url": true, "facebook": true, "zalo": true, "tiktok": true, "youtube": true, "instagram": true, "parent_url": true, "demo_url": true, "linkedin": true, "bct_url": true}
var settingMax = map[string]int{"meta_description": 400, "address": 300, "company_name": 120, "company_name_en": 120, "address_en": 300, "site_title": 120, "tax_id": 40, "analytics_id": 40}
var legalKeys = []string{"terms", "privacy", "complaints", "pricing", "payment", "service", "refund", "support"}

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

// QuoteRow là một dòng của bảng so sánh các gói: Cells theo đúng thứ tự Plans.
type QuoteRow struct {
	Label Pair   `json:"label"`
	Cells []Pair `json:"cells"`
}

type Quote struct {
	Plans []QuotePlan `json:"plans"`
	Rows  []QuoteRow  `json:"rows"`
}

// Module là một nhóm chức năng của phần mềm (trang Sản phẩm).
type Module struct {
	ID    string `json:"id"`
	Code  Pair   `json:"code"`
	Title Pair   `json:"title"`
	Items []Pair `json:"items"`
}

// Project là một dòng sản phẩm/dịch vụ của công ty (trang Sản phẩm: SaaS, Website/CMS, CRM/ERP, Mail Server...).
type Project struct {
	ID     string `json:"id"`
	Icon   string `json:"icon"`
	Name   Pair   `json:"name"`
	Tag    Pair   `json:"tag"`
	Desc   Pair   `json:"desc"`
	Points []Pair `json:"points"`
}

// Shot là một ảnh giao diện hệ thống ở trang Sản phẩm (ảnh mẫu trong /hub/ hoặc ảnh tải lên /uploads/).
type Shot struct {
	ID    string `json:"id"`
	Img   string `json:"img"`
	Label Pair   `json:"label"`
}

type Product struct {
	Projects []Project `json:"projects"`
	Modules  []Module  `json:"modules"`
	// nil: dùng bộ ảnh mặc định; rỗng: ẩn khu ảnh giao diện
	Shots []Shot `json:"shots"`
}

// Ảnh giao diện cũ đã đổi tên (tránh trình duyệt giữ ảnh demo cũ cùng tên) và danh sách mặc định cũ.
var renamedHub = map[string]string{"/hub/orders.webp": "/hub/order-list.webp", "/hub/campaigns.webp": "/hub/campaign-list.webp", "/hub/members.webp": "/hub/team-members.webp"}

const oldShotIDs = "dashboard,campaigns,tracking,orders,clicks,members,access,settings,advertisers,apidocs"

// upgradeShots: bộ ảnh mặc định cũ (chưa chỉnh) thì dùng bộ mặc định mới; ảnh đã đổi tên thì trỏ sang tên mới.
func upgradeShots(s, def []Shot) []Shot {
	ids := make([]string, len(s))
	same := true
	for i, x := range s {
		ids[i] = x.ID
		same = same && x.Img == "/hub/"+x.ID+".webp"
	}
	if same && strings.Join(ids, ",") == oldShotIDs {
		return append([]Shot(nil), def...)
	}
	out := make([]Shot, len(s))
	copy(out, s)
	for i := range out {
		if n, ok := renamedHub[out[i].Img]; ok {
			out[i].Img = n
		}
	}
	return out
}

// mergeShots thêm các màn mới (Chiến dịch, Đơn hàng, Lead, Thành viên) vào danh sách ảnh đã chỉnh trong CMS, theo thứ tự mặc định;
// giữ nguyên ảnh và tên đã chỉnh, ảnh tự tải lên nằm cuối. Trả false nếu không cần đổi.
func mergeShots(saved, def []Shot) ([]Shot, bool) {
	add := map[string]bool{"campaign-list": true, "campaign-detail": true, "campaign-new": true, "order-list": true, "order-leads": true, "team-members": true}
	have := map[string]bool{}
	for _, x := range saved {
		have[x.Img] = true
	}
	changed := false
	byImg := map[string]Shot{}
	for _, x := range saved {
		byImg[x.Img] = x
	}
	out := []Shot{}
	used := map[string]bool{}
	for _, d := range def {
		if x, ok := byImg[d.Img]; ok {
			out = append(out, x)
			used[d.Img] = true
		} else if add[d.ID] && !have[d.Img] {
			out = append(out, d)
			changed = true
		}
	}
	for _, x := range saved {
		if !used[x.Img] {
			out = append(out, x)
		}
	}
	return out, changed
}

var dmcaVerifyRe = regexp.MustCompile(`^[A-Za-z0-9+/=]{16,200}$`)

var uuidRe = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

var hubImgRe = regexp.MustCompile(`^/hub/[a-z0-9-]{1,40}\.webp$`)

var projectIcons = map[string]bool{"layers": true, "globe": true, "database": true, "mail": true, "blocks": true, "cpu": true, "network": true, "workflow": true, "box": true, "smartphone": true}

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

// Client là một khách hàng tiêu biểu (mục "Khách hàng của chúng tôi").
type Client struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Logo string `json:"logo"`
	URL  string `json:"url"`
	Desc Pair   `json:"desc"`
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
	Clients  []Client            `json:"clients"`
	Product  Product             `json:"product"`
}

// Defaults là nội dung mặc định nhúng trong chương trình (seed/defaults.json).
type Defaults struct {
	Faq      []Faq               `json:"faq"`
	Partners []Partner           `json:"partners"`
	Settings map[string]string   `json:"settings"`
	Legal    map[string]LegalDoc `json:"legal"`
	Quote    Quote               `json:"quote"`
	Clients  []Client            `json:"clients"`
	Product  Product             `json:"product"`
}

func (c *Content) normalize() {
	if c.Clients == nil {
		c.Clients = []Client{}
	}
	if c.Quote.Rows == nil {
		c.Quote.Rows = []QuoteRow{}
	}
	if c.Product.Modules == nil {
		c.Product.Modules = []Module{}
	}
	if c.Product.Projects == nil {
		c.Product.Projects = []Project{}
	}
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

// defaultContent trả bản sao độc lập của nội dung mặc định (sao chép sâu qua JSON), để việc đọc nội dung đã lưu
// đè lên không làm hỏng bộ mặc định dùng chung trong bộ nhớ.
func defaultContent(d *Defaults) Content {
	c := Content{Faq: d.Faq, Partners: d.Partners, Quote: d.Quote, Clients: d.Clients, Product: d.Product}
	var cp Content
	if b, err := json.Marshal(c); err == nil && json.Unmarshal(b, &cp) == nil {
		c = cp
	}
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
		if strings.HasPrefix(k, "verify_") {
			code, okv := cleanVerify(v)
			if !okv {
				return out, bad("Mã xác minh '%s' không hợp lệ (dán mã trong content=\"...\" hoặc nguyên thẻ <meta>)", strings.TrimPrefix(k, "verify_"))
			}
			v = code
		}
		if (strings.HasPrefix(k, "seot_") || strings.HasPrefix(k, "seod_")) && strings.ContainsAny(v, "<>\n") {
			return out, bad("Tiêu đề/mô tả SEO không được chứa xuống dòng hoặc dấu < >")
		}
		if k == "scroll_fx" && !scrollFx[v] {
			return out, bad("Hiệu ứng cuộn không hợp lệ")
		}
		if strings.HasPrefix(k, "bg_") && !bgRe.MatchString(v) {
			return out, bad("Nền của khu vực '%s' không hợp lệ", strings.TrimPrefix(k, "bg_"))
		}
		if k == "scene_style" && !sceneStyles[v] {
			return out, bad("Kiểu cảnh 3D không hợp lệ")
		}
		if k == "dmca_verify" && !dmcaVerifyRe.MatchString(v) {
			return out, bad("Mã xác minh DMCA chỉ gồm chữ, số và + / = (bấm nút copy trên trang DMCA rồi dán vào)")
		}
		if k == "dmca_id" && !uuidRe.MatchString(v) {
			return out, bad("Mã DMCA có dạng 05128573-eeec-4272-ad2b-a37ecfee4803 (lấy trong mã nhúng huy hiệu, sau ID=)")
		}
		if k == "analytics_id" && !analyticsRe.MatchString(v) {
			return out, bad("Mã Google Analytics có dạng G-XXXXXXXXXX")
		}
		out.Settings[k] = v
	}

	if c["clients"] != nil {
		cl, ok := c["clients"].([]any)
		if !ok || len(cl) > 120 {
			return out, bad("Danh sách khách hàng không hợp lệ")
		}
		for i, raw := range cl {
			m := asMap(raw)
			if m == nil {
				continue
			}
			name, err := strip(m["name"], 120, "Tên khách hàng")
			if err != nil {
				return out, err
			}
			if name == "" {
				return out, bad("Khách hàng số %d chưa có tên", i+1)
			}
			logo, err := strip(m["logo"], 200, "Logo")
			if err != nil {
				return out, err
			}
			if logo != "" && !uploadRe.MatchString(logo) {
				return out, bad("Logo của '%s' không hợp lệ", name)
			}
			u, err := strip(m["url"], 500, "Website khách hàng")
			if err != nil {
				return out, err
			}
			if u != "" && !urlRe.MatchString(u) {
				return out, bad("Website của '%s' phải bắt đầu bằng http:// hoặc https://", name)
			}
			desc, err := pairOf(m["desc"], 400, "Mô tả khách hàng")
			if err != nil {
				return out, err
			}
			out.Clients = append(out.Clients, Client{ID: cleanID(m["id"], fmt.Sprintf("c%d", i+1)), Name: name, Logo: logo, URL: u, Desc: desc})
		}
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
		rows, _ := q["rows"].([]any)
		if len(rows) > 60 {
			return out, bad("Bảng so sánh tối đa 60 dòng")
		}
		for _, raw := range rows {
			m := asMap(raw)
			if m == nil {
				continue
			}
			lb, err := pairOf(m["label"], 200, "Hạng mục so sánh")
			if err != nil {
				return out, err
			}
			if strings.TrimSpace(lb.VI) == "" {
				continue
			}
			row := QuoteRow{Label: lb, Cells: []Pair{}}
			cs, _ := m["cells"].([]any)
			for i, cv := range cs {
				if i >= 12 {
					break
				}
				p, err := pairOf(cv, 200, "Ô so sánh")
				if err != nil {
					return out, err
				}
				row.Cells = append(row.Cells, p)
			}
			out.Quote.Rows = append(out.Quote.Rows, row)
		}
	}

	if pm := asMap(c["product"]); pm != nil {
		prs, _ := pm["projects"].([]any)
		if len(prs) > 12 {
			return out, bad("Tối đa 12 dự án")
		}
		for i, raw := range prs {
			m := asMap(raw)
			if m == nil {
				continue
			}
			pj := Project{ID: cleanID(m["id"], fmt.Sprintf("p%d", i+1)), Points: []Pair{}}
			if ic, _ := m["icon"].(string); projectIcons[ic] {
				pj.Icon = ic
			} else {
				pj.Icon = "layers"
			}
			var err error
			if pj.Name, err = pairOf(m["name"], 120, "Tên dự án"); err != nil {
				return out, err
			}
			if strings.TrimSpace(pj.Name.VI) == "" {
				return out, bad("Dự án số %d chưa có tên", i+1)
			}
			if pj.Tag, err = pairOf(m["tag"], 200, "Câu giới thiệu ngắn"); err != nil {
				return out, err
			}
			if pj.Desc, err = pairOf(m["desc"], 2000, "Mô tả dự án"); err != nil {
				return out, err
			}
			pts, _ := m["points"].([]any)
			if len(pts) > 30 {
				return out, bad("Mỗi dự án tối đa 30 dòng")
			}
			for _, pv := range pts {
				p, err := pairOf(pv, 300, "Điểm nổi bật")
				if err != nil {
					return out, err
				}
				if strings.TrimSpace(p.VI) != "" {
					pj.Points = append(pj.Points, p)
				}
			}
			out.Product.Projects = append(out.Product.Projects, pj)
		}
		if sv, has := pm["shots"]; has && sv != nil {
			shs, _ := sv.([]any)
			if len(shs) > 30 {
				return out, bad("Tối đa 30 ảnh giao diện")
			}
			out.Product.Shots = []Shot{}
			for i, raw := range shs {
				m := asMap(raw)
				if m == nil {
					continue
				}
				sh := Shot{ID: cleanID(m["id"], fmt.Sprintf("s%d", i+1))}
				sh.Img, _ = m["img"].(string)
				if !hubImgRe.MatchString(sh.Img) && !uploadRe.MatchString(sh.Img) {
					return out, bad("Ảnh giao diện số %d chưa có ảnh hợp lệ", i+1)
				}
				var err error
				if sh.Label, err = pairOf(m["label"], 80, "Tên màn hình"); err != nil {
					return out, err
				}
				out.Product.Shots = append(out.Product.Shots, sh)
			}
		}
		mods, _ := pm["modules"].([]any)
		if len(mods) > 30 {
			return out, bad("Tối đa 30 nhóm chức năng")
		}
		for i, raw := range mods {
			m := asMap(raw)
			if m == nil {
				continue
			}
			md := Module{ID: cleanID(m["id"], fmt.Sprintf("m%d", i+1)), Items: []Pair{}}
			var err error
			if md.Code, err = pairOf(m["code"], 80, "Mã nhóm"); err != nil {
				return out, err
			}
			if md.Title, err = pairOf(m["title"], 160, "Tên nhóm chức năng"); err != nil {
				return out, err
			}
			if strings.TrimSpace(md.Title.VI) == "" {
				return out, bad("Nhóm chức năng số %d chưa có tên", i+1)
			}
			its, _ := m["items"].([]any)
			if len(its) > 30 {
				return out, bad("Mỗi nhóm tối đa 30 dòng")
			}
			for _, iv := range its {
				p, err := pairOf(iv, 300, "Chức năng")
				if err != nil {
					return out, err
				}
				if strings.TrimSpace(p.VI) != "" {
					md.Items = append(md.Items, p)
				}
			}
			out.Product.Modules = append(out.Product.Modules, md)
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
