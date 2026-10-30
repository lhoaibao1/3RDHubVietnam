package main

// Đăng ký sản phẩm cho khách (trang /dang-ky): trình duyệt gọi /api/products và /api/register,
// backend này chuyển tiếp sang 3RDHub kèm khoá HUB_SITE_KEY (khoá không bao giờ ra trình duyệt).
// Trang này KHÔNG gọi API Zalo và không giữ token Zalo: 3RDHub là nơi duy nhất kết nối Zalo OA.
// Không ghi họ tên, số điện thoại hay dữ liệu khách vào log.

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"
)

type hubProduct struct {
	Code    string `json:"code"`
	Name    string `json:"name"`
	Partner string `json:"partner"`
}

type hubError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Field   string `json:"field,omitempty"`
}

type hubClient struct {
	base, key string
	mock      bool
	hc        *http.Client

	mu      sync.Mutex
	prods   []hubProduct
	prodsAt time.Time
}

func newHubClient(c Config) *hubClient {
	h := &hubClient{base: strings.TrimRight(c.HubBase, "/"), key: c.HubKey, mock: c.HubMock, hc: &http.Client{Timeout: 12 * time.Second}}
	if c.HubMock {
		if h.base == "" {
			h.base = "http://hub-mock.invalid"
		}
		if h.key == "" {
			h.key = "mock-site-key"
		}
		h.hc.Transport = mockTransport{newHubMock(h.key)}
	}
	return h
}

func (h *hubClient) ready() bool { return h.base != "" && h.key != "" }

// call gửi một yêu cầu tới 3RDHub và trả về mã HTTP, phần data và phần error của phản hồi.
func (h *hubClient) call(ctx context.Context, method, path string, body any) (int, json.RawMessage, *hubError, error) {
	var rd io.Reader
	if body != nil {
		rd = bytes.NewReader(jsonBytes(body))
	}
	req, err := http.NewRequestWithContext(ctx, method, h.base+path, rd)
	if err != nil {
		return 0, nil, nil, err
	}
	req.Header.Set("Authorization", "Token "+h.key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	res, err := h.hc.Do(req)
	if err != nil {
		return 0, nil, nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 256*1024))
	if err != nil {
		return res.StatusCode, nil, nil, err
	}
	var env struct {
		Data  json.RawMessage `json:"data"`
		Error *hubError       `json:"error"`
	}
	if len(bytes.TrimSpace(raw)) > 0 {
		if err := json.Unmarshal(raw, &env); err != nil {
			return res.StatusCode, nil, nil, errors.New("phản hồi 3RDHub không phải JSON")
		}
	}
	if len(env.Data) == 0 || string(env.Data) == "null" {
		env.Data = nil
	}
	return res.StatusCode, env.Data, env.Error, nil
}

// products lấy danh sách sản phẩm (giữ trong bộ nhớ 5 phút; 3RDHub lỗi thì dùng bản cũ nếu có).
func (h *hubClient) products(ctx context.Context) ([]hubProduct, error) {
	h.mu.Lock()
	if h.prods != nil && time.Since(h.prodsAt) < 5*time.Minute {
		p := h.prods
		h.mu.Unlock()
		return p, nil
	}
	h.mu.Unlock()
	st, data, _, err := h.call(ctx, http.MethodGet, "/api/v1/public/customer-products", nil)
	if err == nil && st != 200 {
		err = errors.New("3RDHub trả " + http.StatusText(st))
		if st == 401 {
			log.Printf("3RDHub từ chối HUB_SITE_KEY (401) khi lấy danh sách sản phẩm")
		}
	}
	var list []hubProduct
	if err == nil {
		if e := json.Unmarshal(data, &list); e != nil {
			err = errors.New("danh sách sản phẩm sai định dạng")
		}
	}
	h.mu.Lock()
	defer h.mu.Unlock()
	if err != nil {
		if h.prods != nil {
			return h.prods, nil
		}
		return nil, err
	}
	out := make([]hubProduct, 0, len(list))
	for _, p := range list {
		p.Code, p.Name, p.Partner = clip(p.Code, 40), clip(p.Name, 160), clip(p.Partner, 120)
		if p.Code != "" && p.Name != "" {
			out = append(out, p)
		}
	}
	h.prods, h.prodsAt = out, time.Now()
	return out, nil
}

func clip(s string, n int) string {
	s = strings.TrimSpace(strings.ToValidUTF8(s, ""))
	if utf8.RuneCountInString(s) > n {
		s = string([]rune(s)[:n])
	}
	return s
}

// ---- route cho trình duyệt

const msgHubDown = "Hệ thống đăng ký đang tạm gián đoạn. Vui lòng thử lại sau ít phút hoặc gọi hotline trên trang."

func (a *App) hubFail(w http.ResponseWriter, r *http.Request, status int, code, msg, field string) {
	a.sendJSON(w, r, status, map[string]any{"error": hubError{Code: code, Message: msg, Field: field}}, noStore)
}

func (a *App) apiProducts(w http.ResponseWriter, r *http.Request) {
	if !a.hub.ready() {
		a.hubFail(w, r, 503, "unavailable", "Chưa mở đăng ký trực tuyến. Vui lòng gọi hotline trên trang.", "")
		return
	}
	list, err := a.hub.products(r.Context())
	if err != nil {
		log.Printf("3RDHub: không lấy được danh sách sản phẩm: %v", err)
		a.hubFail(w, r, 502, "unavailable", msgHubDown, "")
		return
	}
	a.sendJSON(w, r, 200, map[string]any{"data": list}, noStore)
}

var (
	vnMobileRe = regexp.MustCompile(`^0[35789][0-9]{8}$`)
	refRe      = regexp.MustCompile(`^[A-Za-z0-9_.-]{1,64}$`)
	leadCodeRe = regexp.MustCompile(`^[A-Za-z0-9-]{1,32}$`)
)

// normPhone bỏ khoảng trắng, dấu chấm, gạch; đổi +84/84 đầu số thành 0.
func normPhone(s string) string {
	s = strings.Map(func(r rune) rune {
		if r == ' ' || r == '.' || r == '-' || r == '(' || r == ')' || r == ' ' {
			return -1
		}
		return r
	}, strings.TrimSpace(s))
	if strings.HasPrefix(s, "+84") {
		s = "0" + s[3:]
	} else if strings.HasPrefix(s, "84") && len(s) == 11 {
		s = "0" + s[2:]
	}
	return s
}

func field(d map[string]any, k string) string { s, _ := d[k].(string); return strings.TrimSpace(s) }

func okZaloURL(s string) bool {
	u, err := url.Parse(s)
	return err == nil && u.Scheme == "https" && (u.Host == "zalo.me" || u.Host == "oa.zalo.me")
}

func (a *App) apiRegister(w http.ResponseWriter, r *http.Request) {
	ip := clientIP(r)
	win := 10 * time.Minute
	if !a.rl.ok("reg", ip, 5, win) || !a.rl.ok("reg", "*", 200, win) {
		a.hubFail(w, r, 429, "rate_limited", "Bạn gửi quá nhiều lần. Vui lòng thử lại sau 10 phút.", "")
		return
	}
	d, err := readJSON(r, 16*1024)
	if err != nil {
		a.hubFail(w, r, 400, "validation", "Dữ liệu gửi lên không hợp lệ. Tải lại trang rồi thử lại.", "")
		return
	}
	if truthy(d["website"]) { // bẫy bot: trả thành công giả, không gửi đi đâu
		a.sendJSON(w, r, 201, map[string]any{"data": map[string]string{"code": "KH-" + strings.ToUpper(randHex(2)), "zalo_url": "", "expires_at": time.Now().Add(7 * 24 * time.Hour).UTC().Format(time.RFC3339), "product_name": ""}}, noStore)
		return
	}
	if !a.hub.ready() {
		a.hubFail(w, r, 503, "unavailable", "Chưa mở đăng ký trực tuyến. Vui lòng gọi hotline trên trang.", "")
		return
	}
	name := clip(field(d, "full_name"), 100)
	phone := normPhone(field(d, "phone"))
	code := clip(field(d, "product_code"), 40)
	consentText := clip(field(d, "consent_text"), 1000)
	switch {
	case utf8.RuneCountInString(name) < 2:
		a.hubFail(w, r, 400, "validation", "Nhập họ và tên của bạn (ít nhất 2 ký tự).", "full_name")
		return
	case !vnMobileRe.MatchString(phone):
		a.hubFail(w, r, 400, "validation", "Số điện thoại chưa đúng. Nhập số di động 10 chữ số, bắt đầu bằng 0, ví dụ 0912345678.", "phone")
		return
	case code == "":
		a.hubFail(w, r, 400, "validation", "Chọn sản phẩm bạn muốn đăng ký.", "product_code")
		return
	case d["consent"] != true || consentText == "":
		a.hubFail(w, r, 400, "validation", "Bạn cần tích vào ô đồng ý để chúng tôi được liên hệ tư vấn.", "consent")
		return
	}
	prods, _ := a.hub.products(r.Context())
	pname := ""
	if prods != nil {
		for _, p := range prods {
			if p.Code == code {
				pname = p.Name
			}
		}
		if pname == "" {
			a.hubFail(w, r, 400, "validation", "Sản phẩm này hiện không nhận đăng ký. Chọn sản phẩm khác trong danh sách.", "product_code")
			return
		}
	}
	src := clip(field(d, "source_url"), 500)
	if !strings.HasPrefix(src, "https://") && !strings.HasPrefix(src, "http://") {
		src = ""
	}
	utm := map[string]string{"source": "", "medium": "", "campaign": "", "content": "", "term": ""}
	if u, ok := d["utm"].(map[string]any); ok {
		for k := range utm {
			s, _ := u[k].(string)
			utm[k] = clip(s, 100)
		}
	}
	ref := field(d, "ref")
	if !refRe.MatchString(ref) {
		ref = ""
	}
	body := map[string]any{
		"full_name": name, "phone": phone, "product_code": code,
		"province": clip(field(d, "province"), 60), "note": clip(field(d, "note"), 500),
		"consent": true, "consent_text": consentText, "source_url": src, "utm": utm, "ref": ref,
	}
	st, data, herr, err := a.hub.call(r.Context(), http.MethodPost, "/api/v1/public/customer-leads", body)
	if err != nil {
		log.Printf("3RDHub: gửi đăng ký lỗi kết nối: %v", err)
		a.hubFail(w, r, 502, "unavailable", msgHubDown, "")
		return
	}
	msg := func(def string) string {
		if herr != nil && strings.TrimSpace(herr.Message) != "" {
			return clip(herr.Message, 300)
		}
		return def
	}
	switch {
	case (st == 201 || st == 200 || st == 409) && data != nil:
		var res struct {
			Code      string `json:"code"`
			ZaloURL   string `json:"zalo_url"`
			ExpiresAt string `json:"expires_at"`
		}
		if json.Unmarshal(data, &res) != nil || !leadCodeRe.MatchString(res.Code) {
			log.Printf("3RDHub: phản hồi đăng ký thiếu mã hợp lệ (HTTP %d)", st)
			a.hubFail(w, r, 502, "unavailable", msgHubDown, "")
			return
		}
		if !okZaloURL(res.ZaloURL) {
			res.ZaloURL = ""
		}
		if _, e := time.Parse(time.RFC3339, res.ExpiresAt); e != nil {
			res.ExpiresAt = ""
		}
		a.sendJSON(w, r, 201, map[string]any{"data": map[string]any{"code": res.Code, "zalo_url": res.ZaloURL, "expires_at": res.ExpiresAt, "product_name": pname, "duplicate": st == 409}}, noStore)
	case st == 400:
		a.hubFail(w, r, 400, "validation", msg("Thông tin chưa hợp lệ. Kiểm tra lại các ô rồi gửi lại."), "")
	case st == 409:
		a.hubFail(w, r, 409, "duplicate", msg("Số điện thoại này vừa đăng ký sản phẩm này. Nhân viên sẽ liên hệ bạn sớm."), "")
	case st == 429:
		a.hubFail(w, r, 429, "rate_limited", msg("Bạn gửi quá nhiều lần. Vui lòng thử lại sau ít phút."), "")
	case st == 401 || st == 403:
		log.Printf("3RDHub từ chối HUB_SITE_KEY (HTTP %d) khi gửi đăng ký: kiểm tra lại khoá trong biến môi trường", st)
		a.hubFail(w, r, 503, "unavailable", msgHubDown, "")
	default:
		log.Printf("3RDHub: gửi đăng ký trả HTTP %d", st)
		a.hubFail(w, r, 502, "unavailable", msgHubDown, "")
	}
}
