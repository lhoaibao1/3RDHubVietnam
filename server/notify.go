package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Thông báo khi có người đăng ký trên website: email cho đội ngũ (có thể nhiều địa chỉ), email xác nhận cho khách,
// tin nhắn Zalo Bot cho đội ngũ. Mỗi kênh bật/tắt riêng trong CMS. Tin Zalo OA cho khách nằm ở zalooa.go
// (mượn access token từ 3RDHub; trang này không tự làm mới token Zalo OA).

/* ---------------- cấu hình Zalo ---------------- */

type zaloCfg struct {
	BotOn    bool   `json:"bot_on"`
	BotToken string `json:"bot_token,omitempty"` // mã hoá
	BotChats string `json:"bot_chats"`           // chat_id, cách nhau bởi dấu phẩy
}

var (
	zaloMu     sync.Mutex
	zaloBotURL = "https://bot-api.zaloplatforms.com"
	zaloIDRe   = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,200}$`)
	httpZalo   = &http.Client{Timeout: 15 * time.Second}
)

func (a *App) loadZalo(ctx context.Context) zaloCfg {
	var c zaloCfg
	kvGet(ctx, a.pool, "zalo", &c)
	return c
}

// publicZalo bỏ mọi khoá bí mật trước khi gửi về CMS, chỉ báo đã có hay chưa.
func publicZalo(c zaloCfg) map[string]any {
	return map[string]any{
		"bot_on": c.BotOn, "bot_chats": c.BotChats, "has_bot_token": c.BotToken != "",
	}
}

func cleanZalo(a *App, d map[string]any, c zaloCfg) (zaloCfg, error) {
	c.BotOn = truthy(d["bot_on"])
	var err error
	if c.BotChats, err = strip(d["bot_chats"], 1000, "Chat ID"); err != nil {
		return c, err
	}
	for _, id := range splitList(c.BotChats) {
		if !zaloIDRe.MatchString(id) {
			return c, bad("Chat ID không hợp lệ: %s", id)
		}
	}
	c.BotChats = strings.Join(splitList(c.BotChats), ", ")
	set := func(field, key string, max int) error {
		v, _ := d[key].(string)
		v = strings.TrimSpace(v)
		if v == "" {
			return nil
		}
		if len(v) > max || !noCRLF(v) {
			return bad("Giá trị %s không hợp lệ", key)
		}
		enc, err := a.seal(v)
		if err != nil {
			return err
		}
		if field == "bot" {
			c.BotToken = enc
		}
		return nil
	}
	if err := set("bot", "bot_token", 300); err != nil {
		return c, err
	}
	return c, nil
}

/* ---------------- Zalo Bot ---------------- */

func (a *App) zaloBotCall(ctx context.Context, token, method string, body any) (map[string]any, error) {
	b, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, "POST", zaloBotURL+"/bot"+token+"/"+method, bytes.NewReader(b))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := httpZalo.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không gọi được Zalo Bot: %w", err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	var out map[string]any
	json.Unmarshal(raw, &out)
	if resp.StatusCode == 401 {
		return out, errors.New("Zalo Bot: token không đúng")
	}
	if resp.StatusCode != 200 || out == nil || out["ok"] == false {
		desc, _ := out["description"].(string)
		return out, fmt.Errorf("Zalo Bot trả lỗi %d %s", resp.StatusCode, desc)
	}
	return out, nil
}

func (a *App) zaloBotSend(ctx context.Context, c zaloCfg, text string) error {
	tok, err := a.unseal(c.BotToken)
	if err != nil || tok == "" {
		return errors.New("chưa có token Zalo Bot")
	}
	ids := splitList(c.BotChats)
	if len(ids) == 0 {
		return errors.New("chưa có chat ID nhận tin")
	}
	if r := []rune(text); len(r) > 1900 {
		text = string(r[:1900]) + "…"
	}
	var errs []string
	for _, id := range ids {
		if _, err := a.zaloBotCall(ctx, tok, "sendMessage", map[string]any{"chat_id": id, "text": text}); err != nil {
			errs = append(errs, id+": "+err.Error())
		}
	}
	if len(errs) > 0 {
		return errors.New(strings.Join(errs, "; "))
	}
	return nil
}

func vnZone() *time.Location {
	if z, err := time.LoadLocation("Asia/Ho_Chi_Minh"); err == nil {
		return z
	}
	return time.FixedZone("ICT", 7*3600)
}

/* ---------------- nhật ký gửi ---------------- */

type notifyEntry struct {
	TS      int64  `json:"ts"`
	Channel string `json:"channel"`
	To      string `json:"to"`
	OK      bool   `json:"ok"`
	Err     string `json:"err,omitempty"`
}

var nlogMu sync.Mutex

func (a *App) logNotify(ctx context.Context, ch, to string, err error) {
	e := notifyEntry{TS: time.Now().Unix(), Channel: ch, To: to, OK: err == nil}
	if err != nil {
		e.Err = err.Error()
		log.Printf("thông báo %s tới %s lỗi: %v", ch, to, err)
	}
	nlogMu.Lock()
	defer nlogMu.Unlock()
	var list []notifyEntry
	kvGet(ctx, a.pool, "notify_log", &list)
	list = append([]notifyEntry{e}, list...)
	if len(list) > 40 {
		list = list[:40]
	}
	kvSetPool(ctx, a.pool, "notify_log", list)
}

/* ---------------- thư HTML ---------------- */

type brand struct {
	Company, Address, Hotline, Tel, Email, Site, Parent, Logo string
}

func (a *App) brandInfo(ctx context.Context, base string) brand {
	c, _, _ := a.currentContent(ctx)
	get := func(k string) string {
		if v := c.Settings[k]; v != "" {
			return v
		}
		return a.defaults.Settings[k]
	}
	if base == "" {
		base = "https://3rdhubvietnam.tech"
	}
	return brand{Company: get("company_name"), Address: get("address"), Hotline: get("hotline"), Tel: get("hotline_tel"), Email: get("email"), Site: base, Parent: get("parent_url"), Logo: base + "/icon-192.png"}
}

type mailRow struct{ K, V, H string } // H: liên kết (tel:, mailto:) của giá trị, có thể để trống

type mailData struct {
	B        brand
	Pre      string // dòng xem trước trong hộp thư
	Kicker   string
	Title    string
	Lead     string
	Rows     []mailRow
	Steps    []mailRow
	CTA, URL string
	Note     string
	Lang     string
	Sign     string // dòng ký tên cuối thư
}

// Thư HTML: bố cục bảng + style nội tuyến để hiển thị đúng ở Gmail, Outlook, Apple Mail và điện thoại. Không dùng hiệu ứng chuyển động
// (hầu hết ứng dụng thư không chạy, và Outlook hiển thị sai). Màu chủ đạo xanh đêm, điểm nhấn cam dùng tiết chế.
var mailTpl = template.Must(template.New("m").Parse(`<!doctype html>
<html lang="{{.Lang}}" xmlns="http://www.w3.org/1999/xhtml"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>{{.Title}}</title>
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table{border-collapse:collapse}
a{text-decoration:none}
@media(max-width:620px){.wrap{width:100%!important}.pad{padding:28px 22px!important}.hd{padding:28px 22px 30px!important}.h1{font-size:25px!important}.k{display:block!important;width:auto!important;padding:12px 0 2px!important;border-bottom:0!important}.v{display:block!important;padding:0 0 12px!important}}
</style></head>
<body style="margin:0;padding:0;background:#EDEFF5;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0A1330">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#EDEFF5">{{.Pre}}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#EDEFF5" style="background:#EDEFF5"><tr><td align="center" style="padding:36px 12px 44px">
<table role="presentation" class="wrap" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">
<tr><td style="padding:0 6px 16px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#7A83A3;font-weight:700">3RDVN Technology</td></tr>
<tr><td style="background:#ffffff;border:1px solid #DDE1EC;border-radius:22px;overflow:hidden">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><td height="4" bgcolor="#FF6A2B" style="height:4px;line-height:4px;font-size:0;background:#FF6A2B;background-image:linear-gradient(90deg,#FF6A2B 0%,#FF4D8D 55%,#7B4DFF 100%)">&nbsp;</td></tr>
<tr><td class="hd" bgcolor="#0A1330" style="background:#0A1330;background-image:linear-gradient(135deg,#0A1330 0%,#111F52 62%,#1A2B6B 100%);padding:34px 40px 38px">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td valign="middle"><img src="{{.B.Logo}}" width="38" height="38" alt="" style="display:block;border:0;border-radius:10px"></td>
    <td valign="middle" style="padding-left:12px;font-size:19px;font-weight:800;color:#ffffff;letter-spacing:-.01em">3RDHub <span style="color:#FF9A6B">Vietnam</span></td>
  </tr></table>
  {{if .Kicker}}<div style="margin:34px 0 0;font-size:12px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:#FF9A6B">{{.Kicker}}</div>{{end}}
  <div class="h1" style="margin:12px 0 0;font-size:30px;line-height:1.2;font-weight:800;letter-spacing:-.02em;color:#ffffff">{{.Title}}</div>
</td></tr>
<tr><td class="pad" style="padding:36px 40px 12px">
  <p style="margin:0 0 26px;font-size:16px;line-height:1.75;color:#38405F">{{.Lead}}</p>
  {{if .Rows}}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#F6F7FB" style="background:#F6F7FB;border-radius:16px;border:1px solid #E6E9F2"><tr><td style="padding:6px 24px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    {{range $i, $r := .Rows}}<tr><td class="k" width="118" valign="top" style="padding:14px 12px 14px 0;font-size:11.5px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#7A83A3;border-bottom:1px solid #E6E9F2">{{$r.K}}</td><td class="v" valign="top" style="padding:12px 0;font-size:15.5px;line-height:1.55;font-weight:600;color:#0A1330;border-bottom:1px solid #E6E9F2;white-space:pre-line">{{if $r.H}}<a href="{{$r.H}}" style="color:#0A1330;border-bottom:1px solid #FF9A6B">{{$r.V}}</a>{{else}}{{$r.V}}{{end}}</td></tr>{{end}}
    </table></td></tr></table>{{end}}
  {{if .Steps}}<div style="margin:30px 0 4px;font-size:11.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#7A83A3">{{if eq .Lang "en"}}What happens next{{else}}Các bước tiếp theo{{end}}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
    {{range $i, $s := .Steps}}<tr><td width="46" valign="top" style="padding:14px 0;border-bottom:1px solid #ECEEF5;font-size:15px;font-weight:800;color:#FF6A2B;letter-spacing:.04em">0{{$s.K}}</td><td valign="top" style="padding:14px 0;border-bottom:1px solid #ECEEF5;font-size:15px;line-height:1.6;color:#38405F">{{$s.V}}</td></tr>{{end}}
  </table>{{end}}
  {{if .CTA}}<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:32px 0 8px"><tr><td bgcolor="#0A1330" style="border-radius:12px;background:#0A1330"><a href="{{.URL}}" style="display:inline-block;padding:16px 32px;font-size:15px;font-weight:800;letter-spacing:.01em;color:#ffffff;border-radius:12px">{{.CTA}}&nbsp;&nbsp;<span style="color:#FF9A6B">&rarr;</span></a></td></tr></table>{{end}}
  {{if .Note}}<p style="margin:22px 0 0;font-size:13.5px;line-height:1.7;color:#7A83A3">{{.Note}}</p>{{end}}
  {{if .Sign}}<p style="margin:26px 0 0;font-size:15px;line-height:1.7;color:#38405F">{{.Sign}}<br><b style="color:#0A1330">{{.B.Company}}</b></p>{{end}}
</td></tr>
<tr><td bgcolor="#F6F7FB" style="background:#F6F7FB;border-top:1px solid #E6E9F2;padding:26px 40px 28px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="font-size:12.5px;line-height:1.8;color:#7A83A3">
    <b style="color:#0A1330">{{.B.Company}}</b><br>{{if .B.Address}}{{.B.Address}}<br>{{end}}
    <a href="tel:{{.B.Tel}}" style="color:#38405F;font-weight:700">{{.B.Hotline}}</a> &nbsp;&middot;&nbsp; <a href="mailto:{{.B.Email}}" style="color:#38405F;font-weight:700">{{.B.Email}}</a><br>
    <a href="{{.B.Site}}" style="color:#E2531A;font-weight:700">3rdhubvietnam.tech</a>{{if .B.Parent}} &nbsp;&middot;&nbsp; <a href="{{.B.Parent}}" style="color:#E2531A;font-weight:700">3rdvn.io.vn</a>{{end}}
  </td></tr></table>
</td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:18px 12px 0;font-size:11.5px;line-height:1.6;color:#9AA2BD">{{if eq .Lang "en"}}You are receiving this email because you contacted 3RDHub Vietnam through our website.{{else}}Bạn nhận email này vì đã liên hệ 3RDHub Vietnam qua website.{{end}}</td></tr>
</table>
</td></tr></table>
</body></html>`))

func renderMail(d mailData) string {
	var b bytes.Buffer
	if err := mailTpl.Execute(&b, d); err != nil {
		return ""
	}
	return b.String()
}

// telOf giữ lại số và dấu + để dùng trong liên kết tel:.
func telOf(p string) string {
	var b strings.Builder
	for _, r := range p {
		if r >= '0' && r <= '9' || r == '+' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func leadRows(l leadRow, en bool) []mailRow {
	lb := func(vi, e string) string {
		if en {
			return e
		}
		return vi
	}
	rows := []mailRow{{K: lb("Họ tên", "Name"), V: l.Name}, {K: lb("Điện thoại", "Phone"), V: l.Phone, H: "tel:" + telOf(l.Phone)}}
	if l.Email != "" {
		rows = append(rows, mailRow{K: "Email", V: l.Email, H: "mailto:" + l.Email})
	}
	if l.Company != "" {
		rows = append(rows, mailRow{K: lb("Công ty", "Company"), V: l.Company})
	}
	if l.Need != "" {
		rows = append(rows, mailRow{K: lb("Nhu cầu", "Interest"), V: l.Need})
	}
	if l.Message != "" {
		rows = append(rows, mailRow{K: lb("Nội dung", "Message"), V: l.Message})
	}
	return rows
}

// staffMail là thư báo cho đội ngũ khi có yêu cầu mới.
func staffMail(b brand, l leadRow, cms string) (subject, text, html string) {
	need := l.Need
	if need == "" {
		need = "Tư vấn"
	}
	subject = fmt.Sprintf("🔔 Yêu cầu mới #%d · %s · %s", l.ID, l.Name, need)
	rows := append(leadRows(l, false), mailRow{K: "Thời gian", V: time.Unix(l.TS, 0).In(vnZone()).Format("15:04 · 02/01/2006")})
	html = renderMail(mailData{B: b, Lang: "vi", Pre: l.Name + " · " + l.Phone + " · " + need, Kicker: "Yêu cầu mới từ website", Title: l.Name + " vừa gửi yêu cầu",
		Lead: "Có khách vừa để lại thông tin trên website 3RDHub Vietnam. Liên hệ sớm để không lỡ cơ hội.", Rows: rows, CTA: "Mở trong CMS", URL: cms + "/#leads",
		Note: replyNote(l)})
	var t strings.Builder
	t.WriteString("Yêu cầu mới từ website 3RDHub Vietnam\n\n")
	for _, r := range rows {
		t.WriteString(r.K + ": " + r.V + "\n")
	}
	t.WriteString("\nXem trong CMS: " + cms + "/#leads\n")
	return subject, t.String(), html
}

func replyNote(l leadRow) string {
	if l.Email != "" {
		return "Thư tự động từ hệ thống 3RDHub. Bấm Trả lời để email thẳng cho khách (" + l.Email + ")."
	}
	return "Thư tự động từ hệ thống 3RDHub. Khách không để lại email, hãy gọi theo số điện thoại ở trên."
}

// customerMail là thư xác nhận gửi khách (theo ngôn ngữ khách đang dùng trên website).
func customerMail(b brand, l leadRow) (subject, text, html string) {
	en := l.Lang == "en"
	if en {
		subject = "We've received your request · 3RDHub Vietnam"
		d := mailData{B: b, Lang: "en", Pre: "Thanks " + l.Name + ", our team will contact you shortly.", Kicker: "Request received", Title: "Thank you, " + l.Name + ". We have your request",
			Lead: "A 3RDVN Technology consultant will reach out to you during business hours. Below is what you sent us, for your reference.",
			Rows: leadRows(l, true), Steps: []mailRow{{K: "1", V: "We review your needs and prepare suitable options."}, {K: "2", V: "A consultant calls you to discuss details and show a demo."}, {K: "3", V: "You receive a scoped quote and next steps."}}, Sign: "Best regards,",
			CTA: "Explore 3RDHub", URL: b.Site + "/san-pham", Note: "If you did not submit this request, simply ignore this email."}
		html = renderMail(d)
		text = "Thank you, " + l.Name + "!\n\nWe have received your request and will contact you shortly.\n\n" + b.Company + " · " + b.Hotline + " · " + b.Email + "\n"
		return
	}
	subject = "3RDHub Vietnam đã nhận yêu cầu của bạn"
	d := mailData{B: b, Lang: "vi", Pre: "Cảm ơn " + l.Name + ", đội ngũ 3RDVN Technology sẽ liên hệ bạn sớm.", Kicker: "Đã nhận yêu cầu", Title: "Cảm ơn " + l.Name + ", chúng tôi đã nhận được yêu cầu",
		Lead: "Chuyên viên của 3RDVN Technology sẽ liên hệ bạn trong giờ làm việc. Dưới đây là thông tin bạn đã gửi để bạn tiện đối chiếu.",
		Rows: leadRows(l, false), Steps: []mailRow{{K: "1", V: "Chúng tôi xem nhu cầu và chuẩn bị phương án phù hợp."}, {K: "2", V: "Chuyên viên gọi cho bạn để trao đổi chi tiết, cho xem demo."}, {K: "3", V: "Bạn nhận báo giá theo đúng phạm vi và các bước tiếp theo."}}, Sign: "Trân trọng,",
		CTA: "Xem sản phẩm 3RDHub", URL: b.Site + "/san-pham", Note: "Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email."}
	html = renderMail(d)
	text = "Cảm ơn " + l.Name + "!\n\nChúng tôi đã nhận được yêu cầu của bạn và sẽ liên hệ sớm.\n\n" + b.Company + " · " + b.Hotline + " · " + b.Email + "\n"
	return
}

func botText(l leadRow, cms string) string {
	var t strings.Builder
	fmt.Fprintf(&t, "🔔 Yêu cầu mới #%d trên 3RDHub Vietnam\n\n👤 %s\n📞 %s\n", l.ID, l.Name, l.Phone)
	if l.Email != "" {
		t.WriteString("✉️ " + l.Email + "\n")
	}
	if l.Company != "" {
		t.WriteString("🏢 " + l.Company + "\n")
	}
	if l.Need != "" {
		t.WriteString("🎯 " + l.Need + "\n")
	}
	if l.Message != "" {
		t.WriteString("\n💬 " + l.Message + "\n")
	}
	t.WriteString("\nXem trong CMS: " + cms + "/#leads")
	return t.String()
}

func cmsURL(base string) string {
	u, err := url.Parse(base)
	if err != nil || u.Host == "" {
		return base
	}
	if !strings.HasPrefix(u.Host, "cms.") {
		u.Host = "cms." + u.Host
	}
	return u.String()
}

// dispatchLead gửi mọi thông báo đã bật cho một yêu cầu mới. Chạy nền, lỗi được ghi vào nhật ký gửi (xem trong CMS).
func (a *App) dispatchLead(l leadRow, base string) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	b := a.brandInfo(ctx, base)
	cms := cmsURL(b.Site)
	s := a.loadSMTP(ctx)
	if s.NotifyLeads && s.PassEnc != "" {
		to := splitList(s.NotifyTo)
		if len(to) == 0 {
			to = []string{s.FromEmail}
		}
		sub, txt, html := staffMail(b, l, cms)
		a.logNotify(ctx, "Email đội ngũ", strings.Join(to, ", "), a.sendMailReply(ctx, to, l.Email, sub, txt, html))
	}
	if s.ConfirmCustomer && s.PassEnc != "" && l.Email != "" {
		sub, txt, html := customerMail(b, l)
		a.logNotify(ctx, "Email khách", l.Email, a.sendMailReply(ctx, []string{l.Email}, b.Email, sub, txt, html))
	}
	z := a.loadZalo(ctx)
	if z.BotOn && z.BotToken != "" {
		a.logNotify(ctx, "Zalo Bot", z.BotChats, a.zaloBotSend(ctx, z, botText(l, cms)))
	}
}

func sampleLead() leadRow {
	return leadRow{ID: 1024, TS: time.Now().Unix(), Name: "Nguyễn Minh Anh", Phone: "0901 234 567", Email: "minhanh@example.com", Company: "Công ty ABC", Need: "Nhận báo giá hệ thống", Message: "Tôi quan tâm đến gói Self-host (25tr).", Lang: "vi"}
}

// siteBase là địa chỉ website chính suy từ yêu cầu tới trang quản trị (cms.<tên miền> -> <tên miền>).
func siteBase(r *http.Request) string {
	h := strings.TrimPrefix(strings.ToLower(r.Host), "cms.")
	if secure(r) {
		return "https://" + h
	}
	return "http://" + h
}
