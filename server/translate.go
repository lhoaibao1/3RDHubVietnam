package main

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
)

// Tự dịch Việt -> Anh khi lưu nội dung trong CMS. Mặc định dùng điểm cuối dịch miễn phí của Google (không cần khoá, không chính thức);
// có TRANSLATE_KEY thì dùng Google Cloud Translation API chính thức; TRANSLATE=off để tắt.

type translator struct {
	client *http.Client
	url    string
	key    string
	off    bool
}

func newTranslator() *translator {
	t := &translator{client: &http.Client{Timeout: 12 * time.Second}, key: os.Getenv("TRANSLATE_KEY"), off: strings.EqualFold(os.Getenv("TRANSLATE"), "off")}
	t.url = env("TRANSLATE_URL", "")
	if t.url == "" {
		if t.key != "" {
			t.url = "https://translation.googleapis.com/language/translate/v2"
		} else {
			t.url = "https://translate.googleapis.com/translate_a/single"
		}
	}
	return t
}

func vhash(s string) string {
	sum := sha1.Sum([]byte(strings.TrimSpace(s)))
	return hex.EncodeToString(sum[:])[:10]
}

var protectRe = regexp.MustCompile(`\{\{[a-z_]+\}\}|\]\([^)\s]+\)|https?://[^\s)]+`)

// chunks cắt chữ dài theo đoạn để mỗi lần gọi không quá dài.
func chunks(s string, max int) []string {
	if len([]rune(s)) <= max {
		return []string{s}
	}
	var out []string
	cur := ""
	for _, p := range strings.Split(s, "\n\n") {
		if cur != "" && len([]rune(cur))+len([]rune(p)) > max {
			out = append(out, cur)
			cur = ""
		}
		if cur != "" {
			cur += "\n\n"
		}
		cur += p
	}
	if cur != "" {
		out = append(out, cur)
	}
	return out
}

func (t *translator) call(ctx context.Context, q string) (string, error) {
	var req *http.Request
	var err error
	if t.key != "" {
		f := url.Values{"q": {q}, "source": {"vi"}, "target": {"en"}, "format": {"text"}, "key": {t.key}}
		req, err = http.NewRequestWithContext(ctx, "POST", t.url, strings.NewReader(f.Encode()))
	} else {
		f := url.Values{"client": {"gtx"}, "sl": {"vi"}, "tl": {"en"}, "dt": {"t"}, "q": {q}}
		req, err = http.NewRequestWithContext(ctx, "POST", t.url, strings.NewReader(f.Encode()))
	}
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; 3rdhub-cms)")
	resp, err := t.client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if resp.StatusCode != 200 {
		return "", fmt.Errorf("dịch: máy chủ trả %d", resp.StatusCode)
	}
	if t.key != "" {
		var r struct {
			Data struct {
				Translations []struct {
					T string `json:"translatedText"`
				} `json:"translations"`
			} `json:"data"`
		}
		if err := json.Unmarshal(body, &r); err != nil || len(r.Data.Translations) == 0 {
			return "", fmt.Errorf("dịch: phản hồi không hiểu được")
		}
		return r.Data.Translations[0].T, nil
	}
	var r []any
	if err := json.Unmarshal(body, &r); err != nil || len(r) == 0 {
		return "", fmt.Errorf("dịch: phản hồi không hiểu được")
	}
	segs, _ := r[0].([]any)
	var sb strings.Builder
	for _, sgi := range segs {
		if sg, ok := sgi.([]any); ok && len(sg) > 0 {
			if s, ok := sg[0].(string); ok {
				sb.WriteString(s)
			}
		}
	}
	if sb.Len() == 0 {
		return "", fmt.Errorf("dịch: không có kết quả")
	}
	return sb.String(), nil
}

// one dịch một đoạn (đã có cache thì lấy cache); giữ nguyên {{mã}}, đường dẫn và liên kết markdown.
func (a *App) translateOne(ctx context.Context, vi string) (string, error) {
	vi = strings.TrimSpace(vi)
	h := vhash(vi)
	var cached string
	if err := a.pool.QueryRow(ctx, `SELECT en FROM tr_cache WHERE h=$1`, h).Scan(&cached); err == nil && cached != "" {
		return cached, nil
	}
	var kept []string
	prot := protectRe.ReplaceAllStringFunc(vi, func(m string) string {
		kept = append(kept, m)
		return fmt.Sprintf("ZQ%dZ", len(kept)-1)
	})
	var out []string
	for _, ch := range chunks(prot, 2500) {
		r, err := a.tr.call(ctx, ch)
		if err != nil {
			return "", err
		}
		out = append(out, r)
	}
	en := strings.Join(out, "\n\n")
	for i, m := range kept {
		re := regexp.MustCompile(fmt.Sprintf(`(?i)ZQ\s?%d\s?Z`, i))
		en = re.ReplaceAllLiteralString(en, m)
	}
	en = strings.TrimSpace(en)
	if en != "" {
		a.pool.Exec(ctx, `INSERT INTO tr_cache(h,en,ts) VALUES($1,$2,$3) ON CONFLICT (h) DO UPDATE SET en=EXCLUDED.en, ts=EXCLUDED.ts`, h, en, time.Now().Unix())
	}
	return en, nil
}

type tjob struct {
	vi     string
	en, x  *string
	prevEN *string // bản EN đã lưu trước đó (nil nếu mục mới)
}

// need cho biết có cần tự dịch: EN trống, hoặc EN đang là bản máy dịch mà tiếng Việt đã đổi. Người dùng tự sửa EN thì giữ nguyên.
func (j *tjob) need() bool {
	if strings.TrimSpace(j.vi) == "" {
		return false
	}
	if j.prevEN != nil && *j.en != *j.prevEN && *j.en != "" {
		*j.x = ""
		return false
	}
	if strings.TrimSpace(*j.en) == "" {
		return true
	}
	return *j.x != "" && *j.x != vhash(j.vi)
}

func pairJob(p *Pair, prev *Pair) *tjob {
	j := &tjob{vi: p.VI, en: &p.EN, x: &p.X}
	if prev != nil {
		j.prevEN = &prev.EN
	}
	return j
}

// autoTranslate điền bản English cho mọi đoạn tiếng Việt còn thiếu hoặc đã đổi. Trả về số đoạn dịch được và số đoạn lỗi.
func (a *App) autoTranslate(ctx context.Context, c *Content, prev Content) (done, failed int) {
	if a.tr == nil || a.tr.off {
		return
	}
	var jobs []*tjob
	var back []func() // ghi lại các giá trị map (không lấy địa chỉ trực tiếp được)
	pairPtr := func(has bool, pp *Pair) *Pair {
		if has {
			return pp
		}
		return nil
	}

	for k, v := range c.Ov {
		k, it := k, v
		j := &tjob{vi: it.VI, en: &it.EN, x: &it.X}
		if p, ok := prev.Ov[k]; ok {
			pe := p.EN
			j.prevEN = &pe
		}
		jobs = append(jobs, j)
		back = append(back, func() { c.Ov[k] = it })
	}
	fq := map[string]Faq{}
	for _, f := range prev.Faq {
		fq[f.ID] = f
	}
	for i := range c.Faq {
		f := &c.Faq[i]
		pf, has := fq[f.ID]
		jobs = append(jobs, pairJob(&f.Cat, pairPtr(has, &pf.Cat)), pairJob(&f.Q, pairPtr(has, &pf.Q)), pairJob(&f.A, pairPtr(has, &pf.A)))
	}
	pt := map[string]Partner{}
	for _, p := range prev.Partners {
		pt[p.ID] = p
	}
	for i := range c.Partners {
		p := &c.Partners[i]
		o, has := pt[p.ID]
		jobs = append(jobs, pairJob(&p.Group, pairPtr(has, &o.Group)))
	}
	for key, d := range c.Legal {
		key, d := key, d
		pd, has := prev.Legal[key]
		jobs = append(jobs, pairJob(&d.Title, pairPtr(has, &pd.Title)), pairJob(&d.Updated, pairPtr(has, &pd.Updated)), pairJob(&d.Body, pairPtr(has, &pd.Body)))
		back = append(back, func() { c.Legal[key] = d })
	}
	cp := map[string]Client{}
	for _, x := range prev.Clients {
		cp[x.ID] = x
	}
	for i := range c.Clients {
		x := &c.Clients[i]
		o, has := cp[x.ID]
		jobs = append(jobs, pairJob(&x.Desc, pairPtr(has, &o.Desc)))
	}
	for ri := range c.Quote.Rows {
		r := &c.Quote.Rows[ri]
		var pr *QuoteRow
		if ri < len(prev.Quote.Rows) && prev.Quote.Rows[ri].Label.VI == r.Label.VI {
			pr = &prev.Quote.Rows[ri]
		}
		var pl *Pair
		if pr != nil {
			pl = &pr.Label
		}
		jobs = append(jobs, pairJob(&r.Label, pl))
		for ci := range r.Cells {
			var pc *Pair
			if pr != nil && ci < len(pr.Cells) {
				pc = &pr.Cells[ci]
			}
			jobs = append(jobs, pairJob(&r.Cells[ci], pc))
		}
	}
	pm := map[string]Module{}
	for _, m := range prev.Product.Modules {
		pm[m.ID] = m
	}
	for mi := range c.Product.Modules {
		m := &c.Product.Modules[mi]
		o, has := pm[m.ID]
		jobs = append(jobs, pairJob(&m.Code, pairPtr(has, &o.Code)), pairJob(&m.Title, pairPtr(has, &o.Title)))
		for ii := range m.Items {
			var pi *Pair
			if has && ii < len(o.Items) {
				pi = &o.Items[ii]
			}
			jobs = append(jobs, pairJob(&m.Items[ii], pi))
		}
	}
	qp := map[string]QuotePlan{}
	for _, p := range prev.Quote.Plans {
		qp[p.ID] = p
	}
	for i := range c.Quote.Plans {
		p := &c.Quote.Plans[i]
		o, has := qp[p.ID]
		jobs = append(jobs, pairJob(&p.Name, pairPtr(has, &o.Name)), pairJob(&p.Price, pairPtr(has, &o.Price)), pairJob(&p.Unit, pairPtr(has, &o.Unit)), pairJob(&p.Desc, pairPtr(has, &o.Desc)))
		for fi := range p.Features {
			var pf *Pair
			if has && fi < len(o.Features) {
				pf = &o.Features[fi]
			}
			jobs = append(jobs, pairJob(&p.Features[fi], pf))
		}
	}

	var todo []*tjob
	for _, j := range jobs {
		if j.need() {
			todo = append(todo, j)
		}
	}
	ctx, cancel := context.WithTimeout(ctx, 40*time.Second)
	defer cancel()
	var mu sync.Mutex
	var wg sync.WaitGroup
	sem := make(chan struct{}, 4)
	for _, j := range todo {
		wg.Add(1)
		sem <- struct{}{}
		go func(j *tjob) {
			defer wg.Done()
			defer func() { <-sem }()
			en, err := a.translateOne(ctx, j.vi)
			mu.Lock()
			defer mu.Unlock()
			if err != nil || en == "" {
				failed++
				if err != nil {
					log.Printf("tự dịch lỗi: %v", err)
				}
				return
			}
			*j.en = en
			*j.x = vhash(j.vi)
			done++
		}(j)
	}
	wg.Wait()
	for _, f := range back {
		f()
	}
	return
}
