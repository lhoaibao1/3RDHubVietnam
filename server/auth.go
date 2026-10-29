package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"
)

// pbkdf2SHA256 tự cài để không phụ thuộc phiên bản Go (tương thích hashlib.pbkdf2_hmac của bản cũ).
func pbkdf2SHA256(password, salt []byte, iter, keyLen int) []byte {
	prf := hmac.New(sha256.New, password)
	hLen := prf.Size()
	n := (keyLen + hLen - 1) / hLen
	var out []byte
	buf := make([]byte, 4)
	for block := 1; block <= n; block++ {
		prf.Reset()
		prf.Write(salt)
		binary.BigEndian.PutUint32(buf, uint32(block))
		prf.Write(buf)
		u := prf.Sum(nil)
		t := append([]byte(nil), u...)
		for i := 1; i < iter; i++ {
			prf.Reset()
			prf.Write(u)
			u = prf.Sum(u[:0])
			for j := range t {
				t[j] ^= u[j]
			}
		}
		out = append(out, t...)
	}
	return out[:keyLen]
}

func randHex(n int) string {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

const pwRounds = 200000

func hashPW(pw string) string {
	salt := randHex(16)
	sb, _ := hex.DecodeString(salt)
	return fmt.Sprintf("pbkdf2$%d$%s$%s", pwRounds, salt, hex.EncodeToString(pbkdf2SHA256([]byte(pw), sb, pwRounds, 32)))
}

func checkPW(pw, stored string) bool {
	p := strings.Split(stored, "$")
	if len(p) != 4 || p[0] != "pbkdf2" {
		return false
	}
	rounds, err := strconv.Atoi(p[1])
	if err != nil || rounds < 1 || rounds > 5000000 {
		return false
	}
	salt, err := hex.DecodeString(p[2])
	if err != nil {
		return false
	}
	calc := hex.EncodeToString(pbkdf2SHA256([]byte(pw), salt, rounds, 32))
	return subtle.ConstantTimeCompare([]byte(calc), []byte(p[3])) == 1
}

func tail12(s string) string {
	if len(s) > 12 {
		return s[len(s)-12:]
	}
	return s
}

type tokenData struct {
	E int64  `json:"e"`
	H string `json:"h"`
	N string `json:"n"`
}

func makeToken(secret, adminHash string, ttl int64) string {
	b, _ := json.Marshal(tokenData{E: time.Now().Unix() + ttl, H: tail12(adminHash), N: randHex(4)})
	payload := strings.TrimRight(base64.URLEncoding.EncodeToString(b), "=")
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(payload))
	return payload + "." + hex.EncodeToString(m.Sum(nil))
}

func verifyToken(secret, adminHash, token string) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 2 || secret == "" {
		return false
	}
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(parts[0]))
	if !hmac.Equal([]byte(hex.EncodeToString(m.Sum(nil))), []byte(parts[1])) {
		return false
	}
	raw, err := base64.RawURLEncoding.DecodeString(strings.TrimRight(parts[0], "="))
	if err != nil {
		return false
	}
	var d tokenData
	if json.Unmarshal(raw, &d) != nil {
		return false
	}
	return d.E > time.Now().Unix() && d.H == tail12(adminHash)
}

// limiter giới hạn tần suất theo (loại, ip) trong cửa sổ trượt.
type limiter struct {
	mu   sync.Mutex
	hits map[string][]time.Time
}

func newLimiter() *limiter { return &limiter{hits: map[string][]time.Time{}} }

func (l *limiter) prune(key string, window time.Duration) []time.Time {
	cut := time.Now().Add(-window)
	q := l.hits[key]
	i := 0
	for i < len(q) && q[i].Before(cut) {
		i++
	}
	q = q[i:]
	if len(q) == 0 {
		delete(l.hits, key)
	} else {
		l.hits[key] = q
	}
	return q
}

// ok ghi nhận một lần và trả về false nếu vượt giới hạn.
func (l *limiter) ok(kind, ip string, limit int, window time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	key := kind + "|" + ip
	if len(l.prune(key, window)) >= limit {
		return false
	}
	l.hits[key] = append(l.hits[key], time.Now())
	return true
}

func (l *limiter) peek(kind, ip string, limit int, window time.Duration) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.prune(kind+"|"+ip, window)) < limit
}

func (l *limiter) hit(kind, ip string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.hits[kind+"|"+ip] = append(l.hits[kind+"|"+ip], time.Now())
}

// gc dọn các khoá cũ để bộ nhớ không phình ra.
func (l *limiter) gc() {
	l.mu.Lock()
	defer l.mu.Unlock()
	for k := range l.hits {
		l.prune(k, 10*time.Minute)
	}
}
