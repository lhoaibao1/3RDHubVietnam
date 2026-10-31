package main

// Zalo OA tự kết nối (không qua 3RDHub): chủ website nhập App ID và khoá của ứng dụng Zalo trong CMS, bấm "Kết nối",
// đăng nhập Zalo bằng tài khoản quản trị OA và đồng ý cấp quyền. Zalo chuyển về /api/zalo/callback kèm mã, backend đổi
// mã lấy access token và refresh token (OAuth v4 có PKCE) rồi tự làm mới khi sắp hết hạn.
// Mọi khoá và token được mã hoá (AES-GCM) trong CSDL; trình duyệt không bao giờ nhận lại chúng, log không ghi chúng.

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var zaloOAuthBase = "https://oauth.zaloapp.com" // đổi được trong test

type zaloOwn struct {
	AppID       string
	AppSecret   string
	OASecret    string // OA Secret Key: khoá ký webhook
	Access      string
	Refresh     string
	Exp         int64
	OAID        string
	ConnectedAt int64
	Public      bool // hiện mã và nút Zalo OA cho khách sau khi gửi form
}

// zaloOwnRaw là dạng lưu trong CSDL: mọi khoá và token đều đã mã hoá.
type zaloOwnRaw struct {
	AppID       string `json:"app_id"`
	AppSecret   string `json:"app_secret"`
	OASecret    string `json:"oa_secret"`
	Access      string `json:"access"`
	Refresh     string `json:"refresh"`
	Exp         int64  `json:"exp"`
	OAID        string `json:"oa_id"`
	ConnectedAt int64  `json:"connected_at"`
	Public      bool   `json:"public"`
}

var zaloNumRe = regexp.MustCompile(`^[0-9]{6,32}$`)
var zaloSecretRe = regexp.MustCompile(`^[\x21-\x7E]{8,200}$`)

// ownGet trả bản sao cấu hình tự kết nối (nạp từ CSDL lần đầu rồi giữ trong bộ nhớ).
func (z *zaloOA) ownGet() zaloOwn {
	if z == nil || z.app == nil {
		return zaloOwn{}
	}
	z.ownMu.Lock()
	defer z.ownMu.Unlock()
	if !z.ownLoaded {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		z.own, _ = z.app.zaloOwnRead(ctx)
		z.ownLoaded = true
	}
	return z.own
}

func (z *zaloOA) ownSet(o zaloOwn) {
	z.ownMu.Lock()
	z.own, z.ownLoaded = o, true
	z.ownMu.Unlock()
}

// publicOn: có hiện mã Zalo cho khách không (bật trong CMS hoặc bằng biến môi trường ZALO_OA_PUBLIC=1).
func (z *zaloOA) publicOn() bool { return z.public || z.ownGet().Public }

func (z *zaloOA) ownConnected() bool { return z.ownGet().Refresh != "" }

// Giá trị đang dùng: cấu hình trong CMS ưu tiên hơn biến môi trường.
func (z *zaloOA) appIDv() string {
	if o := z.ownGet(); o.AppID != "" {
		return o.AppID
	}
	return z.appID
}
func (z *zaloOA) secretv() string {
	if o := z.ownGet(); o.OASecret != "" {
		return o.OASecret
	}
	return z.secret
}
func (z *zaloOA) oaIDv() string {
	if o := z.ownGet(); o.OAID != "" {
		return o.OAID
	}
	return z.oaID
}

func (a *App) zaloOwnRead(ctx context.Context) (zaloOwn, error) {
	var raw zaloOwnRaw
	var o zaloOwn
	if ok, err := kvGet(ctx, a.pool, "zalo_own", &raw); err != nil || !ok {
		return o, err
	}
	o.AppID, o.OAID, o.Exp, o.ConnectedAt, o.Public = raw.AppID, raw.OAID, raw.Exp, raw.ConnectedAt, raw.Public
	var err error
	for _, p := range []struct {
		src string
		dst *string
	}{{raw.AppSecret, &o.AppSecret}, {raw.OASecret, &o.OASecret}, {raw.Access, &o.Access}, {raw.Refresh, &o.Refresh}} {
		if *p.dst, err = a.unseal(p.src); err != nil {
			return zaloOwn{}, errors.New("không giải mã được khoá Zalo đã lưu")
		}
	}
	return o, nil
}

func (a *App) zaloOwnWrite(ctx context.Context, o zaloOwn) error {
	raw := zaloOwnRaw{AppID: o.AppID, OAID: o.OAID, Exp: o.Exp, ConnectedAt: o.ConnectedAt, Public: o.Public}
	var err error
	for _, p := range []struct {
		src string
		dst *string
	}{{o.AppSecret, &raw.AppSecret}, {o.OASecret, &raw.OASecret}, {o.Access, &raw.Access}, {o.Refresh, &raw.Refresh}} {
		if *p.dst, err = a.seal(p.src); err != nil {
			return err
		}
	}
	if err := kvSetPool(ctx, a.pool, "zalo_own", raw); err != nil {
		return err
	}
	a.zoa.ownSet(o)
	return nil
}

// ---- gọi oauth.zaloapp.com

type zaloTok struct {
	Access, Refresh string
	ExpiresIn       int64
}

func (z *zaloOA) oauthToken(ctx context.Context, appSecret string, form url.Values) (zaloTok, error) {
	var t zaloTok
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, zaloOAuthBase+"/v4/oa/access_token", strings.NewReader(form.Encode()))
	if err != nil {
		return t, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("secret_key", appSecret)
	res, err := z.hc.Do(req)
	if err != nil {
		return t, errors.New("không gọi được máy chủ đăng nhập của Zalo")
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 64*1024))
	var r struct {
		Access  string          `json:"access_token"`
		Refresh string          `json:"refresh_token"`
		Expires json.RawMessage `json:"expires_in"`
		Err     json.RawMessage `json:"error"`
		Name    string          `json:"error_name"`
		Reason  string          `json:"error_reason"`
		Desc    string          `json:"error_description"`
		Msg     string          `json:"message"`
	}
	_ = json.Unmarshal(raw, &r)
	if r.Access != "" && r.Refresh != "" { // có token thì coi là thành công dù Zalo kèm mã cảnh báo
		t.Access, t.Refresh = r.Access, r.Refresh
		t.ExpiresIn, _ = strconv.ParseInt(strings.Trim(string(r.Expires), `"`), 10, 64)
		if t.ExpiresIn <= 0 {
			t.ExpiresIn = 3600
		}
		return t, nil
	}
	why := strings.TrimSpace(r.Desc + " " + r.Reason + " " + r.Msg)
	if why == "" {
		why = r.Name
	}
	return t, fmt.Errorf("Zalo từ chối (%s): %s", strings.Trim(string(r.Err), `"`), truncate(why, 200))
}

// zaloOwnToken trả access token của tài khoản đã kết nối, tự làm mới nếu sắp hết hạn. used=false: chưa kết nối.
func (a *App) zaloOwnToken(ctx context.Context, force bool) (tok string, exp time.Time, oa string, used bool, err error) {
	z := a.zoa
	o := z.ownGet()
	if o.Refresh == "" {
		return "", time.Time{}, "", false, nil
	}
	if !force && o.Access != "" && time.Now().Before(time.Unix(o.Exp, 0).Add(-5*time.Minute)) {
		return o.Access, time.Unix(o.Exp, 0), o.OAID, true, nil
	}
	if o.AppID == "" || o.AppSecret == "" {
		return "", time.Time{}, "", true, errors.New("thiếu App ID hoặc App Secret của ứng dụng Zalo")
	}
	t, err := z.oauthToken(ctx, o.AppSecret, url.Values{"refresh_token": {o.Refresh}, "app_id": {o.AppID}, "grant_type": {"refresh_token"}})
	if err != nil {
		return "", time.Time{}, o.OAID, true, fmt.Errorf("làm mới token Zalo OA lỗi: %w (hãy bấm Kết nối lại)", err)
	}
	o.Access, o.Refresh, o.Exp = t.Access, t.Refresh, time.Now().Add(time.Duration(t.ExpiresIn)*time.Second).Unix() // refresh token chỉ dùng một lần: lưu bản mới ngay
	if err := a.zaloOwnWrite(ctx, o); err != nil {
		return "", time.Time{}, o.OAID, true, err
	}
	return o.Access, time.Unix(o.Exp, 0), o.OAID, true, nil
}

// ---- kết nối

func randB64(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// siteOrigin: địa chỉ gốc của website công khai (bỏ tiền tố cms. của trang quản trị).
func (a *App) siteOrigin(r *http.Request) string {
	if a.cfg.SiteURL != "" {
		return strings.TrimRight(a.cfg.SiteURL, "/")
	}
	sch := "http"
	if secure(r) {
		sch = "https"
	}
	return sch + "://" + strings.TrimPrefix(r.Host, "cms.")
}

type zaloPending struct {
	State    string `json:"state"`
	Verifier string `json:"verifier"`
	Redirect string `json:"redirect"`
	Exp      int64  `json:"exp"`
}

func (a *App) zaloConnectURL(ctx context.Context, r *http.Request) (string, error) {
	o := a.zoa.ownGet()
	if o.AppID == "" || o.AppSecret == "" {
		return "", bad("Nhập App ID và App Secret của ứng dụng Zalo, bấm Lưu, rồi mới kết nối")
	}
	p := zaloPending{State: randB64(18), Verifier: randB64(36), Redirect: a.siteOrigin(r) + "/api/zalo/callback", Exp: time.Now().Add(10 * time.Minute).Unix()}
	if err := kvSetPool(ctx, a.pool, "zalo_oauth_pending", p); err != nil {
		return "", err
	}
	sum := sha256.Sum256([]byte(p.Verifier))
	q := url.Values{"app_id": {o.AppID}, "redirect_uri": {p.Redirect}, "state": {p.State}, "code_challenge": {base64.RawURLEncoding.EncodeToString(sum[:])}, "code_challenge_method": {"S256"}}
	return zaloOAuthBase + "/v4/oa/permission?" + q.Encode(), nil
}

const zaloResultPage = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Zalo OA</title>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F3F1EC;font:16px/1.6 system-ui,sans-serif;color:#0B2A6F"><div style="max-width:480px;margin:20px;padding:32px;border-radius:24px;background:#fff;box-shadow:0 30px 60px -36px rgba(11,42,111,.4)">
<h1 style="margin:0 0 8px;font-size:22px">%s</h1><p style="margin:0;color:#5B6279">%s</p></div></body></html>`

// zaloCallback: Zalo chuyển trình duyệt về đây sau khi chủ OA đồng ý. Không cần cookie đăng nhập (Zalo là trang khác nên cookie
// SameSite không được gửi); chỉ chấp nhận khi state khớp bản đang chờ, dùng một lần, trong 10 phút.
func (a *App) zaloCallback(w http.ResponseWriter, r *http.Request) {
	fail := func(msg string) {
		a.send(w, r, 400, []byte(fmt.Sprintf(zaloResultPage, "Chưa kết nối được Zalo OA", html.EscapeString(msg))), "text/html; charset=utf-8", noStore)
	}
	ctx := r.Context()
	q := r.URL.Query()
	var p zaloPending
	ok, _ := kvGet(ctx, a.pool, "zalo_oauth_pending", &p)
	if !ok || p.State == "" || time.Now().Unix() > p.Exp {
		fail("Phiên kết nối đã hết hạn hoặc không tồn tại. Quay lại CMS và bấm Kết nối lại.")
		return
	}
	if subtle.ConstantTimeCompare([]byte(q.Get("state")), []byte(p.State)) != 1 {
		fail("Mã bảo mật (state) không khớp. Quay lại CMS và bấm Kết nối lại.")
		return
	}
	kvSetPool(ctx, a.pool, "zalo_oauth_pending", zaloPending{}) // dùng một lần
	code := q.Get("code")
	if code == "" {
		fail("Zalo không trả mã cấp quyền (có thể bạn đã bấm Từ chối).")
		return
	}
	o := a.zoa.ownGet()
	if o.AppID == "" || o.AppSecret == "" {
		fail("Chưa có App ID và App Secret trong CMS.")
		return
	}
	t, err := a.zoa.oauthToken(ctx, o.AppSecret, url.Values{"code": {code}, "app_id": {o.AppID}, "grant_type": {"authorization_code"}, "code_verifier": {p.Verifier}})
	if err != nil {
		fail(err.Error())
		return
	}
	o.Access, o.Refresh, o.Exp, o.ConnectedAt = t.Access, t.Refresh, time.Now().Add(time.Duration(t.ExpiresIn)*time.Second).Unix(), time.Now().Unix()
	if oa := q.Get("oa_id"); zaloNumRe.MatchString(oa) {
		o.OAID = oa
	}
	if err := a.zaloOwnWrite(ctx, o); err != nil {
		fail("Không lưu được token vào máy chủ.")
		return
	}
	a.zoa.mu.Lock()
	a.zoa.tok, a.zoa.tokErr = "", ""
	a.zoa.mu.Unlock()
	cms := a.cfg.CMSURL(r)
	a.send(w, r, 200, []byte(fmt.Sprintf(zaloResultPage, "Đã kết nối Zalo OA", `Bạn có thể đóng trang này và quay lại <a href="`+html.EscapeString(cms)+`" style="color:#E2531A;font-weight:800">CMS</a>.`)), "text/html; charset=utf-8", noStore)
}

// CMSURL: địa chỉ trang quản trị để quay lại sau khi kết nối.
func (c Config) CMSURL(r *http.Request) string {
	sch := "http"
	if secure(r) {
		sch = "https"
	}
	host := r.Host
	if !strings.HasPrefix(host, "cms.") {
		host = "cms." + host
	}
	if len(c.CMSHosts) > 0 {
		host = c.CMSHosts[0]
	}
	return sch + "://" + host + "/"
}

// ---- API quản trị

func (a *App) zaloOwnAdmin(ctx context.Context, r *http.Request, sub string) (any, bool, error) {
	z := a.zoa
	switch {
	case sub == "zalo-oa/app" && r.Method == http.MethodPut:
		d, err := readJSON(r, 4096)
		if err != nil {
			return nil, true, err
		}
		o := z.ownGet()
		appID, _ := strip(d["app_id"], 40, "App ID")
		if !zaloNumRe.MatchString(appID) {
			return nil, true, bad("App ID chỉ gồm số (lấy ở trang ứng dụng trên developers.zalo.me)")
		}
		oaID, _ := strip(d["oa_id"], 40, "OA ID")
		if oaID != "" && !zaloNumRe.MatchString(oaID) {
			return nil, true, bad("OA ID chỉ gồm số")
		}
		changed := appID != o.AppID
		if s, _ := d["app_secret"].(string); strings.TrimSpace(s) != "" {
			s = strings.TrimSpace(s)
			if !zaloSecretRe.MatchString(s) {
				return nil, true, bad("App Secret không hợp lệ (8 đến 200 ký tự, không có khoảng trắng)")
			}
			changed = changed || s != o.AppSecret
			o.AppSecret = s
		}
		if s, _ := d["oa_secret"].(string); strings.TrimSpace(s) != "" {
			s = strings.TrimSpace(s)
			if !zaloSecretRe.MatchString(s) {
				return nil, true, bad("OA Secret Key không hợp lệ (8 đến 200 ký tự, không có khoảng trắng)")
			}
			o.OASecret = s
		}
		o.AppID = appID
		if v, ok := d["public"].(bool); ok {
			o.Public = v
		}
		if oaID != "" {
			o.OAID = oaID
		}
		if changed { // đổi ứng dụng thì token cũ không còn dùng được
			o.Access, o.Refresh, o.Exp, o.ConnectedAt = "", "", 0, 0
		}
		if err := a.zaloOwnWrite(ctx, o); err != nil {
			return nil, true, err
		}
		return a.zaloOAStatus(ctx), true, nil
	case sub == "zalo-oa/connect" && r.Method == http.MethodPost:
		if !a.rl.ok("zalocn", clientIP(r), 10, 10*time.Minute) {
			return nil, true, bad("Thử quá nhiều lần, chờ vài phút")
		}
		u, err := a.zaloConnectURL(ctx, r)
		if err != nil {
			return nil, true, err
		}
		return map[string]any{"url": u}, true, nil
	case sub == "zalo-oa/disconnect" && r.Method == http.MethodPost:
		o := z.ownGet()
		o.Access, o.Refresh, o.Exp, o.ConnectedAt = "", "", 0, 0
		if err := a.zaloOwnWrite(ctx, o); err != nil {
			return nil, true, err
		}
		z.mu.Lock()
		z.tok, z.tokErr = "", ""
		z.mu.Unlock()
		return a.zaloOAStatus(ctx), true, nil
	}
	return nil, false, nil
}

func (a *App) zaloOwnStatus(r *http.Request) map[string]any {
	o := a.zoa.ownGet()
	st := map[string]any{"app_id": o.AppID, "has_secret": o.AppSecret != "", "has_oa_secret": o.OASecret != "", "connected": o.Refresh != "", "oa_id": o.OAID, "connected_at": o.ConnectedAt, "public": a.zoa.publicOn()}
	if r != nil {
		st["callback_url"] = a.siteOrigin(r) + "/api/zalo/callback"
		st["webhook_url"] = a.siteOrigin(r) + "/api/zalo/webhook"
	}
	return st
}

var _ = hex.EncodeToString
