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
// tin nhắn Zalo Bot cho đội ngũ và tin ZNS (Zalo OA) gửi tới số điện thoại của khách. Mỗi kênh bật/tắt riêng trong CMS.

/* ---------------- cấu hình Zalo ---------------- */

type zaloCfg struct {
	BotOn      bool   `json:"bot_on"`
	BotToken   string `json:"bot_token,omitempty"` // mã hoá
	BotChats   string `json:"bot_chats"`           // chat_id, cách nhau bởi dấu phẩy
	ZnsOn      bool   `json:"zns_on"`
	AppID      string `json:"app_id"`
	Secret     string `json:"secret,omitempty"`  // mã hoá
	Refresh    string `json:"refresh,omitempty"` // mã hoá; Zalo trả refresh token mới mỗi lần làm mới, luôn lưu lại
	Access     string `json:"access,omitempty"`  // mã hoá
	AccessExp  int64  `json:"access_exp,omitempty"`
	TemplateID string `json:"template_id"`
	Params     string `json:"params"` // JSON: tên tham số của mẫu ZNS -> nội dung, ví dụ {"customer_name":"{name}"}
}

var (
	zaloMu      sync.Mutex
	zaloBotURL  = "https://bot-api.zaloplatforms.com"
	zaloOAuth   = "https://oauth.zaloapp.com/v4/oa/access_token"
	zaloZNSURL  = "https://business.openapi.zalo.me/message/template"
	digitsRe    = regexp.MustCompile(`\D`)
	zaloIDRe    = regexp.MustCompile(`^[A-Za-z0-9_.:-]{1,200}$`)
	httpZalo    = &http.Client{Timeout: 15 * time.Second}
	placeholder = regexp.MustCompile(`\{(name|phone|email|company|need|message|date|id)\}`)
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
		"zns_on": c.ZnsOn, "app_id": c.AppID, "template_id": c.TemplateID, "params": c.Params,
		"has_secret": c.Secret != "", "has_refresh": c.Refresh != "",
	}
}

func cleanZalo(a *App, d map[string]any, c zaloCfg) (zaloCfg, error) {
	c.BotOn = truthy(d["bot_on"])
	c.ZnsOn = truthy(d["zns_on"])
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
	if c.AppID, err = strip(d["app_id"], 40, "App ID"); err != nil {
		return c, err
	}
	if c.AppID != "" && !regexp.MustCompile(`^[0-9]{3,30}$`).MatchString(c.AppID) {
		return c, bad("App ID chỉ gồm số")
	}
	if c.TemplateID, err = strip(d["template_id"], 60, "Template ID"); err != nil {
		return c, err
	}
	if c.TemplateID != "" && !zaloIDRe.MatchString(c.TemplateID) {
		return c, bad("Template ID không hợp lệ")
	}
	if c.Params, err = strip(d["params"], 2000, "Tham số mẫu ZNS"); err != nil {
		return c, err
	}
	if c.Params != "" {
		var m map[string]string
		if json.Unmarshal([]byte(c.Params), &m) != nil {
			return c, bad(`Tham số mẫu ZNS phải là JSON dạng {"ten_tham_so": "{name}"}`)
		}
	}
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
		switch field {
		case "bot":
			c.BotToken = enc
		case "secret":
			c.Secret = enc
		case "refresh":
			c.Refresh, c.Access, c.AccessExp = enc, "", 0
		}
		return nil
	}
	if err := set("bot", "bot_token", 300); err != nil {
		return c, err
	}
	if err := set("secret", "secret", 200); err != nil {
		return c, err
	}
	if err := set("refresh", "refresh_token", 2000); err != nil {
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

/* ---------------- Zalo OA: ZNS ---------------- */

// zaloAccess trả access token còn hạn, tự làm mới bằng refresh token (và lưu refresh token mới Zalo trả về).
func (a *App) zaloAccess(ctx context.Context) (string, error) {
	zaloMu.Lock()
	defer zaloMu.Unlock()
	c := a.loadZalo(ctx)
	if c.Access != "" && c.AccessExp > time.Now().Unix()+120 {
		return a.unseal(c.Access)
	}
	secret, _ := a.unseal(c.Secret)
	refresh, _ := a.unseal(c.Refresh)
	if c.AppID == "" || secret == "" || refresh == "" {
		return "", errors.New("chưa đủ App ID, Secret key và Refresh token của Zalo OA")
	}
	f := url.Values{"app_id": {c.AppID}, "grant_type": {"refresh_token"}, "refresh_token": {refresh}}
	req, _ := http.NewRequestWithContext(ctx, "POST", zaloOAuth, strings.NewReader(f.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("secret_key", secret)
	resp, err := httpZalo.Do(req)
	if err != nil {
		return "", fmt.Errorf("không gọi được Zalo OAuth: %w", err)
	}
	defer resp.Body.Close()
	var r struct {
		Access  string `json:"access_token"`
		Refresh string `json:"refresh_token"`
		Expires any    `json:"expires_in"`
		Error   any    `json:"error"`
		Message string `json:"message"`
		ErrName string `json:"error_name"`
	}
	json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&r)
	if r.Access == "" {
		return "", fmt.Errorf("Zalo OA không cấp access token (%v %s%s). Lấy lại Refresh token mới trong trang developers.zalo.me", r.Error, r.Message, r.ErrName)
	}
	exp := int64(25 * 3600)
	switch v := r.Expires.(type) {
	case string:
		fmt.Sscan(v, &exp)
	case float64:
		exp = int64(v)
	}
	if c.Access, err = a.seal(r.Access); err != nil {
		return "", err
	}
	if r.Refresh != "" {
		if c.Refresh, err = a.seal(r.Refresh); err != nil {
			return "", err
		}
	}
	c.AccessExp = time.Now().Unix() + exp
	if err := kvSetPool(ctx, a.pool, "zalo", c); err != nil {
		return "", err
	}
	return r.Access, nil
}

// phone84 đổi số Việt Nam về dạng 84xxxxxxxxx mà ZNS yêu cầu.
func phone84(p string) string {
	d := digitsRe.ReplaceAllString(p, "")
	if strings.HasPrefix(d, "0") {
		d = "84" + d[1:]
	}
	return d
}

func fillParams(tpl string, l leadRow) map[string]string {
	m := map[string]string{}
	json.Unmarshal([]byte(tpl), &m)
	vals := map[string]string{"name": l.Name, "phone": l.Phone, "email": l.Email, "company": l.Company, "need": l.Need, "message": l.Message,
		"date": time.Unix(l.TS, 0).In(vnZone()).Format("02/01/2006"), "id": fmt.Sprintf("%d", l.ID)}
	for k, v := range m {
		m[k] = placeholder.ReplaceAllStringFunc(v, func(s string) string { return vals[s[1:len(s)-1]] })
		if r := []rune(m[k]); len(r) > 100 { // giới hạn độ dài tham số của ZNS
			m[k] = string(r[:100])
		}
	}
	return m
}

func (a *App) znsSend(ctx context.Context, l leadRow) error {
	c := a.loadZalo(ctx)
	if c.TemplateID == "" {
		return errors.New("chưa có Template ID của mẫu ZNS")
	}
	tok, err := a.zaloAccess(ctx)
	if err != nil {
		return err
	}
	body, _ := json.Marshal(map[string]any{"phone": phone84(l.Phone), "template_id": c.TemplateID, "template_data": fillParams(c.Params, l), "tracking_id": fmt.Sprintf("lead-%d", l.ID)})
	req, _ := http.NewRequestWithContext(ctx, "POST", zaloZNSURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("access_token", tok)
	resp, err := httpZalo.Do(req)
	if err != nil {
		return fmt.Errorf("không gọi được ZNS: %w", err)
	}
	defer resp.Body.Close()
	var r struct {
		Error   float64 `json:"error"`
		Message string  `json:"message"`
	}
	json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&r)
	if r.Error != 0 {
		return fmt.Errorf("ZNS lỗi %v: %s", r.Error, r.Message)
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

type mailRow struct{ K, V string }

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
}

var mailTpl = template.Must(template.New("m").Parse(`<!doctype html>
<html lang="{{.Lang}}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>{{.Title}}</title>
<style>
@keyframes rise{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes shine{0%{background-position:-200% 0}100%{background-position:200% 0}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
.card{animation:rise .8s cubic-bezier(.2,.8,.2,1) both}
.hero{background-size:200% 100%;animation:shine 6s linear infinite}
.cta{animation:pulse 2.4s ease-in-out infinite}
@media(max-width:620px){.wrap{width:100%!important}.pad{padding:24px 20px!important}.h1{font-size:24px!important}}
</style></head>
<body style="margin:0;padding:0;background:#F3F1EC;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0B2A6F">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">{{.Pre}}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F1EC;padding:28px 12px"><tr><td align="center">
<table role="presentation" class="wrap card" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px -30px rgba(11,42,111,.45)">
<tr><td class="hero" bgcolor="#0B2A6F" style="background:#0B2A6F;background-image:linear-gradient(120deg,#0B2A6F 0%,#2A1C6B 45%,#FF6A2B 80%,#0B2A6F 100%);padding:30px 36px 34px">
  <table role="presentation" width="100%"><tr>
    <td><img src="{{.B.Logo}}" width="40" height="40" alt="3RDHub" style="display:inline-block;vertical-align:middle;border-radius:10px;border:0"><span style="display:inline-block;vertical-align:middle;margin-left:10px;font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-.01em">3RDHub <span style="color:#FFB38E">Vietnam</span></span></td>
  </tr></table>
  {{if .Kicker}}<div style="margin-top:26px;display:inline-block;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.25);color:#ffffff;border-radius:999px;padding:5px 12px;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase">{{.Kicker}}</div>{{end}}
  <div class="h1" style="margin-top:14px;font-size:28px;line-height:1.25;font-weight:800;color:#ffffff">{{.Title}}</div>
</td></tr>
<tr><td class="pad" style="padding:30px 36px 8px">
  <p style="margin:0 0 20px;font-size:15.5px;line-height:1.65;color:#3B4563">{{.Lead}}</p>
  {{if .Rows}}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F1;border-radius:18px;border:1px solid #ECE7DE">
    {{range .Rows}}<tr><td style="padding:12px 18px;font-size:13px;color:#6B7390;width:130px;vertical-align:top;border-bottom:1px solid #ECE7DE">{{.K}}</td><td style="padding:12px 18px;font-size:14.5px;font-weight:700;color:#0B2A6F;border-bottom:1px solid #ECE7DE;white-space:pre-line">{{.V}}</td></tr>{{end}}
  </table>{{end}}
  {{if .Steps}}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px">
    {{range $i, $s := .Steps}}<tr><td width="44" valign="top" style="padding:0 0 16px"><div style="width:32px;height:32px;border-radius:50%;background:#FF6A2B;color:#ffffff;font-weight:800;font-size:14px;line-height:32px;text-align:center">{{$s.K}}</div></td><td valign="top" style="padding:5px 0 16px;font-size:14.5px;line-height:1.55;color:#3B4563">{{$s.V}}</td></tr>{{end}}
  </table>{{end}}
  {{if .CTA}}<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px"><tr><td class="cta" bgcolor="#FF6A2B" style="border-radius:999px;background:#FF6A2B;box-shadow:0 12px 24px -12px rgba(255,106,43,.9)"><a href="{{.URL}}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:800;color:#ffffff;text-decoration:none;border-radius:999px">{{.CTA}} →</a></td></tr></table>{{end}}
  {{if .Note}}<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#6B7390">{{.Note}}</p>{{end}}
</td></tr>
<tr><td style="padding:26px 36px 30px">
  <table role="presentation" width="100%" style="border-top:1px solid #ECE7DE"><tr><td style="padding-top:18px;font-size:12.5px;line-height:1.7;color:#6B7390">
    <b style="color:#0B2A6F">{{.B.Company}}</b><br>{{if .B.Address}}{{.B.Address}}<br>{{end}}
    Hotline <a href="tel:{{.B.Tel}}" style="color:#E2531A;text-decoration:none;font-weight:700">{{.B.Hotline}}</a> · <a href="mailto:{{.B.Email}}" style="color:#E2531A;text-decoration:none;font-weight:700">{{.B.Email}}</a><br>
    <a href="{{.B.Site}}" style="color:#0B2A6F;font-weight:700">3rdhubvietnam.tech</a>{{if .B.Parent}} · <a href="{{.B.Parent}}" style="color:#0B2A6F;font-weight:700">3rdvn.io.vn</a>{{end}}
  </td></tr></table>
</td></tr>
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

func leadRows(l leadRow, en bool) []mailRow {
	lb := func(vi, e string) string {
		if en {
			return e
		}
		return vi
	}
	rows := []mailRow{{lb("Họ tên", "Name"), l.Name}, {lb("Điện thoại", "Phone"), l.Phone}}
	if l.Email != "" {
		rows = append(rows, mailRow{"Email", l.Email})
	}
	if l.Company != "" {
		rows = append(rows, mailRow{lb("Công ty", "Company"), l.Company})
	}
	if l.Need != "" {
		rows = append(rows, mailRow{lb("Nhu cầu", "Interest"), l.Need})
	}
	if l.Message != "" {
		rows = append(rows, mailRow{lb("Nội dung", "Message"), l.Message})
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
	rows := append(leadRows(l, false), mailRow{"Thời gian", time.Unix(l.TS, 0).In(vnZone()).Format("15:04 · 02/01/2006")})
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
		d := mailData{B: b, Lang: "en", Pre: "Thanks " + l.Name + ", our team will contact you shortly.", Kicker: "Request received", Title: "Thank you, " + l.Name + "!",
			Lead: "We have received your request. A 3RDVN Technology consultant will reach out to you during business hours. Here is what you sent us:",
			Rows: leadRows(l, true), Steps: []mailRow{{"1", "We review your needs and prepare suitable options."}, {"2", "A consultant calls you to discuss details and show a demo."}, {"3", "You receive a scoped quote and next steps."}},
			CTA: "Explore 3RDHub", URL: b.Site + "/san-pham", Note: "If you did not submit this request, simply ignore this email."}
		html = renderMail(d)
		text = "Thank you, " + l.Name + "!\n\nWe have received your request and will contact you shortly.\n\n" + b.Company + " · " + b.Hotline + " · " + b.Email + "\n"
		return
	}
	subject = "3RDHub Vietnam đã nhận yêu cầu của bạn"
	d := mailData{B: b, Lang: "vi", Pre: "Cảm ơn " + l.Name + ", đội ngũ 3RDVN Technology sẽ liên hệ bạn sớm.", Kicker: "Đã nhận yêu cầu", Title: "Cảm ơn " + l.Name + "!",
		Lead: "Chúng tôi đã nhận được yêu cầu của bạn. Chuyên viên 3RDVN Technology sẽ liên hệ trong giờ làm việc. Thông tin bạn đã gửi:",
		Rows: leadRows(l, false), Steps: []mailRow{{"1", "Chúng tôi xem nhu cầu và chuẩn bị phương án phù hợp."}, {"2", "Chuyên viên gọi cho bạn để trao đổi chi tiết, cho xem demo."}, {"3", "Bạn nhận báo giá theo đúng phạm vi và các bước tiếp theo."}},
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
	if z.ZnsOn && z.Refresh != "" {
		a.logNotify(ctx, "Zalo OA (ZNS)", phone84(l.Phone), a.znsSend(ctx, l))
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
