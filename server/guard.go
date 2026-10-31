package main

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
)

// Chặn tấn công (DDoS, quét, bơm request). Ba lớp:
//  1. Cloudflare đứng trước (xem hướng dẫn trong CMS, tab "Chặn tấn công").
//  2. nginx giới hạn tốc độ theo IP thật (lấy từ CF-Connecting-IP, chỉ tin khi gói tin đến từ IP Cloudflare) và theo chữ ký
//     trình duyệt; request vượt giới hạn bị trả 429 và nginx chuyển báo cho backend (/api/guard/strike).
//  3. Backend đếm các lần bị 429: một IP bị quá nhiều lần thì cấm IP; một chữ ký trình duyệt bị quá nhiều lần từ nhiều IP
//     thì cấm cả "trình duyệt" đó. Danh sách cấm lưu ở CSDL, ghi ra file cho nginx (geo/map) rồi nginx tự nạp lại.
// Chữ ký trình duyệt = User-Agent | Accept-Language | Accept-Encoding | Sec-CH-UA | Sec-CH-UA-Platform.

type guardCfg struct {
	Enabled   bool     `json:"enabled"`
	IPStrikes int      `json:"ip_strikes"` // số lần bị 429 trong 1 phút thì cấm IP
	IPBanMin  int      `json:"ip_ban_min"` // phút cấm lần đầu; mỗi lần tái phạm gấp 4 (tối đa 7 ngày)
	FPStrikes int      `json:"fp_strikes"` // số lần bị 429 trong 1 phút của cùng một chữ ký trình duyệt...
	FPIPs     int      `json:"fp_ips"`     // ...từ ít nhất ngần này IP (mỗi IP bị ít nhất 5 lần) thì cấm chữ ký đó
	FPBanMin  int      `json:"fp_ban_min"`
	Allow     []string `json:"allow"` // IP/dải IP không bao giờ bị giới hạn hay cấm
}

func defaultGuardCfg() guardCfg {
	return guardCfg{Enabled: true, IPStrikes: 10, IPBanMin: 60, FPStrikes: 150, FPIPs: 5, FPBanMin: 30}
}

// Dải IP của Cloudflare (dự phòng khi chưa có file cloudflare.conf do deploy.sh ghi). Không bao giờ cấm các IP này:
// nếu nginx chưa khôi phục được IP khách thì mọi người đều "đến từ" Cloudflare và cấm sẽ chặn cả website.
var cfFallback = []string{"173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18", "190.93.240.0/20", "188.114.96.0/20",
	"197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13", "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
	"2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32"}

type gSeen struct {
	Total int       // số lần bị 429 từ lúc ghi nhận
	Last  time.Time // lần gần nhất
	First time.Time
	UA    string
	Path  string
	FP    string
	hits  []time.Time // trong cửa sổ 1 phút
}

type gFP struct {
	hits []time.Time
	ips  map[string][]time.Time
}

type guard struct {
	mu      sync.Mutex
	dir     string
	seen    map[string]*gSeen
	fps     map[string]*gFP
	cfg     guardCfg
	cfgAt   time.Time
	cf      []netip.Prefix
	written map[string]string
	synced  time.Time
	syncErr string
	pending bool
}

func newGuard(dir string) *guard {
	g := &guard{dir: dir, seen: map[string]*gSeen{}, fps: map[string]*gFP{}, written: map[string]string{}}
	g.loadCF()
	return g
}

var cfLineRe = regexp.MustCompile(`^\s*set_real_ip_from\s+([0-9a-fA-F:./]+)\s*;`)

func (g *guard) loadCF() {
	var out []netip.Prefix
	if g.dir != "" {
		if b, err := os.ReadFile(filepath.Join(g.dir, "cloudflare.conf")); err == nil {
			for _, ln := range strings.Split(string(b), "\n") {
				if m := cfLineRe.FindStringSubmatch(ln); m != nil {
					if p, err := netip.ParsePrefix(m[1]); err == nil {
						out = append(out, p)
					}
				}
			}
		}
	}
	for _, s := range cfFallback {
		if p, err := netip.ParsePrefix(s); err == nil {
			out = append(out, p)
		}
	}
	g.cf = out
}

func parseNet(s string) (netip.Prefix, error) {
	s = strings.TrimSpace(s)
	if strings.Contains(s, "/") {
		p, err := netip.ParsePrefix(s)
		return p.Masked(), err
	}
	a, err := netip.ParseAddr(s)
	if err != nil {
		return netip.Prefix{}, err
	}
	a = a.Unmap()
	return netip.PrefixFrom(a, a.BitLen()), nil
}

// protectedIP: IP không bao giờ được cấm (nội bộ, Cloudflare, danh sách luôn cho phép).
func (g *guard) protectedIP(a netip.Addr, allow []string) string {
	a = a.Unmap()
	switch {
	case a.IsLoopback(), a.IsPrivate(), a.IsLinkLocalUnicast(), a.IsUnspecified(), a.IsMulticast():
		return "IP nội bộ"
	}
	for _, p := range g.cf {
		if p.Contains(a) {
			return "IP của Cloudflare (nginx chưa khôi phục được IP khách thật)"
		}
	}
	for _, s := range allow {
		if p, err := parseNet(s); err == nil && p.Contains(a) {
			return "nằm trong danh sách luôn cho phép"
		}
	}
	return ""
}

// ---- nhận báo cáo từ nginx

var guardPage = `<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>429</title>
<body style="font:16px/1.6 system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:0 20px;color:#0B2A6F"><h1 style="font-size:22px">Bạn đang gửi quá nhiều yêu cầu</h1>
<p>Vui lòng chờ một lát rồi tải lại trang.</p><p style="color:#5B6279">Too many requests. Please wait a moment and try again.</p></body></html>`

func fpOf(h http.Header) string {
	return h.Get("User-Agent") + "|" + h.Get("Accept-Language") + "|" + h.Get("Accept-Encoding") + "|" + h.Get("Sec-Ch-Ua") + "|" + h.Get("Sec-Ch-Ua-Platform")
}

// fpBannable: nginx so khớp bằng biểu thức chính quy ASCII; chữ ký có ký tự lạ thì chỉ theo dõi, không cấm tự động.
func fpBannable(fp string) bool {
	if fp == "" || len(fp) > 700 || strings.HasPrefix(fp, "|") {
		return false
	}
	for i := 0; i < len(fp); i++ {
		if fp[i] < 0x20 || fp[i] > 0x7E {
			return false
		}
	}
	return true
}

func (a *App) guardState() *guard {
	a.gdOnce.Do(func() {
		if a.gd == nil {
			a.gd = newGuard(a.cfg.GuardDir)
		}
	})
	return a.gd
}

func (a *App) guardConfig(ctx context.Context) guardCfg {
	g := a.guardState()
	g.mu.Lock()
	if time.Since(g.cfgAt) < 30*time.Second && g.cfgAt != (time.Time{}) {
		c := g.cfg
		g.mu.Unlock()
		return c
	}
	g.mu.Unlock()
	c := defaultGuardCfg()
	if a.pool != nil {
		kvGet(ctx, a.pool, "guard_cfg", &c)
	}
	c = normalizeGuardCfg(c)
	g.mu.Lock()
	g.cfg, g.cfgAt = c, time.Now()
	g.mu.Unlock()
	return c
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func normalizeGuardCfg(c guardCfg) guardCfg {
	d := defaultGuardCfg()
	if c.IPStrikes == 0 {
		c.IPStrikes = d.IPStrikes
	}
	if c.IPBanMin == 0 {
		c.IPBanMin = d.IPBanMin
	}
	if c.FPStrikes == 0 {
		c.FPStrikes = d.FPStrikes
	}
	if c.FPIPs == 0 {
		c.FPIPs = d.FPIPs
	}
	if c.FPBanMin == 0 {
		c.FPBanMin = d.FPBanMin
	}
	c.IPStrikes = clampInt(c.IPStrikes, 3, 1000)
	c.IPBanMin = clampInt(c.IPBanMin, 1, 7*24*60)
	c.FPStrikes = clampInt(c.FPStrikes, 20, 100000)
	c.FPIPs = clampInt(c.FPIPs, 2, 1000)
	c.FPBanMin = clampInt(c.FPBanMin, 1, 7*24*60)
	return c
}

// guardStrike: nginx chuyển tới đây mỗi request bị trả 429. Chỉ nhận từ máy chủ (127.0.0.1).
func (a *App) guardStrike(w http.ResponseWriter, r *http.Request) {
	host, _, _ := net.SplitHostPort(r.RemoteAddr)
	if lip := net.ParseIP(host); lip == nil || !lip.IsLoopback() {
		a.fail(w, r, 404, "Không tìm thấy")
		return
	}
	hd := map[string]string{"Retry-After": "30", "Cache-Control": "no-store"}
	ctx := r.Context()
	cfg := a.guardConfig(ctx)
	if cfg.Enabled {
		ipStr := r.Header.Get("X-Real-IP")
		if ap, err := netip.ParseAddr(ipStr); err == nil {
			a.guardRecord(ctx, ap.Unmap(), fpOf(r.Header), r.Header.Get("User-Agent"), r.Header.Get("X-Orig-URI"), cfg)
		}
	}
	a.send(w, r, 429, []byte(guardPage), "text/html; charset=utf-8", hd)
}

func (a *App) guardRecord(ctx context.Context, ip netip.Addr, fp, ua, path string, cfg guardCfg) {
	g := a.guardState()
	now := time.Now()
	if g.protectedIP(ip, cfg.Allow) != "" {
		return
	}
	var banIP, banFP bool
	g.mu.Lock()
	k := ip.String()
	s := g.seen[k]
	if s == nil {
		if len(g.seen) > 4000 {
			g.trimLocked(now)
		}
		s = &gSeen{First: now}
		g.seen[k] = s
	}
	s.Total++
	s.Last, s.UA, s.FP = now, truncate(ua, 300), fp
	s.Path = truncate(path, 200)
	s.hits = pruneTimes(append(s.hits, now), now, time.Minute)
	if len(s.hits) >= cfg.IPStrikes {
		banIP = true
		s.hits = nil
	}
	if fpBannable(fp) {
		f := g.fps[fp]
		if f == nil {
			f = &gFP{ips: map[string][]time.Time{}}
			g.fps[fp] = f
		}
		f.hits = pruneTimes(append(f.hits, now), now, time.Minute)
		f.ips[k] = pruneTimes(append(f.ips[k], now), now, time.Minute)
		if len(f.hits) >= cfg.FPStrikes {
			heavy := 0
			for _, h := range f.ips {
				if len(h) >= 5 {
					heavy++
				}
			}
			if heavy >= cfg.FPIPs {
				banFP = true
				delete(g.fps, fp)
			}
		}
	}
	g.mu.Unlock()
	if banIP {
		a.guardBan(ctx, "ip", k, "", fmt.Sprintf("Bị giới hạn tốc độ %d lần trong 1 phút", cfg.IPStrikes), "auto", time.Duration(cfg.IPBanMin)*time.Minute, true)
	}
	if banFP {
		a.guardBan(ctx, "fp", fp, ua, fmt.Sprintf("Nhiều IP cùng dùng một trình duyệt tấn công (≥ %d request/phút)", cfg.FPStrikes), "auto", time.Duration(cfg.FPBanMin)*time.Minute, true)
	}
}

func pruneTimes(q []time.Time, now time.Time, win time.Duration) []time.Time {
	cut := now.Add(-win)
	i := 0
	for i < len(q) && q[i].Before(cut) {
		i++
	}
	return q[i:]
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func (g *guard) trimLocked(now time.Time) {
	for k, s := range g.seen {
		if now.Sub(s.Last) > time.Hour {
			delete(g.seen, k)
		}
	}
	for k, f := range g.fps {
		if len(pruneTimes(f.hits, now, time.Minute)) == 0 {
			delete(g.fps, k)
		}
	}
}

// ---- cấm / bỏ cấm

type guardBan struct {
	ID      int64  `json:"id"`
	Kind    string `json:"kind"`
	Value   string `json:"value"`
	Label   string `json:"label"`
	Reason  string `json:"reason"`
	Source  string `json:"source"`
	Created int64  `json:"created"`
	Expires int64  `json:"expires"`
	Times   int    `json:"times"`
}

// guardBan ghi một lệnh cấm. auto = true thì tái phạm sẽ bị cấm lâu hơn (gấp 4 mỗi lần, tối đa 7 ngày).
func (a *App) guardBan(ctx context.Context, kind, value, label, reason, source string, dur time.Duration, escalate bool) error {
	g := a.guardState()
	cfg := a.guardConfig(ctx)
	if kind == "ip" {
		p, err := parseNet(value)
		if err != nil {
			return bad("IP hoặc dải IP không hợp lệ")
		}
		if why := g.protectedPrefix(p, cfg.Allow); why != "" {
			return bad("Không cấm được vì %s", why)
		}
		value = p.String()
		if p.IsSingleIP() {
			value = p.Addr().String()
		}
	} else if kind == "fp" {
		if !fpBannable(value) {
			return bad("Chữ ký trình duyệt này có ký tự đặc biệt nên chưa cấm tự động được. Hãy cấm theo IP")
		}
	} else {
		return bad("Loại cấm không hợp lệ")
	}
	now := time.Now()
	times := 1
	var prevTimes int
	var prevExp, prevCreated int64
	err := a.pool.QueryRow(ctx, `SELECT times, expires, created FROM guard_bans WHERE kind=$1 AND value=$2`, kind, value).Scan(&prevTimes, &prevExp, &prevCreated)
	if err == nil {
		times = prevTimes + 1
		if escalate && now.Unix()-prevCreated < 7*24*3600 {
			for i := 0; i < prevTimes && i < 3; i++ {
				dur *= 4
			}
			if dur > 7*24*time.Hour {
				dur = 7 * 24 * time.Hour
			}
		}
	}
	var exp int64
	if dur > 0 {
		exp = now.Add(dur).Unix()
	}
	if prevExp == 0 && err == nil && exp != 0 && source == "auto" { // đang cấm vĩnh viễn thì không hạ xuống tạm thời
		exp = 0
	}
	if _, err := a.pool.Exec(ctx, `INSERT INTO guard_bans(kind,value,label,reason,source,created,expires,times) VALUES($1,$2,$3,$4,$5,$6,$7,$8)
		ON CONFLICT (kind,value) DO UPDATE SET label=EXCLUDED.label, reason=EXCLUDED.reason, source=EXCLUDED.source, created=EXCLUDED.created, expires=EXCLUDED.expires, times=EXCLUDED.times`,
		kind, value, truncate(label, 300), truncate(reason, 300), source, now.Unix(), exp, times); err != nil {
		return err
	}
	a.guardSyncSoon()
	return nil
}

func (g *guard) protectedPrefix(p netip.Prefix, allow []string) string {
	if p.IsSingleIP() {
		return g.protectedIP(p.Addr(), allow)
	}
	min := 16
	if p.Addr().Is6() {
		min = 48
	}
	if p.Bits() < min {
		return fmt.Sprintf("dải IP quá rộng (tối thiểu /%d)", min)
	}
	a := p.Addr()
	if a.IsLoopback() || a.IsPrivate() {
		return "IP nội bộ"
	}
	for _, c := range g.cf {
		if c.Overlaps(p) {
			return "dải này trùng với IP của Cloudflare"
		}
	}
	for _, s := range allow {
		if q, err := parseNet(s); err == nil && q.Overlaps(p) {
			return "dải này trùng với danh sách luôn cho phép"
		}
	}
	return ""
}

func (a *App) guardUnban(ctx context.Context, id int64) error {
	if _, err := a.pool.Exec(ctx, `DELETE FROM guard_bans WHERE id=$1`, id); err != nil {
		return err
	}
	a.guardSyncSoon()
	return nil
}

func (a *App) guardActiveBans(ctx context.Context, all bool) ([]guardBan, error) {
	q := `SELECT id,kind,value,label,reason,source,created,expires,times FROM guard_bans WHERE expires=0 OR expires>$1 ORDER BY created DESC LIMIT 2000`
	if all {
		q = `SELECT id,kind,value,label,reason,source,created,expires,times FROM guard_bans WHERE $1>=0 ORDER BY created DESC LIMIT 2000`
	}
	rows, err := a.pool.Query(ctx, q, time.Now().Unix())
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []guardBan{}
	for rows.Next() {
		var b guardBan
		if err := rows.Scan(&b.ID, &b.Kind, &b.Value, &b.Label, &b.Reason, &b.Source, &b.Created, &b.Expires, &b.Times); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// ---- ghi file cho nginx

func nginxQuote(s string) string {
	return `"` + strings.NewReplacer(`\`, `\\`, `"`, `\"`).Replace(s) + `"`
}

// guardFiles dựng nội dung các file nginx đọc: allow-ip.conf, ban-ip.conf (geo) và ban-fp.conf (map, biểu thức chính quy).
func guardFiles(bans []guardBan, allow []string) map[string]string {
	var allowB, ipB strings.Builder
	allowB.WriteString("# do 3RDHub CMS ghi, đừng sửa tay\n127.0.0.1 1;\n::1 1;\n")
	for _, s := range allow {
		if p, err := parseNet(s); err == nil {
			allowB.WriteString(p.String() + " 1;\n")
		}
	}
	ipB.WriteString("# do 3RDHub CMS ghi, đừng sửa tay\n")
	var fps []string
	for _, b := range bans {
		switch b.Kind {
		case "ip":
			if p, err := parseNet(b.Value); err == nil {
				ipB.WriteString(p.String() + " 1;\n")
			}
		case "fp":
			if fpBannable(b.Value) && len(fps) < 200 {
				fps = append(fps, regexp.QuoteMeta(b.Value))
			}
		}
	}
	sort.Strings(fps)
	fpB := "# do 3RDHub CMS ghi, đừng sửa tay\n"
	if len(fps) > 0 {
		fpB += nginxQuote("~^(?:"+strings.Join(fps, "|")+")$") + " 1;\n"
	}
	return map[string]string{"allow-ip.conf": allowB.String(), "ban-ip.conf": ipB.String(), "ban-fp.conf": fpB}
}

func (a *App) guardSyncSoon() {
	g := a.guardState()
	g.mu.Lock()
	if g.pending {
		g.mu.Unlock()
		return
	}
	g.pending = true
	g.mu.Unlock()
	go func() {
		time.Sleep(2 * time.Second) // gom nhiều lệnh cấm vào một lần nạp lại nginx
		g.mu.Lock()
		g.pending = false
		g.mu.Unlock()
		a.guardSync(context.Background())
	}()
}

// guardSync ghi lại các file nếu nội dung đổi, rồi chạm file "reload" để dịch vụ nền của hệ thống nạp lại nginx.
func (a *App) guardSync(ctx context.Context) {
	g := a.guardState()
	if g.dir == "" || a.pool == nil {
		return
	}
	bans, err := a.guardActiveBans(ctx, false)
	cfg := a.guardConfig(ctx)
	if err == nil {
		files := guardFiles(bans, cfg.Allow)
		changed := false
		g.mu.Lock()
		for name, content := range files {
			if g.written[name] == content {
				continue
			}
			p := filepath.Join(g.dir, name)
			if cur, e := os.ReadFile(p); e == nil && string(cur) == content {
				g.written[name] = content
				continue
			}
			tmp := p + ".tmp"
			if e := os.WriteFile(tmp, []byte(content), 0o644); e != nil {
				err = e
				break
			}
			if e := os.Rename(tmp, p); e != nil {
				err = e
				break
			}
			g.written[name] = content
			changed = true
		}
		if err == nil && changed {
			err = os.WriteFile(filepath.Join(g.dir, "reload"), []byte(time.Now().UTC().Format(time.RFC3339Nano)+"\n"), 0o644)
		}
		if err == nil {
			g.synced = time.Now()
		}
		g.mu.Unlock()
	}
	g.mu.Lock()
	if err != nil {
		g.syncErr = err.Error()
	} else {
		g.syncErr = ""
	}
	g.mu.Unlock()
}

func (a *App) startGuard(ctx context.Context) {
	g := a.guardState()
	if g.dir != "" {
		a.guardSync(ctx)
	}
	go func() {
		for range time.Tick(30 * time.Second) {
			now := time.Now()
			g.mu.Lock()
			g.trimLocked(now)
			g.mu.Unlock()
			g.loadCF()
			a.guardSync(context.Background()) // lệnh cấm hết hạn thì tự rút khỏi file
		}
	}()
}

// ---- API quản trị

type guardSeenOut struct {
	IP     string `json:"ip"`
	Count  int    `json:"count"`
	Last   int64  `json:"last"`
	UA     string `json:"ua"`
	Path   string `json:"path"`
	FP     string `json:"fp"`
	CanFP  bool   `json:"can_fp"`
	Banned bool   `json:"banned"`
}

func (a *App) guardStatus(ctx context.Context, r *http.Request) (map[string]any, error) {
	g := a.guardState()
	cfg := a.guardConfig(ctx)
	bans, err := a.guardActiveBans(ctx, false)
	if err != nil {
		return nil, err
	}
	banned := map[string]bool{}
	for _, b := range bans {
		banned[b.Kind+"|"+b.Value] = true
	}
	g.mu.Lock()
	recent := []guardSeenOut{}
	for ip, s := range g.seen {
		recent = append(recent, guardSeenOut{IP: ip, Count: s.Total, Last: s.Last.Unix(), UA: s.UA, Path: s.Path, FP: s.FP, CanFP: fpBannable(s.FP), Banned: banned["ip|"+ip] || banned["fp|"+s.FP]})
	}
	synced, syncErr := g.synced, g.syncErr
	dirOK := g.dir != ""
	g.mu.Unlock()
	sort.Slice(recent, func(i, j int) bool { return recent[i].Last > recent[j].Last })
	if len(recent) > 100 {
		recent = recent[:100]
	}
	own := clientIP(r)
	behindCF := r.Header.Get("CF-Ray") != "" || r.Header.Get("CF-Visitor") != ""
	var syncedAt int64
	if !synced.IsZero() {
		syncedAt = synced.Unix()
	}
	return map[string]any{"ok": true, "config": cfg, "bans": bans, "recent": recent, "own_ip": own, "behind_cf": behindCF,
		"enforce": dirOK, "synced": syncedAt, "sync_error": syncErr, "now": time.Now().Unix()}, nil
}

func cleanAllow(list any) ([]string, error) {
	arr, _ := list.([]any)
	if len(arr) > 100 {
		return nil, bad("Danh sách luôn cho phép tối đa 100 dòng")
	}
	out := []string{}
	for _, v := range arr {
		s, _ := v.(string)
		s = strings.TrimSpace(s)
		if s == "" {
			continue
		}
		p, err := parseNet(s)
		if err != nil {
			return nil, bad("'%s' không phải IP hay dải IP hợp lệ", truncate(s, 60))
		}
		out = append(out, p.String())
	}
	return out, nil
}

func (a *App) guardAdmin(ctx context.Context, w http.ResponseWriter, r *http.Request, sub string) (any, bool, error) {
	m := r.Method
	switch {
	case sub == "guard" && m == http.MethodGet:
		v, err := a.guardStatus(ctx, r)
		return v, true, err
	case sub == "guard/config" && m == http.MethodPut:
		d, err := readJSON(r, 16384)
		if err != nil {
			return nil, true, err
		}
		num := func(k string) int {
			f, _ := d[k].(float64)
			return int(f)
		}
		c := guardCfg{Enabled: d["enabled"] != false, IPStrikes: num("ip_strikes"), IPBanMin: num("ip_ban_min"), FPStrikes: num("fp_strikes"), FPIPs: num("fp_ips"), FPBanMin: num("fp_ban_min")}
		if c.Allow, err = cleanAllow(d["allow"]); err != nil {
			return nil, true, err
		}
		c = normalizeGuardCfg(c)
		if err := kvSetPool(ctx, a.pool, "guard_cfg", c); err != nil {
			return nil, true, err
		}
		g := a.guardState()
		g.mu.Lock()
		g.cfg, g.cfgAt = c, time.Now()
		g.mu.Unlock()
		a.guardSyncSoon()
		v, err := a.guardStatus(ctx, r)
		return v, true, err
	case sub == "guard/ban" && m == http.MethodPost:
		d, err := readJSON(r, 8192)
		if err != nil {
			return nil, true, err
		}
		kind, _ := d["kind"].(string)
		value, _ := d["value"].(string)
		reason, _ := strip(d["reason"], 200, "Lý do")
		label, _ := strip(d["label"], 200, "Tên")
		hours, _ := d["hours"].(float64)
		if kind == "ip" {
			if value = strings.TrimSpace(value); value == "" {
				return nil, true, bad("Nhập IP hoặc dải IP cần cấm")
			}
			if p, e := parseNet(value); e == nil && p.Contains(mustAddr(clientIP(r))) {
				return nil, true, bad("Không thể cấm IP của chính bạn (%s)", clientIP(r))
			}
		}
		if reason == "" {
			reason = "Cấm thủ công"
		}
		var dur time.Duration
		if hours > 0 {
			dur = time.Duration(hours * float64(time.Hour))
		}
		if err := a.guardBan(ctx, kind, value, label, reason, "admin", dur, false); err != nil {
			return nil, true, err
		}
		v, err := a.guardStatus(ctx, r)
		return v, true, err
	case sub == "guard/unban" && m == http.MethodPost:
		d, err := readJSON(r, 1024)
		if err != nil {
			return nil, true, err
		}
		id, _ := d["id"].(float64)
		if err := a.guardUnban(ctx, int64(id)); err != nil {
			return nil, true, err
		}
		v, err := a.guardStatus(ctx, r)
		return v, true, err
	}
	return nil, false, nil
}

func mustAddr(s string) netip.Addr {
	a, _ := netip.ParseAddr(s)
	return a.Unmap()
}
