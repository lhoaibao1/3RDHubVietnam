package main

// Tin Zalo OA cho khách của website (tin tư vấn, miễn phí), dùng chung Official Account với 3RDHub.
//
// - Access token MƯỢN từ 3RDHub (ZALO_OA_TOKEN_URL + ZALO_OA_SHARE_KEY). Trang này KHÔNG gọi oauth.zaloapp.com,
//   (Từ bản này có thêm cách tự kết nối, không qua 3RDHub: xem zalo_own.go. Cách tự kết nối được ưu tiên khi đã kết nối.)
// - Khách nhận một mã ngắn (3R-12345) sau khi đăng ký, nhắn mã đó vào OA. Webhook của ứng dụng Zalo (hoặc đọc
//   tin gần nhất mỗi 45 giây nếu không dùng được webhook) ghép Zalo user id của khách với yêu cầu, rồi trả lời xác nhận.
// - Zalo chỉ cho gửi tin tư vấn khi khách vừa tương tác với OA (hiện là 7 ngày, mã lỗi -230/-232/-213). Tin không gửi
//   được vì quá hạn nằm trong hàng chờ zalo_outbox và được gửi lại ngay khi khách nhắn OA lần nữa.
// - Không ghi token, khoá, tên, số điện thoại, Zalo user id hay nội dung tin của khách vào log.

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"
)

var (
	zaloOpenAPI = "https://openapi.zalo.me" // đổi được trong test
	zaloCodeRe  = regexp.MustCompile(`(?i)(?:^|[^A-Za-z0-9])3R[\s.-]*(\d{5})(?:$|[^0-9])`)
	zaloCodeTTL = 7 * 24 * time.Hour
)

const defaultZaloConfirm = "3RDHub Vietnam đã nhận mã {code}. Từ giờ, cập nhật về yêu cầu \"{need}\" của bạn sẽ được gửi qua Zalo này. Cảm ơn bạn!"

// errOutsideWindow: khách chưa quan tâm OA hoặc đã quá thời gian tương tác Zalo cho phép gửi tin tư vấn.
type errOutsideWindow struct {
	code int
	msg  string
}

func (e errOutsideWindow) Error() string {
	return fmt.Sprintf("khách chưa tương tác với OA trong thời gian Zalo cho phép (Zalo %d: %s); tin được giữ lại, sẽ gửi khi khách nhắn OA", e.code, e.msg)
}

type zaloOA struct {
	app                *App // để đọc cấu hình tự kết nối (zalo_own.go)
	ownMu              sync.Mutex
	own                zaloOwn
	ownLoaded          bool
	tokenURL, shareKey string
	appID, oaID        string
	secret             string // OA Secret Key của ứng dụng Zalo, dùng xác thực chữ ký webhook
	public, poll       bool
	hc                 *http.Client

	mu       sync.Mutex
	tok      string
	exp      time.Time
	tokOA    string
	checked  time.Time
	tokErr   string
	lastEvt  time.Time
	seenMu   sync.Mutex
	seenLast time.Time
}

func newZaloOA(c Config) *zaloOA {
	if c.ZaloAPIBase != "" { // chỉ dùng khi thử với máy chủ Zalo giả
		zaloOpenAPI = strings.TrimRight(c.ZaloAPIBase, "/")
		zaloOAuthBase = zaloOpenAPI + "/oauth"
	}
	return &zaloOA{tokenURL: c.ZaloTokenURL, shareKey: c.ZaloShareKey, appID: c.ZaloAppID, oaID: c.ZaloOAID, secret: c.ZaloSecret,
		public: c.ZaloPublic, poll: c.ZaloPoll, hc: &http.Client{Timeout: 15 * time.Second}}
}

// ready: đã kết nối Zalo OA (tự kết nối trong CMS, hoặc cách cũ mượn token từ 3RDHub qua biến môi trường).
func (z *zaloOA) ready() bool {
	return z != nil && (z.ownConnected() || (z.tokenURL != "" && z.shareKey != ""))
}

func (z *zaloOA) oaURL() string { return "https://zalo.me/" + z.oaIDv() }

// token trả access token còn hạn (giữ trong bộ nhớ tới expires_at trừ 5 phút). force: bỏ bản đang giữ, hỏi lại 3RDHub.
func (z *zaloOA) token(ctx context.Context, force bool) (string, error) {
	z.mu.Lock()
	defer z.mu.Unlock()
	if !force && z.tok != "" && time.Now().Before(z.exp.Add(-5*time.Minute)) {
		return z.tok, nil
	}
	var tok, oa string
	var exp time.Time
	var err error
	if z.app != nil {
		var used bool
		if tok, exp, oa, used, err = z.app.zaloOwnToken(ctx, force); !used {
			tok, exp, oa, err = z.fetchToken(ctx) // chưa tự kết nối: cách cũ (token mượn từ 3RDHub)
		}
	} else {
		tok, exp, oa, err = z.fetchToken(ctx)
	}
	z.checked = time.Now()
	if err != nil {
		z.tok, z.tokErr = "", err.Error()
		return "", err
	}
	z.tok, z.exp, z.tokOA, z.tokErr = tok, exp, oa, ""
	return tok, nil
}

func (z *zaloOA) fetchToken(ctx context.Context) (string, time.Time, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, z.tokenURL, nil)
	if err != nil {
		return "", time.Time{}, "", err
	}
	req.Header.Set("Authorization", "Token "+z.shareKey)
	req.Header.Set("Accept", "application/json")
	res, err := z.hc.Do(req)
	if err != nil {
		return "", time.Time{}, "", errors.New("không gọi được 3RDHub để lấy token Zalo OA")
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(res.Body, 64*1024))
	var r struct {
		Data struct {
			AccessToken string `json:"access_token"`
			ExpiresAt   string `json:"expires_at"`
			OAID        string `json:"oa_id"`
		} `json:"data"`
		Error *struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(raw, &r)
	switch res.StatusCode {
	case 200:
	case 401:
		return "", time.Time{}, "", errors.New("3RDHub từ chối ZALO_OA_SHARE_KEY (401): kiểm tra lại khoá")
	case 429:
		return "", time.Time{}, "", errors.New("gọi 3RDHub lấy token quá 60 lần/phút (429)")
	case 503:
		return "", time.Time{}, "", errors.New("OA đang mất kết nối trong 3RDHub (oa_unavailable): báo chủ sản phẩm kết nối lại Zalo OA trong 3RDHub")
	default:
		return "", time.Time{}, "", fmt.Errorf("3RDHub trả HTTP %d khi lấy token Zalo OA", res.StatusCode)
	}
	exp, err := time.Parse(time.RFC3339, r.Data.ExpiresAt)
	if r.Data.AccessToken == "" || err != nil {
		return "", time.Time{}, "", errors.New("3RDHub trả token Zalo OA sai định dạng")
	}
	if z.oaID != "" && r.Data.OAID != "" && r.Data.OAID != z.oaID {
		return "", time.Time{}, "", fmt.Errorf("token 3RDHub trả về thuộc OA %s, không phải OA %s đã cấu hình", r.Data.OAID, z.oaID)
	}
	return r.Data.AccessToken, exp, r.Data.OAID, nil
}

// zaloResp là phần chung của phản hồi Open API Zalo.
type zaloResp struct {
	Error   int             `json:"error"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

func tokenInvalid(code int) bool { return code == -216 || code == -220 || code == -124 }

// call gọi Open API Zalo bằng token mượn; Zalo báo token không hợp lệ thì hỏi lại 3RDHub đúng một lần rồi thử lại.
func (z *zaloOA) call(ctx context.Context, method, path string, body any) (zaloResp, error) {
	var out zaloResp
	for try := 0; try < 2; try++ {
		tok, err := z.token(ctx, try == 1)
		if err != nil {
			return out, err
		}
		var rd io.Reader
		if body != nil {
			rd = strings.NewReader(string(jsonBytes(body)))
		}
		req, err := http.NewRequestWithContext(ctx, method, zaloOpenAPI+path, rd)
		if err != nil {
			return out, err
		}
		req.Header.Set("access_token", tok)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}
		res, err := z.hc.Do(req)
		if err != nil {
			return out, errors.New("không gọi được Zalo Open API")
		}
		raw, _ := io.ReadAll(io.LimitReader(res.Body, 512*1024))
		res.Body.Close()
		out = zaloResp{}
		if json.Unmarshal(raw, &out) != nil {
			return out, fmt.Errorf("Zalo trả HTTP %d không phải JSON", res.StatusCode)
		}
		if tokenInvalid(out.Error) && try == 0 {
			continue
		}
		return out, nil
	}
	return out, nil
}

// sendCS gửi một tin tư vấn dạng văn bản (tối đa 2.000 ký tự).
func (z *zaloOA) sendCS(ctx context.Context, uid, text string) error {
	if r := []rune(text); len(r) > 2000 {
		text = string(r[:2000])
	}
	r, err := z.call(ctx, http.MethodPost, "/v3.0/oa/message/cs", map[string]any{"recipient": map[string]string{"user_id": uid}, "message": map[string]string{"text": text}})
	if err != nil {
		return err
	}
	switch r.Error {
	case 0:
		return nil
	case -213, -227, -230, -232:
		return errOutsideWindow{r.Error, r.Message}
	default:
		return fmt.Errorf("Zalo %d: %s", r.Error, r.Message)
	}
}

/* ---------------- mã ghép khách ---------------- */

// assignZaloCode gán cho yêu cầu một mã 3R-xxxxx còn hạn 7 ngày (khác mã đang dùng).
func (a *App) assignZaloCode(ctx context.Context, leadID int64) (string, int64, error) {
	exp := time.Now().Add(zaloCodeTTL).Unix()
	for i := 0; i < 8; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(90000))
		if err != nil {
			return "", 0, err
		}
		code := fmt.Sprintf("3R-%05d", n.Int64()+10000)
		tag, err := a.pool.Exec(ctx, `UPDATE leads SET zalo_code=$1, zalo_code_exp=$2 WHERE id=$3 AND NOT EXISTS (SELECT 1 FROM leads WHERE zalo_code=$1)`, code, exp, leadID)
		if err != nil {
			continue // trùng mã (unique) thì thử mã khác
		}
		if tag.RowsAffected() == 1 {
			return code, exp, nil
		}
	}
	return "", 0, errors.New("không tạo được mã Zalo")
}

func normCode(digits string) string { return "3R-" + digits }

/* ---------------- hàng chờ ---------------- */

// deliver gửi tin cho khách; quá khung tương tác hoặc lỗi tạm thời thì để trong hàng chờ.
// Trả về trạng thái: sent | pending | failed.
func (a *App) deliver(ctx context.Context, leadID int64, uid, text string) (string, error) {
	err := a.zoa.sendCS(ctx, uid, text)
	st, msg := "sent", ""
	var ow errOutsideWindow
	switch {
	case err == nil:
	case errors.As(err, &ow) || !strings.HasPrefix(err.Error(), "Zalo -"):
		st, msg = "pending", err.Error()
	default:
		st, msg = "failed", err.Error()
	}
	now := time.Now().Unix()
	sentAt := int64(0)
	if st == "sent" {
		sentAt = now
	}
	if _, e := a.pool.Exec(ctx, `INSERT INTO zalo_outbox(lead_id,uid,text,status,tries,last_error,created,sent_at) VALUES($1,$2,$3,$4,1,$5,$6,$7)`, leadID, uid, text, st, msg, now, sentAt); e != nil {
		return st, e
	}
	if st != "sent" {
		log.Printf("Zalo OA: tin cho yêu cầu #%d chưa gửi (%s)", leadID, st)
	}
	return st, err
}

// flushOutbox gửi lại các tin đang chờ của một khách (gọi ngay khi khách vừa tương tác với OA).
func (a *App) flushOutbox(ctx context.Context, uid string) {
	rows, err := a.pool.Query(ctx, `SELECT id, text FROM zalo_outbox WHERE uid=$1 AND status='pending' ORDER BY id LIMIT 20`, uid)
	if err != nil {
		return
	}
	type item struct {
		id   int64
		text string
	}
	var list []item
	for rows.Next() {
		var it item
		if rows.Scan(&it.id, &it.text) == nil {
			list = append(list, it)
		}
	}
	rows.Close()
	for _, it := range list {
		err := a.zoa.sendCS(ctx, uid, it.text)
		var ow errOutsideWindow
		switch {
		case err == nil:
			a.pool.Exec(ctx, `UPDATE zalo_outbox SET status='sent', sent_at=$1, tries=tries+1, last_error='' WHERE id=$2`, time.Now().Unix(), it.id)
		case errors.As(err, &ow) || !strings.HasPrefix(err.Error(), "Zalo -"):
			a.pool.Exec(ctx, `UPDATE zalo_outbox SET tries=tries+1, last_error=$1 WHERE id=$2`, err.Error(), it.id)
			return
		default:
			a.pool.Exec(ctx, `UPDATE zalo_outbox SET status='failed', tries=tries+1, last_error=$1 WHERE id=$2`, err.Error(), it.id)
		}
	}
}

/* ---------------- tin khách gửi tới OA ---------------- */

func (a *App) zaloConfirmText(ctx context.Context) string {
	var c struct {
		Confirm string `json:"confirm"`
	}
	kvGet(ctx, a.pool, "zalo_oa", &c)
	if strings.TrimSpace(c.Confirm) == "" {
		return defaultZaloConfirm
	}
	return c.Confirm
}

func fillZalo(tpl string, code, name, need string) string {
	return strings.NewReplacer("{code}", code, "{name}", name, "{need}", need).Replace(tpl)
}

// inbound xử lý một tin khách gửi tới OA (từ webhook hoặc từ việc đọc tin gần nhất). msgID dùng để chống xử lý trùng.
func (a *App) inbound(ctx context.Context, uid, text, msgID string) {
	if uid == "" {
		return
	}
	if msgID != "" {
		tag, err := a.pool.Exec(ctx, `INSERT INTO zalo_seen(msg_id, ts) VALUES($1,$2) ON CONFLICT DO NOTHING`, msgID, time.Now().Unix())
		if err != nil || tag.RowsAffected() == 0 {
			return
		}
	}
	defer a.flushOutbox(ctx, uid)
	m := zaloCodeRe.FindStringSubmatch(text)
	if m == nil {
		return
	}
	code := normCode(m[1])
	var id, exp int64
	var owner, name, need string
	err := a.pool.QueryRow(ctx, `SELECT id, zalo_code_exp, zalo_uid, name, need FROM leads WHERE zalo_code=$1`, code).Scan(&id, &exp, &owner, &name, &need)
	reply := ""
	switch {
	case err != nil:
		reply = "Mã " + code + " không đúng. Bạn kiểm tra lại mã hiện trên trang sau khi đăng ký, hoặc gọi hotline để được hỗ trợ."
	case owner != "" && owner != uid:
		reply = "Mã " + code + " đã được dùng cho một tài khoản Zalo khác. Nếu đây là mã của bạn, vui lòng gọi hotline để được hỗ trợ."
	case owner == "" && time.Now().Unix() > exp:
		reply = "Mã " + code + " đã hết hạn. Nhân viên sẽ liên hệ bạn theo số điện thoại đã đăng ký."
	default:
		if owner == "" {
			a.pool.Exec(ctx, `UPDATE leads SET zalo_uid=$1, zalo_linked_at=$2 WHERE id=$3 AND zalo_uid=''`, uid, time.Now().Unix(), id)
		}
		a.deliver(ctx, id, uid, fillZalo(a.zaloConfirmText(ctx), code, name, need))
		return
	}
	if err := a.zoa.sendCS(ctx, uid, reply); err != nil {
		log.Printf("Zalo OA: không trả lời được tin chứa mã: %v", err)
	}
}

/* ---------------- webhook ---------------- */

// flexID nhận id dạng chuỗi hoặc số (id Zalo dài, không đổi sang float).
type flexID string

func (f *flexID) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	if s == "null" {
		s = ""
	}
	*f = flexID(s)
	return nil
}

type zaloEvent struct {
	AppID     flexID `json:"app_id"`
	EventName string `json:"event_name"`
	Timestamp flexID `json:"timestamp"`
	OAID      flexID `json:"oa_id"`
	Sender    struct {
		ID flexID `json:"id"`
	} `json:"sender"`
	Recipient struct {
		ID flexID `json:"id"`
	} `json:"recipient"`
	Follower struct {
		ID flexID `json:"id"`
	} `json:"follower"`
	Message struct {
		Text  string `json:"text"`
		MsgID string `json:"msg_id"`
	} `json:"message"`
}

// verifyZalo kiểm tra X-ZEvent-Signature: mac=sha256(appId + body thô + timeStamp + OA Secret Key).
// Thử thêm timestamp ±1 ms vì Zalo đôi khi ký bằng giá trị lệch 1 ms so với body.
func (z *zaloOA) verify(sig string, raw []byte, ts string) bool {
	appID, secret := z.appIDv(), z.secretv()
	if secret == "" || appID == "" {
		return false
	}
	got := strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(sig), "mac="))
	want := []string{ts}
	if n, err := strconv.ParseInt(ts, 10, 64); err == nil {
		want = append(want, strconv.FormatInt(n+1, 10), strconv.FormatInt(n-1, 10))
	}
	for _, t := range want {
		sum := sha256.Sum256([]byte(appID + string(raw) + t + secret))
		if subtle.ConstantTimeCompare([]byte(hex.EncodeToString(sum[:])), []byte(strings.ToLower(got))) == 1 {
			return true
		}
	}
	return false
}

func (a *App) zaloWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost { // Zalo kiểm tra địa chỉ webhook khi cấu hình
		a.send(w, r, 200, []byte("ok"), "text/plain; charset=utf-8", noStore)
		return
	}
	raw, err := readBody(r, 64*1024)
	if err != nil {
		a.fail(w, r, 413, "quá lớn")
		return
	}
	var ev zaloEvent
	if json.Unmarshal(raw, &ev) != nil || ev.EventName == "" {
		a.send(w, r, 200, []byte("ok"), "text/plain; charset=utf-8", noStore)
		return
	}
	if !a.zoa.verify(r.Header.Get("X-ZEvent-Signature"), raw, string(ev.Timestamp)) || string(ev.AppID) != a.zoa.appID {
		log.Printf("Zalo webhook: sai chữ ký hoặc App ID, bỏ qua sự kiện %q", ev.EventName)
		a.fail(w, r, 401, "sai chữ ký")
		return
	}
	a.send(w, r, 200, []byte("ok"), "text/plain; charset=utf-8", noStore) // trả 200 ngay, Zalo chỉ chờ tối đa 2 giây
	a.zoa.seenMu.Lock()
	a.zoa.lastEvt = time.Now()
	a.zoa.seenMu.Unlock()
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 45*time.Second)
		defer cancel()
		switch {
		case strings.HasPrefix(ev.EventName, "user_send_") && (a.zoa.oaID == "" || string(ev.Recipient.ID) == a.zoa.oaID):
			id := ev.Message.MsgID
			if id == "" {
				id = "w:" + string(ev.Sender.ID) + ":" + string(ev.Timestamp)
			}
			text := ""
			if ev.EventName == "user_send_text" {
				text = ev.Message.Text
			}
			a.inbound(ctx, string(ev.Sender.ID), text, id)
		case ev.EventName == "follow" && (a.zoa.oaID == "" || string(ev.OAID) == a.zoa.oaID):
			a.flushOutbox(ctx, string(ev.Follower.ID))
		}
	}()
}

/* ---------------- dự phòng: đọc tin gần nhất ---------------- */

// pollRecent đọc 10 tin gần nhất của OA (dùng khi không đặt được webhook). Chỉ xử lý tin khách gửi (src = 1)
// mới hơn lần đọc trước; lần đầu chỉ ghi mốc thời gian, không trả lời tin cũ.
func (a *App) pollRecent(ctx context.Context) error {
	q := url.Values{"data": {`{"offset":0,"count":10}`}}
	r, err := a.zoa.call(ctx, http.MethodGet, "/v2.0/oa/listrecentchat?"+q.Encode(), nil)
	if err != nil {
		return err
	}
	if r.Error != 0 {
		return fmt.Errorf("Zalo %d: %s", r.Error, r.Message)
	}
	var list []struct {
		Src       int    `json:"src"`
		Time      int64  `json:"time"`
		Type      string `json:"type"`
		Message   string `json:"message"`
		MessageID string `json:"message_id"`
		FromID    flexID `json:"from_id"`
		ToID      flexID `json:"to_id"`
	}
	if err := json.Unmarshal(r.Data, &list); err != nil {
		return errors.New("listrecentchat sai định dạng")
	}
	var since int64
	first := false
	if ok, _ := kvGet(ctx, a.pool, "zalo_poll_since", &since); !ok {
		first = true
	}
	max := since
	for i := len(list) - 1; i >= 0; i-- { // cũ trước, mới sau
		m := list[i]
		if m.Time > max {
			max = m.Time
		}
		if first || m.Src != 1 || m.Time <= since {
			continue
		}
		text := ""
		if m.Type == "text" {
			text = m.Message
		}
		a.inbound(ctx, string(m.FromID), text, m.MessageID)
	}
	if first && max == 0 {
		max = time.Now().UnixMilli()
	}
	return kvSetPool(ctx, a.pool, "zalo_poll_since", max)
}

// startZalo chạy việc nền: đọc tin dự phòng (nếu bật) và dọn danh sách tin đã xử lý.
func (a *App) startZalo(ctx context.Context) {
	go func() {
		t := time.NewTicker(45 * time.Second)
		defer t.Stop()
		for tick := 0; ; tick++ {
			if a.zoa.ownConnected() && tick%30 == 0 { // giữ token luôn mới (refresh token chỉ sống khoảng 3 tháng nếu không dùng)
				c, cancel := context.WithTimeout(ctx, 20*time.Second)
				a.zoa.token(c, false)
				cancel()
			}
			if a.zoa.poll && a.zoa.ready() {
				c, cancel := context.WithTimeout(ctx, 40*time.Second)
				if err := a.pollRecent(c); err != nil {
					log.Printf("Zalo OA: đọc tin gần nhất lỗi: %v", err)
				}
				cancel()
			}
			a.pool.Exec(ctx, `DELETE FROM zalo_seen WHERE ts < $1`, time.Now().Add(-14*24*time.Hour).Unix())
			select {
			case <-ctx.Done():
				return
			case <-t.C:
			}
		}
	}()
}

/* ---------------- API cho trang quản trị ---------------- */

func (a *App) zaloOAStatus(ctx context.Context) map[string]any {
	z := a.zoa
	z.mu.Lock()
	tok := map[string]any{"ok": z.tok != "" && time.Now().Before(z.exp), "oa_id": z.tokOA, "error": z.tokErr, "checked_at": unixOr0(z.checked)}
	if z.tok != "" {
		tok["expires_at"] = z.exp.Unix()
	}
	z.mu.Unlock()
	z.seenMu.Lock()
	last := unixOr0(z.lastEvt)
	z.seenMu.Unlock()
	var linked, pending int64
	a.pool.QueryRow(ctx, `SELECT COUNT(*) FROM leads WHERE zalo_uid<>''`).Scan(&linked)
	a.pool.QueryRow(ctx, `SELECT COUNT(*) FROM zalo_outbox WHERE status='pending'`).Scan(&pending)
	return map[string]any{
		"configured": z.ready(), "public": z.publicOn(), "webhook": z.secretv() != "" && z.appIDv() != "", "poll": z.poll, "legacy": z.tokenURL != "" && z.shareKey != "",
		"app_id": z.appIDv(), "oa_id": z.oaIDv(), "oa_url": z.oaURL(), "token": tok, "last_event_at": last,
		"linked": linked, "pending": pending, "confirm": a.zaloConfirmText(ctx), "confirm_default": defaultZaloConfirm,
	}
}

func (a *App) zaloStatusFull(ctx context.Context, r *http.Request) map[string]any {
	st := a.zaloOAStatus(ctx)
	st["own"] = a.zaloOwnStatus(r)
	return st
}

func unixOr0(t time.Time) int64 {
	if t.IsZero() {
		return 0
	}
	return t.Unix()
}

var zaloLeadRe = regexp.MustCompile(`^leads/(\d+)/zalo$`)

// zaloAdmin xử lý các đường dẫn /api/admin/zalo-oa*, /api/admin/leads/{id}/zalo. ok=false: không phải đường dẫn của Zalo OA.
func (a *App) zaloAdmin(ctx context.Context, w http.ResponseWriter, r *http.Request, sub string) (any, bool, error) {
	m := r.Method
	if v, hit, err := a.zaloOwnAdmin(ctx, r, sub); hit {
		if err == nil {
			if st, isSt := v.(map[string]any); isSt && st["url"] == nil {
				v = a.zaloStatusFull(ctx, r)
			}
		}
		return v, true, err
	}
	switch {
	case sub == "zalo-oa" && m == http.MethodGet:
		return a.zaloStatusFull(ctx, r), true, nil
	case sub == "zalo-oa" && m == http.MethodPut:
		d, err := readJSON(r, 8192)
		if err != nil {
			return nil, true, err
		}
		c, err := strip(d["confirm"], 1500, "Tin xác nhận")
		if err != nil {
			return nil, true, err
		}
		if c != "" && !strings.Contains(c, "{code}") {
			return nil, true, bad("Tin xác nhận nên có {code} để khách biết mã đã được ghép")
		}
		if err := kvSetPool(ctx, a.pool, "zalo_oa", map[string]string{"confirm": c}); err != nil {
			return nil, true, err
		}
		return a.zaloOAStatus(ctx), true, nil
	case sub == "zalo-oa/check" && m == http.MethodPost:
		if !a.zoa.ready() {
			return nil, true, bad("Chưa đặt ZALO_OA_TOKEN_URL và ZALO_OA_SHARE_KEY trên máy chủ")
		}
		if !a.rl.ok("zalooa", clientIP(r), 20, 10*time.Minute) {
			return nil, true, bad("Thử quá nhiều lần, đợi ít phút.")
		}
		if _, err := a.zoa.token(ctx, true); err != nil {
			return nil, true, bad("%v", err)
		}
		return a.zaloOAStatus(ctx), true, nil
	case sub == "zalo-oa/test-code" && m == http.MethodPost:
		var id int64
		if err := a.pool.QueryRow(ctx, `INSERT INTO leads(ts,name,phone,company,need,message,lang,ip,ua,email,status,note) VALUES($1,'Thử Zalo OA','','','Thử Zalo OA (tạo trong CMS)','','vi','','','','new','Yêu cầu thử, xoá được sau khi thử xong') RETURNING id`, time.Now().Unix()).Scan(&id); err != nil {
			return nil, true, err
		}
		code, exp, err := a.assignZaloCode(ctx, id)
		if err != nil {
			return nil, true, err
		}
		return map[string]any{"lead_id": id, "code": code, "expires_at": exp, "oa_url": a.zoa.oaURL()}, true, nil
	case sub == "zalo-oa/outbox" && m == http.MethodGet:
		rows, err := a.pool.Query(ctx, `SELECT o.id, o.lead_id, COALESCE(l.name,''), o.text, o.status, o.tries, o.last_error, o.created, o.sent_at FROM zalo_outbox o LEFT JOIN leads l ON l.id=o.lead_id ORDER BY o.id DESC LIMIT 60`)
		if err != nil {
			return nil, true, err
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, lid, created, sent int64
			var tries int
			var name, text, st, le string
			if err := rows.Scan(&id, &lid, &name, &text, &st, &tries, &le, &created, &sent); err != nil {
				return nil, true, err
			}
			out = append(out, map[string]any{"id": id, "lead_id": lid, "name": name, "text": text, "status": st, "tries": tries, "error": le, "created": created, "sent_at": sent})
		}
		return out, true, rows.Err()
	case zaloLeadRe.MatchString(sub) && m == http.MethodPost:
		id, _ := strconv.ParseInt(zaloLeadRe.FindStringSubmatch(sub)[1], 10, 64)
		d, err := readJSON(r, 16*1024)
		if err != nil {
			return nil, true, err
		}
		text, err := strip(d["text"], 2000, "Nội dung tin")
		if err != nil {
			return nil, true, err
		}
		if text == "" {
			return nil, true, bad("Nhập nội dung tin")
		}
		if !a.zoa.ready() {
			return nil, true, bad("Chưa cấu hình Zalo OA trên máy chủ")
		}
		var uid string
		if err := a.pool.QueryRow(ctx, `SELECT zalo_uid FROM leads WHERE id=$1`, id).Scan(&uid); err != nil || uid == "" {
			return nil, true, bad("Khách này chưa ghép Zalo (chưa nhắn mã vào OA)")
		}
		st, err := a.deliver(ctx, id, uid, text)
		res := map[string]any{"status": st}
		if err != nil {
			res["error"] = err.Error()
		}
		return res, true, nil
	}
	return nil, false, nil
}
