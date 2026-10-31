package main

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Thống kê truy cập tự đo (không dùng dịch vụ ngoài, không cookie, không lưu IP): trình duyệt gửi một báo cáo nhỏ mỗi lần xem trang
// tới /api/hit. Số khách khác nhau đếm bằng mã ẩn danh đổi mỗi ngày nên không theo dõi được một người qua nhiều ngày.

var botUARe = regexp.MustCompile(`(?i)bot|spider|crawl|slurp|headless|phantom|lighthouse|pagespeed|curl/|wget|python|go-http|java/|libwww|okhttp|axios|node-fetch|monitor|uptime|preview|facebookexternalhit|zalo|telegram|discord|whatsapp|skype`)
var statPathRe = regexp.MustCompile(`^/[A-Za-z0-9_/-]{0,80}$`)

func vnLoc() *time.Location {
	if l, err := time.LoadLocation("Asia/Ho_Chi_Minh"); err == nil {
		return l
	}
	return time.FixedZone("ICT", 7*3600)
}

func parseUA(ua string, width int) (dev, br, os string) {
	l := strings.ToLower(ua)
	switch {
	case strings.Contains(l, "iphone"), strings.Contains(l, "android") && strings.Contains(l, "mobile"), strings.Contains(l, "ipod"):
		dev = "mobile"
	case strings.Contains(l, "ipad"), strings.Contains(l, "tablet"), strings.Contains(l, "android"):
		dev = "tablet"
	default:
		dev = "desktop"
		if width > 0 && width < 700 {
			dev = "mobile"
		}
	}
	switch {
	case strings.Contains(l, "coc_coc"), strings.Contains(l, "coccoc"):
		br = "Cốc Cốc"
	case strings.Contains(l, "edg/"), strings.Contains(l, "edga/"), strings.Contains(l, "edgios/"):
		br = "Edge"
	case strings.Contains(l, "opr/"), strings.Contains(l, "opera"):
		br = "Opera"
	case strings.Contains(l, "samsungbrowser"):
		br = "Samsung Internet"
	case strings.Contains(l, "firefox/"), strings.Contains(l, "fxios"):
		br = "Firefox"
	case strings.Contains(l, "zalo"):
		br = "Zalo"
	case strings.Contains(l, "fban"), strings.Contains(l, "fbav"):
		br = "Facebook"
	case strings.Contains(l, "chrome/"), strings.Contains(l, "crios"):
		br = "Chrome"
	case strings.Contains(l, "safari/"):
		br = "Safari"
	default:
		br = "Khác"
	}
	switch {
	case strings.Contains(l, "windows"):
		os = "Windows"
	case strings.Contains(l, "iphone"), strings.Contains(l, "ipad"), strings.Contains(l, "ipod"):
		os = "iOS"
	case strings.Contains(l, "android"):
		os = "Android"
	case strings.Contains(l, "mac os"), strings.Contains(l, "macintosh"):
		os = "macOS"
	case strings.Contains(l, "cros"):
		os = "ChromeOS"
	case strings.Contains(l, "linux"):
		os = "Linux"
	default:
		os = "Khác"
	}
	return
}

var searchHosts = []string{"google.", "bing.", "coccoc.", "duckduckgo.", "yahoo.", "baidu.", "yandex.", "ecosia."}
var socialHosts = []string{"facebook.", "fb.com", "fb.me", "messenger.", "zalo.", "tiktok.", "youtube.", "youtu.be", "instagram.", "linkedin.", "lnkd.in", "twitter.", "t.co", "x.com", "reddit.", "pinterest.", "telegram.", "t.me"}

// channelOf phân loại nguồn truy cập theo tên miền giới thiệu hoặc utm_source.
func channelOf(ref, utm, ownHost string) (ch, name string) {
	if utm != "" {
		return "campaign", utm
	}
	if ref == "" {
		return "direct", ""
	}
	u, err := url.Parse(ref)
	if err != nil || u.Host == "" {
		return "direct", ""
	}
	h := strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
	if h == ownHost || strings.HasSuffix(h, "."+ownHost) {
		return "direct", ""
	}
	for _, s := range searchHosts {
		if strings.Contains(h, s) {
			return "search", h
		}
	}
	for _, s := range socialHosts {
		if strings.Contains(h, s) {
			return "social", h
		}
	}
	return "referral", h
}

func (a *App) statsHit(w http.ResponseWriter, r *http.Request) {
	done := func() { a.send(w, r, 204, nil, "text/plain", noStore) }
	if r.Method != http.MethodPost {
		a.fail(w, r, 404, "Không tìm thấy")
		return
	}
	ua := r.UserAgent()
	ip := clientIP(r)
	if ua == "" || botUARe.MatchString(ua) || !a.rl.ok("hit", ip, 90, time.Minute) {
		done()
		return
	}
	d, err := readJSON(r, 2048)
	if err != nil {
		done()
		return
	}
	path, _ := d["p"].(string)
	if !statPathRe.MatchString(path) {
		done()
		return
	}
	lang, _ := d["l"].(string)
	if lang != "vi" && lang != "en" {
		lang = ""
	}
	ref, _ := d["r"].(string)
	utm, _ := d["u"].(string)
	if len(ref) > 300 {
		ref = ""
	}
	utm = strings.TrimSpace(utm)
	if len(utm) > 40 || !regexp.MustCompile(`^[A-Za-z0-9._ -]*$`).MatchString(utm) {
		utm = ""
	}
	width, _ := d["w"].(float64)
	key, err := a.secretKey()
	if err != nil {
		done()
		return
	}
	now := time.Now()
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(now.In(vnLoc()).Format("2006-01-02") + "|" + ip + "|" + ua))
	vid := hex.EncodeToString(mac.Sum(nil))[:16]
	own := strings.TrimPrefix(strings.ToLower(strings.TrimPrefix(r.Host, "cms.")), "www.")
	own = strings.Split(own, ":")[0]
	ch, name := channelOf(ref, utm, own)
	dev, br, osn := parseUA(ua, int(width))
	cc := strings.ToUpper(strings.TrimSpace(r.Header.Get("CF-IPCountry")))
	if len(cc) != 2 || cc == "XX" || cc == "T1" {
		cc = ""
	}
	a.pool.Exec(r.Context(), `INSERT INTO stats_hits(ts,vid,path,ref,ch,cc,dev,br,os,lang) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, now.Unix(), vid, path, name, ch, cc, dev, br, osn, lang)
	done()
}

// ---- thống kê cho trang Tổng quan

type statCount struct {
	K string `json:"k"`
	N int64  `json:"n"`
	V int64  `json:"v"`
}

func (a *App) statTop(ctx context.Context, col string, from, to int64, limit int) []statCount {
	out := []statCount{}
	rows, err := a.pool.Query(ctx, `SELECT `+col+`, count(*), count(DISTINCT vid) FROM stats_hits WHERE ts>=$1 AND ts<$2 GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT $3`, from, to, limit)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var c statCount
		if rows.Scan(&c.K, &c.N, &c.V) == nil {
			out = append(out, c)
		}
	}
	return out
}

func (a *App) statsAdmin(ctx context.Context, r *http.Request) (map[string]any, error) {
	days, _ := strconv.Atoi(r.URL.Query().Get("days"))
	if days != 1 && days != 7 && days != 30 && days != 90 {
		days = 7
	}
	loc := vnLoc()
	now := time.Now()
	hourly := days == 1
	// kỳ hiện tại: tính theo ngày lịch giờ Việt Nam (hôm nay là một phần của kỳ)
	var start time.Time
	step := 24 * time.Hour
	if hourly {
		start = now.In(loc).Truncate(time.Hour).Add(-23 * time.Hour)
		step = time.Hour
	} else {
		d := now.In(loc)
		start = time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, -(days - 1))
	}
	from, to := start.Unix(), now.Unix()+1
	span := to - from
	pfrom, pto := from-span, from

	one := func(q string, args ...any) (a1, a2 int64) {
		a.pool.QueryRow(ctx, q, args...).Scan(&a1, &a2)
		return
	}
	views, vis := one(`SELECT count(*), count(DISTINCT vid) FROM stats_hits WHERE ts>=$1 AND ts<$2`, from, to)
	pviews, pvis := one(`SELECT count(*), count(DISTINCT vid) FROM stats_hits WHERE ts>=$1 AND ts<$2`, pfrom, pto)
	leads, _ := one(`SELECT count(*), 0 FROM leads WHERE ts>=$1 AND ts<$2 AND status<>'spam'`, from, to)
	pleads, _ := one(`SELECT count(*), 0 FROM leads WHERE ts>=$1 AND ts<$2 AND status<>'spam'`, pfrom, pto)
	online, _ := one(`SELECT count(DISTINCT vid), 0 FROM stats_hits WHERE ts>=$1`, now.Unix()-300)
	totalHits, _ := one(`SELECT count(*), 0 FROM stats_hits`)

	// chuỗi thời gian (điền đủ các mốc, không để khoảng trống)
	trunc, layout := "day", "2006-01-02"
	if hourly {
		trunc, layout = "hour", "2006-01-02 15"
	}
	type pt struct{ v, u, l int64 }
	m := map[string]*pt{}
	rows, _ := a.pool.Query(ctx, `SELECT to_char(date_trunc('`+trunc+`', to_timestamp(ts) AT TIME ZONE 'Asia/Ho_Chi_Minh'), '`+map[bool]string{true: "YYYY-MM-DD HH24", false: "YYYY-MM-DD"}[hourly]+`'), count(*), count(DISTINCT vid) FROM stats_hits WHERE ts>=$1 AND ts<$2 GROUP BY 1`, from, to)
	if rows != nil {
		for rows.Next() {
			var k string
			var v, u int64
			if rows.Scan(&k, &v, &u) == nil {
				m[k] = &pt{v: v, u: u}
			}
		}
		rows.Close()
	}
	rows, _ = a.pool.Query(ctx, `SELECT to_char(date_trunc('`+trunc+`', to_timestamp(ts) AT TIME ZONE 'Asia/Ho_Chi_Minh'), '`+map[bool]string{true: "YYYY-MM-DD HH24", false: "YYYY-MM-DD"}[hourly]+`'), count(*) FROM leads WHERE ts>=$1 AND ts<$2 AND status<>'spam' GROUP BY 1`, from, to)
	if rows != nil {
		for rows.Next() {
			var k string
			var n int64
			if rows.Scan(&k, &n) == nil {
				if m[k] == nil {
					m[k] = &pt{}
				}
				m[k].l = n
			}
		}
		rows.Close()
	}
	series := []map[string]any{}
	for t := start; t.Unix() < to; t = t.Add(step) {
		if !hourly {
			t = time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, loc)
		}
		k := t.In(loc).Format(layout)
		p := m[k]
		if p == nil {
			p = &pt{}
		}
		series = append(series, map[string]any{"t": k, "views": p.v, "visitors": p.u, "leads": p.l})
	}

	// yêu cầu khách
	byStatus := map[string]int64{}
	if rs, err := a.pool.Query(ctx, `SELECT status, count(*) FROM leads WHERE ts>=$1 AND ts<$2 GROUP BY 1`, from, to); err == nil {
		for rs.Next() {
			var s string
			var n int64
			if rs.Scan(&s, &n) == nil {
				byStatus[s] = n
			}
		}
		rs.Close()
	}
	needs := []statCount{}
	if rs, err := a.pool.Query(ctx, `SELECT COALESCE(NULLIF(need,''),'Chưa chọn'), count(*) FROM leads WHERE ts>=$1 AND ts<$2 AND status<>'spam' GROUP BY 1 ORDER BY 2 DESC LIMIT 6`, from, to); err == nil {
		for rs.Next() {
			var c statCount
			if rs.Scan(&c.K, &c.N) == nil {
				needs = append(needs, c)
			}
		}
		rs.Close()
	}
	recent := []map[string]any{}
	if rs, err := a.pool.Query(ctx, `SELECT id, ts, name, need, status FROM leads ORDER BY id DESC LIMIT 6`); err == nil {
		for rs.Next() {
			var id, ts int64
			var name, need, st string
			if rs.Scan(&id, &ts, &name, &need, &st) == nil {
				recent = append(recent, map[string]any{"id": id, "ts": ts, "name": name, "need": need, "status": st})
			}
		}
		rs.Close()
	}

	// hệ thống và bảo vệ
	g := a.guardState()
	bans, _ := a.guardActiveBans(ctx, false)
	g.mu.Lock()
	limited := 0
	for _, s := range g.seen {
		if now.Sub(s.Last) < time.Hour {
			limited++
		}
	}
	enforce := g.dir != ""
	g.mu.Unlock()
	smtp := a.loadSMTP(ctx)
	_, upd, _ := a.currentContent(ctx)

	return map[string]any{
		"ok": true, "days": days, "now": now.Unix(), "from": from, "hourly": hourly, "tracking_since_hits": totalHits,
		"totals":          map[string]any{"views": views, "visitors": vis, "leads": leads, "prev_views": pviews, "prev_visitors": pvis, "prev_leads": pleads, "online": online},
		"series":          series,
		"pages":           a.statTop(ctx, "path", from, to, 8),
		"sources":         a.statSources(ctx, from, to),
		"countries":       a.statTop(ctx, "NULLIF(cc,'')", from, to, 8),
		"devices":         a.statTop(ctx, "dev", from, to, 4),
		"browsers":        a.statTop(ctx, "br", from, to, 6),
		"os":              a.statTop(ctx, "os", from, to, 6),
		"langs":           a.statTop(ctx, "NULLIF(lang,'')", from, to, 3),
		"leads_by_status": byStatus, "needs": needs, "recent_leads": recent,
		"guard":  map[string]any{"bans": len(bans), "limited_1h": limited, "enforce": enforce},
		"system": map[string]any{"smtp": smtp.Host != "" && smtp.NotifyTo != "", "zalo": a.zoa.ready(), "cf": r.Header.Get("CF-Ray") != "", "content_updated": upd},
	}, nil
}

func (a *App) statSources(ctx context.Context, from, to int64) []map[string]any {
	out := []map[string]any{}
	rows, err := a.pool.Query(ctx, `SELECT ch, ref, count(*), count(DISTINCT vid) FROM stats_hits WHERE ts>=$1 AND ts<$2 GROUP BY 1,2 ORDER BY 3 DESC LIMIT 8`, from, to)
	if err != nil {
		return out
	}
	defer rows.Close()
	for rows.Next() {
		var ch, ref string
		var n, v int64
		if rows.Scan(&ch, &ref, &n, &v) == nil {
			out = append(out, map[string]any{"ch": ch, "k": ref, "n": n, "v": v})
		}
	}
	return out
}

// statsPrune xoá dữ liệu quá 400 ngày.
func (a *App) statsPrune(ctx context.Context) {
	a.pool.Exec(ctx, `DELETE FROM stats_hits WHERE ts < $1`, time.Now().Add(-400*24*time.Hour).Unix())
}
