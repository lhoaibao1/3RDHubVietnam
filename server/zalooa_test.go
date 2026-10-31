package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

// fakeZalo giả lập cả 3RDHub (cấp token) lẫn Zalo Open API.
type fakeZalo struct {
	mu        sync.Mutex
	tokenHits int
	tokenNo   int      // token hiện tại: tok-1, tok-2...
	staleOnce bool     // lần gọi Zalo kế tiếp báo token không hợp lệ (-216)
	window    bool     // khách đang trong khung tương tác cho phép gửi tin tư vấn
	hubStatus int      // 0 = 200
	sent      []string // "uid|text|token"
	recent    string   // JSON trả cho listrecentchat
	paths     []string
}

func newFakeZalo(t *testing.T) (*fakeZalo, *httptest.Server) {
	f := &fakeZalo{window: true}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		f.paths = append(f.paths, r.URL.Path)
		switch {
		case r.URL.Path == "/hub/token":
			f.tokenHits++
			if r.Header.Get("Authorization") != "Token chia-se-khoa" {
				w.WriteHeader(401)
				w.Write([]byte(`{"error":{"code":"unauthorized","message":"x"}}`))
				return
			}
			if f.hubStatus != 0 {
				w.WriteHeader(f.hubStatus)
				w.Write([]byte(`{"error":{"code":"oa_unavailable","message":"x"}}`))
				return
			}
			f.tokenNo++
			fmt.Fprintf(w, `{"data":{"access_token":"tok-%d","expires_at":%q,"oa_id":"147468245835855615"}}`, f.tokenNo, time.Now().Add(2*time.Hour).UTC().Format(time.RFC3339))
		case r.URL.Path == "/v3.0/oa/message/cs":
			tok := r.Header.Get("access_token")
			if f.staleOnce || tok != fmt.Sprintf("tok-%d", f.tokenNo) {
				f.staleOnce = false
				w.Write([]byte(`{"error":-216,"message":"Access token is invalid"}`))
				return
			}
			var b struct {
				Recipient struct {
					UserID string `json:"user_id"`
				} `json:"recipient"`
				Message struct {
					Text string `json:"text"`
				} `json:"message"`
			}
			json.NewDecoder(r.Body).Decode(&b)
			if !f.window {
				w.Write([]byte(`{"error":-230,"message":"User has not interacted with the OA in the past 7 days"}`))
				return
			}
			f.sent = append(f.sent, b.Recipient.UserID+"|"+b.Message.Text+"|"+tok)
			w.Write([]byte(`{"error":0,"message":"Success","data":{"message_id":"m1","user_id":"u"}}`))
		case r.URL.Path == "/v2.0/oa/listrecentchat":
			fmt.Fprintf(w, `{"error":0,"message":"Success","data":%s}`, f.recent)
		default:
			t.Errorf("không được gọi %s", r.URL.Path)
			w.WriteHeader(404)
		}
	}))
	t.Cleanup(srv.Close)
	zaloOpenAPI = srv.URL
	t.Cleanup(func() { zaloOpenAPI = "https://openapi.zalo.me" })
	return f, srv
}

func (f *fakeZalo) sentList() []string {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]string(nil), f.sent...)
}

func waitFor(t *testing.T, what string, cond func() bool) {
	for i := 0; i < 100; i++ {
		if cond() {
			return
		}
		time.Sleep(30 * time.Millisecond)
	}
	t.Fatalf("hết thời gian chờ: %s", what)
}

const testSecret = "oa-secret-thu"

func signedEvent(appID string, body string, ts string) (string, string) {
	sum := sha256.Sum256([]byte(appID + body + ts + testSecret))
	return body, "mac=" + hex.EncodeToString(sum[:])
}

func textEvent(uid, text, msgID string) (string, string) {
	ts := fmt.Sprint(time.Now().UnixMilli())
	body := fmt.Sprintf(`{"app_id":"3689777608400566243","sender":{"id":"%s"},"user_id_by_app":"5521","recipient":{"id":"147468245835855615"},"event_name":"user_send_text","message":{"text":%q,"msg_id":"%s"},"timestamp":"%s"}`, uid, text, msgID, ts)
	return signedEvent("3689777608400566243", body, ts)
}

func zaloApp(t *testing.T, public bool) (*App, *fakeZalo) {
	a := testApp(t)
	f, srv := newFakeZalo(t)
	a.zoa = newZaloOA(Config{ZaloTokenURL: srv.URL + "/hub/token", ZaloShareKey: "chia-se-khoa", ZaloAppID: "3689777608400566243", ZaloOAID: "147468245835855615", ZaloSecret: testSecret, ZaloPublic: public})
	return a, f
}

func TestZaloOAFlow(t *testing.T) {
	a, f := zaloApp(t, true)
	ctx := t.Context()

	// khách gửi form: nhận mã 3R-xxxxx và link OA (đã bật ZALO_OA_PUBLIC)
	lead := `{"name":"Nguyễn Văn A","phone":"0901234567","need":"Nhận báo giá hệ thống","message":"x"}`
	r := do(a, "POST", "example.vn", "/api/lead", []byte(lead), nil)
	z, _ := r.json(t)["zalo"].(map[string]any)
	if r.code != 200 || z == nil || !zaloCodeRe.MatchString(" "+z["code"].(string)+" ") || z["url"] != "https://zalo.me/147468245835855615" || z["expires_at"] == "" {
		t.Fatalf("lead %d %s", r.code, r.body)
	}
	code := z["code"].(string)

	// chữ ký sai: 200 nhưng không xử lý
	body, _ := textEvent("u-111", "Mã của tôi "+code, "msg-0")
	if r := do(a, "POST", "example.vn", "/api/zalo/webhook", []byte(body), map[string]string{"X-ZEvent-Signature": "mac=deadbeef"}); r.code != 200 {
		t.Fatalf("chữ ký sai vẫn trả 200 (Zalo kiểm tra webhook) nhưng không xử lý: %d", r.code)
	}
	// chữ ký đúng (viết thường, có khoảng trắng, dạng 3r 12345): ghép và trả lời xác nhận
	loose := strings.ToLower(strings.Replace(code, "-", " ", 1))
	body, sig := textEvent("u-111", "chào shop, mã "+loose, "msg-1")
	if r := do(a, "POST", "example.vn", "/api/zalo/webhook", []byte(body), map[string]string{"X-ZEvent-Signature": sig}); r.code != 200 {
		t.Fatalf("webhook %d %s", r.code, r.body)
	}
	waitFor(t, "tin xác nhận", func() bool { return len(f.sentList()) == 1 })
	if s := f.sentList()[0]; !strings.HasPrefix(s, "u-111|") || !strings.Contains(s, code) || !strings.Contains(s, "Nhận báo giá hệ thống") {
		t.Fatalf("tin xác nhận: %s", s)
	}
	var uid string
	a.pool.QueryRow(ctx, `SELECT zalo_uid FROM leads WHERE zalo_code=$1`, code).Scan(&uid)
	if uid != "u-111" {
		t.Fatalf("chưa ghép uid: %q", uid)
	}
	// Zalo gửi lại cùng sự kiện (num_retry): không xử lý lần hai
	do(a, "POST", "example.vn", "/api/zalo/webhook", []byte(body), map[string]string{"X-ZEvent-Signature": sig, "num_retry": "1"})
	time.Sleep(200 * time.Millisecond)
	if n := len(f.sentList()); n != 1 {
		t.Fatalf("xử lý trùng: %d", n)
	}
	// token được giữ trong bộ nhớ: chỉ hỏi 3RDHub một lần
	if f.tokenHits != 1 {
		t.Fatalf("token phải được cache: %d lần", f.tokenHits)
	}

	// tài khoản Zalo khác gửi cùng mã: bị từ chối, không đổi chủ
	body, sig = textEvent("u-222", code, "msg-2")
	do(a, "POST", "example.vn", "/api/zalo/webhook", []byte(body), map[string]string{"X-ZEvent-Signature": sig})
	waitFor(t, "từ chối mã đã dùng", func() bool { return len(f.sentList()) == 2 })
	if s := f.sentList()[1]; !strings.HasPrefix(s, "u-222|") || !strings.Contains(s, "tài khoản Zalo khác") {
		t.Fatalf("mã đã dùng: %s", s)
	}
	// mã không có thật
	body, sig = textEvent("u-333", "3R-99999", "msg-3")
	do(a, "POST", "example.vn", "/api/zalo/webhook", []byte(body), map[string]string{"X-ZEvent-Signature": sig})
	waitFor(t, "mã sai", func() bool { return len(f.sentList()) == 3 })
	if s := f.sentList()[2]; !strings.Contains(s, "không đúng") {
		t.Fatalf("mã sai: %s", s)
	}
	// mã của hệ thống khác (KH-xxxx của 3RDHub): im lặng
	body, sig = textEvent("u-444", "KH-4821", "msg-4")
	do(a, "POST", "example.vn", "/api/zalo/webhook", []byte(body), map[string]string{"X-ZEvent-Signature": sig})
	time.Sleep(200 * time.Millisecond)
	if n := len(f.sentList()); n != 3 {
		t.Fatalf("không được trả lời mã KH-: %d", n)
	}

	// Zalo báo token không hợp lệ: hỏi lại 3RDHub đúng một lần rồi gửi lại
	ck := login(t, a)
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	var leadID int64
	a.pool.QueryRow(ctx, `SELECT id FROM leads WHERE zalo_code=$1`, code).Scan(&leadID)
	f.mu.Lock()
	f.staleOnce = true
	f.mu.Unlock()
	r = do(a, "POST", cms, fmt.Sprintf("/api/admin/leads/%d/zalo", leadID), []byte(`{"text":"Hồ sơ của bạn đã được duyệt."}`), h)
	if r.code != 200 || r.json(t)["status"] != "sent" || f.tokenHits != 2 {
		t.Fatalf("gửi tin sau token hết hạn: %d %s (token %d lần)", r.code, r.body, f.tokenHits)
	}
	if s := f.sentList()[3]; !strings.HasSuffix(s, "|tok-2") {
		t.Fatalf("phải dùng token mới: %s", s)
	}

	// quá khung tương tác: tin vào hàng chờ, gửi lại khi khách nhắn OA
	f.mu.Lock()
	f.window = false
	f.mu.Unlock()
	r = do(a, "POST", cms, fmt.Sprintf("/api/admin/leads/%d/zalo", leadID), []byte(`{"text":"Hồ sơ đã giải ngân."}`), h)
	if r.json(t)["status"] != "pending" {
		t.Fatalf("phải vào hàng chờ: %s", r.body)
	}
	f.mu.Lock()
	f.window = true
	f.mu.Unlock()
	body, sig = textEvent("u-111", "cảm ơn", "msg-5")
	do(a, "POST", "example.vn", "/api/zalo/webhook", []byte(body), map[string]string{"X-ZEvent-Signature": sig})
	waitFor(t, "gửi tin chờ", func() bool { l := f.sentList(); return len(l) == 5 && strings.Contains(l[4], "giải ngân") })
	ob := do(a, "GET", cms, "/api/admin/zalo-oa/outbox", nil, h)
	if !strings.Contains(string(ob.body), `"status":"sent"`) || strings.Contains(string(ob.body), `"status":"pending"`) {
		t.Fatalf("hàng chờ: %s", ob.body)
	}

	// trang quản trị: trạng thái không lộ token / khoá; danh sách yêu cầu có cờ đã ghép, không có uid
	st := do(a, "GET", cms, "/api/admin/zalo-oa", nil, h)
	for _, leak := range []string{"tok-", "chia-se-khoa", testSecret} {
		if strings.Contains(string(st.body), leak) {
			t.Fatalf("lộ %s: %s", leak, st.body)
		}
	}
	ls := do(a, "GET", cms, "/api/admin/leads", nil, h)
	if !strings.Contains(string(ls.body), `"zalo_linked":true`) || strings.Contains(string(ls.body), "u-111") {
		t.Fatalf("leads: %s", ls.body)
	}
	// mã thử tạo trong CMS
	tc := do(a, "POST", cms, "/api/admin/zalo-oa/test-code", nil, h).json(t)
	if !strings.HasPrefix(tc["code"].(string), "3R-") {
		t.Fatalf("mã thử: %v", tc)
	}
	// không bao giờ gọi API làm mới token của Zalo
	for _, p := range f.paths {
		if strings.Contains(p, "access_token") || strings.Contains(p, "oauth") {
			t.Fatalf("gọi %s", p)
		}
	}
}

func TestZaloOANotPublicAndHubErrors(t *testing.T) {
	a, f := zaloApp(t, false)
	r := do(a, "POST", "example.vn", "/api/lead", []byte(`{"name":"Nguyễn Văn B","phone":"0901234567"}`), nil)
	if _, has := r.json(t)["zalo"]; has || r.code != 200 {
		t.Fatalf("chưa bật cho khách thì không trả mã: %s", r.body)
	}
	var code string
	a.pool.QueryRow(t.Context(), `SELECT zalo_code FROM leads ORDER BY id DESC LIMIT 1`).Scan(&code)
	if code == "" {
		t.Fatal("vẫn phải tạo mã để chủ sản phẩm thử")
	}
	ck := login(t, a)
	h := map[string]string{"Cookie": ck, "X-CMS": "1"}
	f.mu.Lock()
	f.hubStatus = 503
	f.mu.Unlock()
	if r := do(a, "POST", cms, "/api/admin/zalo-oa/check", nil, h); r.code != 400 || !strings.Contains(string(r.body), "oa_unavailable") {
		t.Fatalf("503: %d %s", r.code, r.body)
	}
	f.mu.Lock()
	f.hubStatus = 429
	f.mu.Unlock()
	if r := do(a, "POST", cms, "/api/admin/zalo-oa/check", nil, h); !strings.Contains(string(r.body), "60 lần/phút") {
		t.Fatalf("429: %s", r.body)
	}
	a.zoa.shareKey = "sai"
	if r := do(a, "POST", cms, "/api/admin/zalo-oa/check", nil, h); !strings.Contains(string(r.body), "401") {
		t.Fatalf("401: %s", r.body)
	}
}

func TestZaloSignatureAndPoll(t *testing.T) {
	a, f := zaloApp(t, true)
	// lệch 1 ms (Zalo đôi khi ký bằng timestamp lệch so với body) vẫn chấp nhận; lệch hơn thì không
	body := `{"app_id":"3689777608400566243","event_name":"follow","oa_id":"147468245835855615","follower":{"id":"u-9"},"timestamp":"1700000000000"}`
	for ts, want := range map[string]bool{"1700000000000": true, "1700000000001": true, "1700000000002": false} {
		_, sig := signedEvent("3689777608400566243", body, ts)
		if got := a.zoa.verify(sig, []byte(body), "1700000000000"); got != want {
			t.Fatalf("ts %s: %v", ts, got)
		}
	}
	// App ID khác: từ chối
	b2 := strings.Replace(body, "3689777608400566243", "111", 1)
	_, sig := signedEvent("111", b2, "1700000000000")
	if r := do(a, "POST", "example.vn", "/api/zalo/webhook", []byte(b2), map[string]string{"X-ZEvent-Signature": sig}); r.code != 200 {
		t.Fatalf("app khác: %d", r.code)
	}
	// không có khoá bí mật thì không tin bất kỳ chữ ký nào
	z := newZaloOA(Config{ZaloAppID: "3689777608400566243"})
	if z.verify(sig, []byte(body), "1700000000000") {
		t.Fatal("khoá rỗng phải từ chối")
	}

	// đọc tin gần nhất: lần đầu chỉ ghi mốc, lần sau xử lý tin mới của khách
	var code string
	r := do(a, "POST", "example.vn", "/api/lead", []byte(`{"name":"Khách C","phone":"0901234567","need":"Dùng thử"}`), nil)
	code = r.json(t)["zalo"].(map[string]any)["code"].(string)
	now := time.Now().UnixMilli()
	f.mu.Lock()
	f.recent = fmt.Sprintf(`[{"src":1,"time":%d,"type":"text","message":"cũ","message_id":"p0","from_id":"u-5","to_id":"147468245835855615"}]`, now-1000)
	f.mu.Unlock()
	if err := a.pollRecent(t.Context()); err != nil {
		t.Fatal(err)
	}
	if n := len(f.sentList()); n != 0 {
		t.Fatalf("lần đầu không trả lời tin cũ: %d", n)
	}
	f.mu.Lock()
	f.recent = fmt.Sprintf(`[{"src":0,"time":%d,"type":"text","message":"OA gửi %s","message_id":"p2","from_id":"147468245835855615","to_id":"u-5"},{"src":1,"time":%d,"type":"text","message":"%s","message_id":"p1","from_id":5000000000000000123,"to_id":"147468245835855615"}]`, now+2000, code, now+1000, code)
	f.mu.Unlock()
	if err := a.pollRecent(t.Context()); err != nil {
		t.Fatal(err)
	}
	if l := f.sentList(); len(l) != 1 || !strings.HasPrefix(l[0], "5000000000000000123|") {
		t.Fatalf("poll: %v", l)
	}
	if err := a.pollRecent(t.Context()); err != nil || len(f.sentList()) != 1 {
		t.Fatal("đọc lại không được xử lý trùng")
	}
}

// Chỉ zalo_own.go (tự kết nối Zalo OA, theo yêu cầu của chủ website) được gọi oauth.zaloapp.com và làm mới token;
// các file khác (cách cũ mượn token từ 3RDHub) vẫn không được, và không file nào được ghi token hay khoá vào log.
func TestZaloOAuthOnlyInOwnFile(t *testing.T) {
	files, _ := filepath.Glob("*.go")
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") || f == "zalo_own.go" {
			continue
		}
		b, _ := os.ReadFile(f)
		if strings.Contains(string(b), `"https://oauth.zaloapp.com`) || strings.Contains(string(b), `"refresh_token"`) {
			t.Fatalf("%s gọi/làm mới token Zalo OA ngoài zalo_own.go", f)
		}
	}
	b, _ := os.ReadFile("zalo_own.go")
	for _, line := range strings.Split(string(b), "\n") {
		if strings.Contains(line, "log.") && (strings.Contains(line, "Access") || strings.Contains(line, "Refresh") || strings.Contains(line, "Secret")) {
			t.Fatalf("không được ghi token/khoá vào log: %s", line)
		}
	}
}

// Cấu hình ZNS cũ (refresh/access token Zalo OA) phải bị xoá khi khởi động, giữ lại cấu hình Zalo Bot.
func TestDropLegacyZNS(t *testing.T) {
	a := testApp(t)
	old := map[string]any{"bot_on": true, "bot_chats": "c1", "zns_on": true, "app_id": "1", "secret": "enc-s", "refresh": "enc-r", "access": "enc-a", "access_exp": 1}
	if err := kvSetPool(t.Context(), a.pool, "zalo", old); err != nil {
		t.Fatal(err)
	}
	if err := a.initData(t.Context()); err != nil {
		t.Fatal(err)
	}
	var raw string
	a.pool.QueryRow(t.Context(), `SELECT value::text FROM kv WHERE key='zalo'`).Scan(&raw)
	if strings.Contains(raw, "refresh") || strings.Contains(raw, "enc-") || !strings.Contains(raw, `"bot_chats": "c1"`) && !strings.Contains(raw, `"bot_chats":"c1"`) {
		t.Fatalf("còn cấu hình ZNS cũ: %s", raw)
	}
}
