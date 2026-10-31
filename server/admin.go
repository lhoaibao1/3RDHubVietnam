package main

import (
	"bytes"
	"context"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

var (
	revRestoreRe = regexp.MustCompile(`^revisions/(\d+)/restore$`)
	leadIDRe     = regexp.MustCompile(`^leads/(\d+)$`)
	nonSlugRe    = regexp.MustCompile(`[^a-z0-9]+`)
	leadStatus   = map[string]bool{"new": true, "contacted": true, "done": true, "spam": true}
)

func detectImage(b []byte) string {
	switch {
	case bytes.HasPrefix(b, []byte("\x89PNG\r\n\x1a\n")):
		return "png"
	case bytes.HasPrefix(b, []byte("\xff\xd8\xff")):
		return "jpg"
	case len(b) >= 12 && string(b[:4]) == "RIFF" && string(b[8:12]) == "WEBP":
		return "webp"
	case bytes.HasPrefix(b, []byte("GIF87a")), bytes.HasPrefix(b, []byte("GIF89a")):
		return "gif"
	}
	return ""
}

func (a *App) authed(ctx context.Context, r *http.Request) bool {
	if r.Header.Get("X-CMS") != "1" && r.Method != http.MethodGet && r.Method != http.MethodHead {
		return false
	}
	ck, err := r.Cookie("cms_session")
	if err != nil {
		return false
	}
	tok, err := url.QueryUnescape(ck.Value)
	if err != nil {
		tok = ck.Value
	}
	var secret, hash string
	if _, err := kvGet(ctx, a.pool, "secret", &secret); err != nil {
		return false
	}
	if _, err := kvGet(ctx, a.pool, "admin_hash", &hash); err != nil {
		return false
	}
	return verifyToken(secret, hash, tok)
}

func (a *App) sessionCookie(r *http.Request, ctx context.Context) (string, error) {
	var secret, hash string
	if _, err := kvGet(ctx, a.pool, "secret", &secret); err != nil {
		return "", err
	}
	if _, err := kvGet(ctx, a.pool, "admin_hash", &hash); err != nil {
		return "", err
	}
	c := "cms_session=" + url.QueryEscape(makeToken(secret, hash, a.cfg.SessionTTL)) + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + strconv.FormatInt(a.cfg.SessionTTL, 10)
	if secure(r) {
		c += "; Secure"
	}
	return c, nil
}

// saveContent lưu nội dung, ghi một bản lịch sử và chỉ giữ 60 bản gần nhất.
func (a *App) saveContent(ctx context.Context, c Content, note string) error {
	if r := []rune(note); len(r) > 200 {
		note = string(r[:200])
	}
	snap, _ := json.Marshal(c)
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	now := time.Now().Unix()
	if err := kvSet(ctx, tx, "content", c); err != nil {
		return err
	}
	if err := kvSet(ctx, tx, "updated", now); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO revisions(ts,note,snapshot) VALUES($1,$2,$3::jsonb)`, now, note, string(snap)); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM revisions WHERE id NOT IN (SELECT id FROM revisions ORDER BY id DESC LIMIT 60)`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type leadRow struct {
	ID      int64  `json:"id"`
	TS      int64  `json:"ts"`
	Name    string `json:"name"`
	Phone   string `json:"phone"`
	Company string `json:"company"`
	Need    string `json:"need"`
	Message string `json:"message"`
	Lang    string `json:"lang"`
	IP      string `json:"ip"`
	UA      string `json:"ua"`
	Status  string `json:"status"`
	Note    string `json:"note"`
	Email   string `json:"email"`
	// Zalo OA: mã ghép và trạng thái đã ghép (không gửi Zalo user id ra trình duyệt)
	ZaloCode   string `json:"zalo_code"`
	ZaloExp    int64  `json:"zalo_code_exp"`
	ZaloLinked bool   `json:"zalo_linked"`
}

const leadCols = `id,ts,name,phone,company,need,message,lang,ip,ua,status,note,email,zalo_code,zalo_code_exp,zalo_uid<>''`

func scanLeads(rows pgx.Rows) ([]leadRow, error) {
	defer rows.Close()
	out := []leadRow{}
	for rows.Next() {
		var l leadRow
		if err := rows.Scan(&l.ID, &l.TS, &l.Name, &l.Phone, &l.Company, &l.Need, &l.Message, &l.Lang, &l.IP, &l.UA, &l.Status, &l.Note, &l.Email, &l.ZaloCode, &l.ZaloExp, &l.ZaloLinked); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

func likeEscape(s string) string {
	return strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(s)
}

func (a *App) apiAdmin(w http.ResponseWriter, r *http.Request, sub string) {
	ctx := r.Context()
	if err := a.adminRoute(w, r, ctx, sub); err != nil {
		a.handleErr(w, r, err)
	}
}

func (a *App) adminRoute(w http.ResponseWriter, r *http.Request, ctx context.Context, sub string) error {
	m := r.Method
	if sub == "login" && m == http.MethodPost {
		ip := clientIP(r)
		win := 10 * time.Minute
		if !a.rl.peek("login", ip, 8, win) || !a.rl.peek("login", "*", 60, win) {
			a.fail(w, r, 429, "Đăng nhập sai quá nhiều lần, thử lại sau 10 phút.")
			return nil
		}
		d, err := readJSON(r, 4096)
		if err != nil {
			return err
		}
		var hash string
		kvGet(ctx, a.pool, "admin_hash", &hash)
		pw, _ := d["password"].(string)
		if !checkPW(pw, hash) {
			a.rl.hit("login", ip)
			a.rl.hit("login", "*")
			time.Sleep(600 * time.Millisecond)
			a.fail(w, r, 401, "Mật khẩu không đúng.")
			return nil
		}
		ck, err := a.sessionCookie(r, ctx)
		if err != nil {
			return err
		}
		a.sendJSON(w, r, 200, map[string]any{"ok": true}, map[string]string{"Set-Cookie": ck, "Cache-Control": "no-store"})
		return nil
	}
	if sub == "logout" && m == http.MethodPost {
		a.sendJSON(w, r, 200, map[string]any{"ok": true}, map[string]string{"Set-Cookie": "cms_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"})
		return nil
	}
	if !a.authed(ctx, r) {
		a.fail(w, r, 401, "Chưa đăng nhập")
		return nil
	}
	ok := func(v any) error { a.sendJSON(w, r, 200, v, noStore); return nil }
	if v, hit, err := a.guardAdmin(ctx, w, r, sub); hit {
		if err != nil {
			return err
		}
		return ok(v)
	}
	if v, hit, err := a.zaloAdmin(ctx, w, r, sub); hit {
		if err != nil {
			return err
		}
		return ok(v)
	}

	switch {
	case sub == "me":
		return ok(map[string]any{"ok": true})

	case sub == "bootstrap":
		c, upd, err := a.currentContent(ctx)
		if err != nil {
			return err
		}
		counts := map[string]int64{}
		rows, err := a.pool.Query(ctx, `SELECT status, COUNT(*) FROM leads GROUP BY status`)
		if err != nil {
			return err
		}
		for rows.Next() {
			var s string
			var n int64
			if err := rows.Scan(&s, &n); err != nil {
				rows.Close()
				return err
			}
			counts[s] = n
		}
		rows.Close()
		return ok(map[string]any{
			"content":  c,
			"defaults": map[string]any{"faq": a.defaults.Faq, "partners": a.defaults.Partners, "settings": a.defaults.Settings, "legal": a.defaults.Legal, "quote": a.defaults.Quote, "clients": a.defaults.Clients, "product": a.defaults.Product},
			"leads":    counts, "updated": upd,
		})

	case sub == "content" && m == http.MethodPut:
		d, err := readJSON(r, maxJSON)
		if err != nil {
			return err
		}
		c, err := cleanContent(d["content"])
		if err != nil {
			return err
		}
		note, _ := d["note"].(string)
		if note == "" {
			note = "Lưu thay đổi"
		}
		// tự dịch Việt -> Anh những đoạn English còn trống hoặc đã cũ (người dùng không cần tự dịch)
		prev, _, _ := a.currentContent(ctx)
		tdone, tfail := a.autoTranslate(ctx, &c, prev)
		if err := a.saveContent(ctx, c, note); err != nil {
			return err
		}
		_, upd, _ := a.currentContent(ctx)
		return ok(map[string]any{"ok": true, "content": c, "updated": upd, "translated": tdone, "translate_failed": tfail})

	case sub == "smtp" && m == http.MethodGet:
		c := a.loadSMTP(ctx)
		has := c.PassEnc != ""
		c.PassEnc = ""
		return ok(map[string]any{"smtp": c, "has_password": has})

	case sub == "smtp" && m == http.MethodPut:
		d, err := readJSON(r, 8192)
		if err != nil {
			return err
		}
		cur := a.loadSMTP(ctx)
		c, err := cleanSMTP(d, cur)
		if err != nil {
			return err
		}
		if truthy(d["clear_password"]) {
			c.PassEnc = ""
		}
		if pw, _ := d["password"].(string); pw != "" {
			if len(pw) > 200 || strings.ContainsAny(pw, "\r\n\x00") {
				return bad("Mật khẩu SMTP không hợp lệ")
			}
			if c.PassEnc, err = a.seal(pw); err != nil {
				return err
			}
		}
		if err := kvSetPool(ctx, a.pool, "smtp", c); err != nil {
			return err
		}
		has := c.PassEnc != ""
		c.PassEnc = ""
		return ok(map[string]any{"ok": true, "smtp": c, "has_password": has})

	case sub == "smtp-test" && m == http.MethodPost:
		if !a.rl.ok("smtptest", clientIP(r), 6, 10*time.Minute) {
			a.fail(w, r, 429, "Gửi thử quá nhiều lần, thử lại sau ít phút.")
			return nil
		}
		d, err := readJSON(r, 2048)
		if err != nil {
			return err
		}
		to, err := strip(d["to"], 200, "Email nhận")
		if err != nil {
			return err
		}
		if !emailRe.MatchString(to) || !noCRLF(to) {
			return bad("Email nhận thử không hợp lệ")
		}
		b := a.brandInfo(ctx, siteBase(r))
		html := renderMail(mailData{B: b, Lang: "vi", Pre: "Cấu hình email của website đã hoạt động.", Kicker: "Gửi thử thành công", Title: "Email của website đã sẵn sàng",
			Lead: "Đây là thư gửi thử từ trang quản trị 3RDHub CMS. Bạn đọc được thư này nghĩa là máy chủ gửi thư (SMTP) đã cấu hình đúng; khách hàng sẽ nhận thư với giao diện như thế này.",
			Rows: []mailRow{{"Máy chủ", a.loadSMTP(ctx).Host}, {"Người gửi", a.loadSMTP(ctx).FromEmail}, {"Thời gian", time.Now().In(vnZone()).Format("15:04 · 02/01/2006")}}, CTA: "Mở website", URL: b.Site})
		if err := a.sendMail(ctx, []string{to}, "✅ Gửi thử email từ 3RDHub CMS", "Đây là email gửi thử từ trang quản trị 3RDHub CMS.\nNếu bạn đọc được thư này thì cấu hình SMTP đã hoạt động.\n", html); err != nil {
			return bad("%v", err)
		}
		return ok(map[string]any{"ok": true})

	case sub == "zalo" && m == http.MethodGet:
		return ok(publicZalo(a.loadZalo(ctx)))

	case sub == "zalo" && m == http.MethodPut:
		d, err := readJSON(r, 16384)
		if err != nil {
			return err
		}
		zaloMu.Lock()
		c, err := cleanZalo(a, d, a.loadZalo(ctx))
		if err == nil {
			if truthy(d["clear_bot_token"]) {
				c.BotToken = ""
			}
			err = kvSetPool(ctx, a.pool, "zalo", c)
		}
		zaloMu.Unlock()
		if err != nil {
			return err
		}
		return ok(publicZalo(c))

	case sub == "zalo-bot-test" && m == http.MethodPost:
		if !a.rl.ok("zalotest", clientIP(r), 10, 10*time.Minute) {
			a.fail(w, r, 429, "Thử quá nhiều lần, đợi ít phút.")
			return nil
		}
		if err := a.zaloBotSend(ctx, a.loadZalo(ctx), "✅ Zalo Bot của 3RDHub CMS đã kết nối. Khi có người đăng ký trên website, tin báo sẽ gửi vào đây."); err != nil {
			return bad("%v", err)
		}
		return ok(map[string]any{"ok": true})

	case sub == "zalo-bot-chats" && m == http.MethodPost:
		tok, _ := a.unseal(a.loadZalo(ctx).BotToken)
		if tok == "" {
			return bad("Lưu token Zalo Bot trước")
		}
		res, err := a.zaloBotCall(ctx, tok, "getUpdates", map[string]any{"timeout": 1})
		if err != nil {
			return bad("%v (nếu bot đang dùng webhook thì không lấy được tin; hãy nhắn bot rồi thử lại)", err)
		}
		seen := map[string]string{}
		var walk func(v any)
		walk = func(v any) {
			switch t := v.(type) {
			case map[string]any:
				if ch, ok := t["chat"].(map[string]any); ok {
					id := fmt.Sprint(ch["id"])
					name, _ := ch["display_name"].(string)
					if name == "" {
						if f, ok := t["from"].(map[string]any); ok {
							name, _ = f["display_name"].(string)
						}
					}
					seen[id] = name
				}
				for _, x := range t {
					walk(x)
				}
			case []any:
				for _, x := range t {
					walk(x)
				}
			}
		}
		walk(res)
		var list []map[string]string
		for id, n := range seen {
			list = append(list, map[string]string{"id": id, "name": n})
		}
		return ok(map[string]any{"chats": list})

	case sub == "notify-log" && m == http.MethodGet:
		var list []notifyEntry
		kvGet(ctx, a.pool, "notify_log", &list)
		if list == nil {
			list = []notifyEntry{}
		}
		return ok(list)

	case sub == "email-preview" && m == http.MethodGet:
		b := a.brandInfo(ctx, siteBase(r))
		l := sampleLead()
		var html string
		switch r.URL.Query().Get("kind") {
		case "staff":
			_, _, html = staffMail(b, l, cmsURL(b.Site))
		case "customer-en":
			l.Lang = "en"
			_, _, html = customerMail(b, l)
		default:
			_, _, html = customerMail(b, l)
		}
		a.send(w, r, 200, []byte(html), "text/html; charset=utf-8", map[string]string{"Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; img-src * data:; style-src 'unsafe-inline'"})
		return nil

	case sub == "revisions" && m == http.MethodGet:
		rows, err := a.pool.Query(ctx, `SELECT id,ts,note,snapshot FROM revisions ORDER BY id DESC LIMIT 60`)
		if err != nil {
			return err
		}
		defer rows.Close()
		out := []map[string]any{}
		for rows.Next() {
			var id, ts int64
			var note string
			var snap []byte
			if err := rows.Scan(&id, &ts, &note, &snap); err != nil {
				return err
			}
			var c Content
			json.Unmarshal(snap, &c)
			out = append(out, map[string]any{"id": id, "ts": ts, "note": note, "ov": len(c.Ov), "faq": len(c.Faq), "partners": len(c.Partners)})
		}
		return ok(out)

	case revRestoreRe.MatchString(sub) && m == http.MethodPost:
		id, _ := strconv.ParseInt(revRestoreRe.FindStringSubmatch(sub)[1], 10, 64)
		var ts int64
		var snap []byte
		err := a.pool.QueryRow(ctx, `SELECT ts,snapshot FROM revisions WHERE id=$1`, id).Scan(&ts, &snap)
		if err == pgx.ErrNoRows {
			a.fail(w, r, 404, "Không tìm thấy phiên bản")
			return nil
		}
		if err != nil {
			return err
		}
		var raw any
		json.Unmarshal(snap, &raw)
		c, err := cleanContent(raw)
		if err != nil {
			return err
		}
		if err := a.saveContent(ctx, c, "Khôi phục phiên bản "+time.Unix(ts, 0).Format("02/01/2006 15:04")); err != nil {
			return err
		}
		return ok(map[string]any{"ok": true, "content": c})

	case sub == "leads" && m == http.MethodGet:
		q := r.URL.Query()
		var where []string
		var args []any
		if st := q.Get("status"); leadStatus[st] {
			args = append(args, st)
			where = append(where, "status=$"+strconv.Itoa(len(args)))
		}
		if s := strings.TrimSpace(q.Get("q")); s != "" {
			args = append(args, "%"+likeEscape(s)+"%")
			n := strconv.Itoa(len(args))
			where = append(where, "(name ILIKE $"+n+" OR phone ILIKE $"+n+" OR email ILIKE $"+n+" OR company ILIKE $"+n+" OR message ILIKE $"+n+")")
		}
		sql := `SELECT ` + leadCols + ` FROM leads`
		if len(where) > 0 {
			sql += " WHERE " + strings.Join(where, " AND ")
		}
		rows, err := a.pool.Query(ctx, sql+` ORDER BY id DESC LIMIT 500`, args...)
		if err != nil {
			return err
		}
		out, err := scanLeads(rows)
		if err != nil {
			return err
		}
		return ok(out)

	case sub == "leads.csv" && m == http.MethodGet:
		rows, err := a.pool.Query(ctx, `SELECT `+leadCols+` FROM leads ORDER BY id DESC`)
		if err != nil {
			return err
		}
		ls, err := scanLeads(rows)
		if err != nil {
			return err
		}
		var buf bytes.Buffer
		buf.Write([]byte{0xEF, 0xBB, 0xBF})
		cw := csv.NewWriter(&buf)
		cw.Write([]string{"ID", "Thời gian", "Họ tên", "Số điện thoại", "Email", "Công ty", "Nhu cầu", "Nội dung", "Ngôn ngữ", "Trạng thái", "Ghi chú"})
		for _, l := range ls {
			cw.Write([]string{strconv.FormatInt(l.ID, 10), time.Unix(l.TS, 0).Format("2006-01-02 15:04:05"), l.Name, l.Phone, l.Email, l.Company, l.Need, l.Message, l.Lang, l.Status, l.Note})
		}
		cw.Flush()
		a.send(w, r, 200, buf.Bytes(), "text/csv; charset=utf-8", map[string]string{"Content-Disposition": `attachment; filename="yeu-cau-khach-hang.csv"`, "Cache-Control": "no-store"})
		return nil

	case leadIDRe.MatchString(sub) && m == http.MethodPatch:
		id, _ := strconv.ParseInt(leadIDRe.FindStringSubmatch(sub)[1], 10, 64)
		d, err := readJSON(r, 20*1024)
		if err != nil {
			return err
		}
		if v, has := d["status"]; has {
			st, _ := v.(string)
			if !leadStatus[st] {
				return bad("Trạng thái không hợp lệ")
			}
			if _, err := a.pool.Exec(ctx, `UPDATE leads SET status=$1 WHERE id=$2`, st, id); err != nil {
				return err
			}
		}
		if v, has := d["note"]; has {
			note, err := str(v, 2000, "giá trị")
			if err != nil {
				return err
			}
			if _, err := a.pool.Exec(ctx, `UPDATE leads SET note=$1 WHERE id=$2`, note, id); err != nil {
				return err
			}
		}
		return ok(map[string]any{"ok": true})

	case leadIDRe.MatchString(sub) && m == http.MethodDelete:
		id, _ := strconv.ParseInt(leadIDRe.FindStringSubmatch(sub)[1], 10, 64)
		if _, err := a.pool.Exec(ctx, `DELETE FROM leads WHERE id=$1`, id); err != nil {
			return err
		}
		return ok(map[string]any{"ok": true})

	case sub == "upload" && m == http.MethodPost:
		raw, err := readBody(r, maxUpload)
		if err == errTooBig {
			return bad("Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF (tối đa 2MB).")
		}
		if err != nil {
			return err
		}
		ext := detectImage(raw)
		if len(raw) == 0 || ext == "" {
			return bad("Chỉ nhận ảnh PNG, JPG, WEBP hoặc GIF (tối đa 2MB).")
		}
		name := r.Header.Get("X-Filename")
		if un, err := url.PathUnescape(name); err == nil {
			name = un
		}
		if name == "" {
			name = "logo"
		}
		base := strings.Trim(nonSlugRe.ReplaceAllString(strings.ToLower(strings.TrimSuffix(path.Base(name), path.Ext(name))), "-"), "-")
		if len(base) > 30 {
			base = strings.Trim(base[:30], "-")
		}
		if base == "" {
			base = "logo"
		}
		fn := randHex(4) + "-" + base + "." + ext
		if err := os.WriteFile(filepath.Join(a.uploads(), fn), raw, 0o644); err != nil {
			return err
		}
		return ok(map[string]any{"ok": true, "path": "/uploads/" + fn})

	case sub == "password" && m == http.MethodPost:
		d, err := readJSON(r, 4096)
		if err != nil {
			return err
		}
		var hash string
		kvGet(ctx, a.pool, "admin_hash", &hash)
		cur, _ := d["current"].(string)
		if !checkPW(cur, hash) {
			a.fail(w, r, 400, "Mật khẩu hiện tại không đúng.")
			return nil
		}
		nw, _ := d["new"].(string)
		if len([]rune(nw)) < 10 {
			return bad("Mật khẩu mới cần ít nhất 10 ký tự.")
		}
		if err := kvSetPool(ctx, a.pool, "admin_hash", hashPW(nw)); err != nil {
			return err
		}
		ck, err := a.sessionCookie(r, ctx)
		if err != nil {
			return err
		}
		a.sendJSON(w, r, 200, map[string]any{"ok": true}, map[string]string{"Set-Cookie": ck, "Cache-Control": "no-store"})
		return nil
	}
	a.fail(w, r, 404, "Không tìm thấy")
	return nil
}
