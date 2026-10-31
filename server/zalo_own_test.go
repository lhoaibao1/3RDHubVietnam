package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"testing"
)

// fakeOAuth giả lập oauth.zaloapp.com (đổi mã, làm mới token) và Open API (gửi tin).
type fakeOAuth struct {
	mu        sync.Mutex
	verifier  string // code_challenge nhận được lúc xin quyền
	forms     []url.Values
	secrets   []string
	n         int
	refreshOK map[string]bool // refresh token còn hợp lệ (dùng một lần)
	sent      []string
	imgs      []string // địa chỉ ảnh đính kèm trong các tin đã gửi
	rejectImg bool     // Zalo từ chối tin có ảnh (lỗi tham số)
}

func newFakeOAuth(t *testing.T) (*fakeOAuth, *httptest.Server) {
	f := &fakeOAuth{refreshOK: map[string]bool{}}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		switch r.URL.Path {
		case "/oauth/v4/oa/access_token":
			r.ParseForm()
			f.forms = append(f.forms, r.PostForm)
			f.secrets = append(f.secrets, r.Header.Get("secret_key"))
			if r.Header.Get("secret_key") != "khoa-bi-mat-app" {
				w.Write([]byte(`{"error":-14002,"error_name":"Invalid secret key","error_reason":"secret_key sai"}`))
				return
			}
			switch r.PostForm.Get("grant_type") {
			case "authorization_code":
				if r.PostForm.Get("code") != "ma-cap-quyen" {
					w.Write([]byte(`{"error":-14003,"error_reason":"code sai"}`))
					return
				}
				sum := sha256.Sum256([]byte(r.PostForm.Get("code_verifier")))
				if base64.RawURLEncoding.EncodeToString(sum[:]) != f.verifier {
					w.Write([]byte(`{"error":-5009,"error_reason":"Invalid code challenge"}`))
					return
				}
			case "refresh_token":
				rt := r.PostForm.Get("refresh_token")
				if !f.refreshOK[rt] {
					w.Write([]byte(`{"error":-5011,"error_reason":"Invalid refresh token"}`))
					return
				}
				delete(f.refreshOK, rt) // dùng một lần
			}
			f.n++
			f.refreshOK[fmt.Sprintf("rt-%d", f.n)] = true
			fmt.Fprintf(w, `{"access_token":"at-%d","refresh_token":"rt-%d","expires_in":"3600"}`, f.n, f.n)
		case "/v3.0/oa/message/cs":
			var b struct {
				Message struct {
					Text       string `json:"text"`
					Attachment struct {
						Payload struct {
							TemplateType string `json:"template_type"`
							Elements     []struct {
								Type string `json:"media_type"`
								URL  string `json:"url"`
							} `json:"elements"`
						} `json:"payload"`
					} `json:"attachment"`
				} `json:"message"`
			}
			json.NewDecoder(r.Body).Decode(&b)
			if els := b.Message.Attachment.Payload.Elements; len(els) > 0 {
				if f.rejectImg {
					w.Write([]byte(`{"error":-201,"message":"params invalid"}`))
					return
				}
				if b.Message.Attachment.Payload.TemplateType != "media" || els[0].Type != "image" {
					w.Write([]byte(`{"error":-201,"message":"sai mẫu"}`))
					return
				}
				f.imgs = append(f.imgs, els[0].URL)
			}
			f.sent = append(f.sent, r.Header.Get("access_token")+"|"+b.Message.Text)
			w.Write([]byte(`{"error":0,"message":"Success","data":{"message_id":"m1"}}`))
		default:
			w.WriteHeader(404)
		}
	}))
	t.Cleanup(srv.Close)
	return f, srv
}

func TestZaloOwnOAuth(t *testing.T) {
	a := testApp(t)
	f, srv := newFakeOAuth(t)
	a.zoa = newZaloOA(Config{ZaloAPIBase: srv.URL})
	a.zoa.app = a
	t.Cleanup(func() { zaloOpenAPI, zaloOAuthBase = "https://openapi.zalo.me", "https://oauth.zaloapp.com" })
	ck := login(t, a)
	h := map[string]string{"X-CMS": "1", "Cookie": ck, "Content-Type": "application/json", "X-Forwarded-Proto": "https"}
	adm := func(method, path, body string) resp { return do(a, method, cms, "/api/admin/"+path, []byte(body), h) }

	if r := adm("POST", "zalo-oa/connect", `{}`); r.code != 400 {
		t.Fatalf("chưa nhập App ID thì không kết nối được: %d", r.code)
	}
	if r := adm("PUT", "zalo-oa/app", `{"app_id":"abc","app_secret":"khoa-bi-mat-app"}`); r.code != 400 {
		t.Fatalf("App ID sai định dạng: %d", r.code)
	}
	r := adm("PUT", "zalo-oa/app", `{"app_id":"3689777608400566243","app_secret":"khoa-bi-mat-app","oa_secret":"khoa-oa-webhook"}`)
	own := r.json(t)["own"].(map[string]any)
	if r.code != 200 || own["has_secret"] != true || own["connected"] != false || strings.Contains(string(r.body), "khoa-bi-mat-app") || strings.Contains(string(r.body), "khoa-oa-webhook") {
		t.Fatalf("khoá không được lộ ra khi đọc lại: %d %s", r.code, r.body)
	}
	if own["callback_url"] != "https://example.vn/api/zalo/callback" && !strings.HasSuffix(own["callback_url"].(string), "/api/zalo/callback") {
		t.Fatalf("callback: %v", own["callback_url"])
	}
	if raw := string(rawKV(t, a, "zalo_own")); strings.Contains(raw, "khoa-bi-mat-app") || strings.Contains(raw, "khoa-oa-webhook") {
		t.Fatalf("khoá phải được mã hoá trong CSDL: %s", raw)
	}

	// bấm Kết nối: URL xin quyền có app_id, state, PKCE S256
	r = adm("POST", "zalo-oa/connect", `{}`)
	u, _ := url.Parse(r.json(t)["url"].(string))
	q := u.Query()
	if r.code != 200 || !strings.HasSuffix(u.Path, "/v4/oa/permission") || q.Get("app_id") != "3689777608400566243" || q.Get("code_challenge_method") != "S256" || q.Get("state") == "" || q.Get("code_challenge") == "" || !strings.HasSuffix(q.Get("redirect_uri"), "/api/zalo/callback") {
		t.Fatalf("%d %s", r.code, r.body)
	}
	f.verifier = q.Get("code_challenge")

	cb := func(state, code string) resp {
		return do(a, "GET", "example.vn", "/api/zalo/callback?code="+code+"&state="+url.QueryEscape(state)+"&oa_id=147468245835855615", nil, nil)
	}
	if r := cb("sai-state", "ma-cap-quyen"); r.code != 400 {
		t.Fatalf("state sai phải bị từ chối: %d", r.code)
	}
	if r := cb(q.Get("state"), "ma-cap-quyen"); r.code != 200 || !strings.Contains(string(r.body), "Đã kết nối Zalo OA") {
		t.Fatalf("callback đúng: %d %s", r.code, r.body)
	}
	if r := cb(q.Get("state"), "ma-cap-quyen"); r.code != 400 {
		t.Fatalf("state chỉ dùng một lần: %d", r.code)
	}
	last := f.forms[len(f.forms)-1]
	if last.Get("grant_type") != "authorization_code" || last.Get("app_id") != "3689777608400566243" || f.secrets[len(f.secrets)-1] != "khoa-bi-mat-app" {
		t.Fatalf("đổi mã sai: %v", last)
	}
	st := adm("GET", "zalo-oa", "").json(t)
	o := st["own"].(map[string]any)
	if o["connected"] != true || o["oa_id"] != "147468245835855615" || st["configured"] != true || st["webhook"] != true {
		t.Fatalf("%v", st)
	}
	if raw := string(rawKV(t, a, "zalo_own")); strings.Contains(raw, "at-1") || strings.Contains(raw, "rt-1") {
		t.Fatalf("token phải được mã hoá trong CSDL: %s", raw)
	}

	// gửi tin bằng access token của mình; token còn hạn thì không gọi làm mới
	if err := a.zoa.sendCS(t.Context(), "u1", "xin chào"); err != nil {
		t.Fatal(err)
	}
	if len(f.sent) != 1 || f.sent[0] != "at-1|xin chào" || len(f.forms) != 1 {
		t.Fatalf("%v %d", f.sent, len(f.forms))
	}
	// hết hạn thì tự làm mới bằng refresh token, lưu refresh token mới (dùng một lần)
	o2, _ := a.zaloOwnRead(t.Context())
	o2.Exp = 1
	a.zaloOwnWrite(t.Context(), o2)
	a.zoa.mu.Lock()
	a.zoa.tok = ""
	a.zoa.mu.Unlock()
	if err := a.zoa.sendCS(t.Context(), "u1", "lần hai"); err != nil {
		t.Fatal(err)
	}
	if f.sent[1] != "at-2|lần hai" || f.forms[1].Get("grant_type") != "refresh_token" || f.forms[1].Get("refresh_token") != "rt-1" {
		t.Fatalf("%v %v", f.sent, f.forms[1])
	}
	o3, _ := a.zaloOwnRead(t.Context())
	if o3.Refresh != "rt-2" {
		t.Fatalf("phải lưu refresh token mới: %s", o3.Refresh)
	}

	// webhook ký bằng OA Secret Key đã nhập trong CMS
	if !a.zoa.verify(sign("3689777608400566243", []byte(`{"a":1}`), "123", "khoa-oa-webhook"), []byte(`{"a":1}`), "123") {
		t.Fatal("chữ ký webhook theo khoá trong CMS phải hợp lệ")
	}

	// ngắt kết nối
	if r := adm("POST", "zalo-oa/disconnect", `{}`); r.code != 200 || r.json(t)["own"].(map[string]any)["connected"] != false {
		t.Fatalf("%d %s", r.code, r.body)
	}
	if a.zoa.ready() {
		t.Fatal("ngắt kết nối thì không còn sẵn sàng")
	}
}

func sign(appID string, raw []byte, ts, secret string) string {
	sum := sha256.Sum256([]byte(appID + string(raw) + ts + secret))
	return fmt.Sprintf("mac=%x", sum)
}

func rawKV(t *testing.T, a *App, key string) []byte {
	var v json.RawMessage
	if ok, err := kvGet(t.Context(), a.pool, key, &v); err != nil || !ok {
		t.Fatal(err, ok)
	}
	return v
}

func TestZaloBannerInConfirmation(t *testing.T) {
	a := testApp(t)
	f, srv := newFakeOAuth(t)
	a.cfg.SiteURL = "https://site.example"
	a.zoa = newZaloOA(Config{ZaloAPIBase: srv.URL})
	a.zoa.app = a
	t.Cleanup(func() { zaloOpenAPI, zaloOAuthBase = "https://openapi.zalo.me", "https://oauth.zaloapp.com" })
	if err := a.zaloOwnWrite(t.Context(), zaloOwn{AppID: "3689777608400566243", AppSecret: "khoa-bi-mat-app", Access: "at-0", Refresh: "rt-0", Exp: 4102444800, OAID: "1"}); err != nil {
		t.Fatal(err)
	}
	if u := a.zaloBannerURL(t.Context()); u != "https://site.example/img/zalo-banner.png" {
		t.Fatalf("banner mặc định bật: %q", u)
	}
	if st, err := a.deliverImg(t.Context(), 0, "u1", "Xin chào", a.zaloBannerURL(t.Context())); err != nil || st != "sent" {
		t.Fatalf("%s %v", st, err)
	}
	if len(f.imgs) != 1 || f.imgs[0] != "https://site.example/img/zalo-banner.png" {
		t.Fatalf("tin phải kèm ảnh logo dạng media: %v", f.imgs)
	}
	// tắt trong CMS: chỉ còn chữ
	ck := login(t, a)
	h := map[string]string{"X-CMS": "1", "Cookie": ck, "Content-Type": "application/json"}
	if r := do(a, "PUT", cms, "/api/admin/zalo-oa", []byte(`{"confirm":"","banner":false}`), h); r.code != 200 || r.json(t)["banner"] != false {
		t.Fatalf("%d %s", r.code, r.body)
	}
	if u := a.zaloBannerURL(t.Context()); u != "" {
		t.Fatalf("đã tắt: %q", u)
	}
	// Zalo từ chối ảnh: gửi lại chỉ có chữ, vẫn tính là đã gửi
	f.rejectImg = true
	n := len(f.sent)
	if st, err := a.deliverImg(t.Context(), 0, "u1", "Lần hai", "https://site.example/img/zalo-banner.png"); err != nil || st != "sent" {
		t.Fatalf("%s %v", st, err)
	}
	if len(f.sent) != n+1 || !strings.HasSuffix(f.sent[n], "|Lần hai") {
		t.Fatalf("phải gửi lại dạng chữ: %v", f.sent)
	}
}
