package main

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"mime"
	"net"
	"net/smtp"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// Cấu hình gửi email (SMTP). Lưu trong cơ sở dữ liệu, KHÔNG nằm trong nội dung công khai (/api/content).
// Mật khẩu được mã hoá AES-256-GCM bằng khoá ngẫu nhiên lưu ở <CMS_DATA>/secret.key (chỉ có trên máy chủ, quyền 0600).

type smtpCfg struct {
	Host        string `json:"host"`
	Port        int    `json:"port"`
	Security    string `json:"security"` // ssl (cổng 465) | starttls (587) | none
	User        string `json:"user"`
	FromEmail   string `json:"from_email"`
	FromName    string `json:"from_name"`
	NotifyTo    string `json:"notify_to"`
	NotifyLeads bool   `json:"notify_leads"`
	// ConfirmCustomer: gửi thư xác nhận đẹp cho khách khi họ để lại email trong form
	ConfirmCustomer bool   `json:"confirm_customer"`
	PassEnc         string `json:"pass_enc,omitempty"`
	replyTo         string // chỉ dùng khi gửi một thư, không lưu
}

var hostRe = regexp.MustCompile(`^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$`)

func defaultSMTP() smtpCfg {
	return smtpCfg{Host: "mail.3rdhubvietnam.tech", Port: 465, Security: "ssl", User: "hello@3rdhubvietnam.tech", FromEmail: "hello@3rdhubvietnam.tech", FromName: "3RDHub Vietnam", NotifyTo: "hello@3rdhubvietnam.tech"}
}

func (a *App) secretKey() ([]byte, error) {
	path := filepath.Join(a.cfg.DataDir, "secret.key")
	if b, err := os.ReadFile(path); err == nil {
		if k, err := hex.DecodeString(strings.TrimSpace(string(b))); err == nil && len(k) == 32 {
			return k, nil
		}
	}
	k := make([]byte, 32)
	if _, err := rand.Read(k); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(a.cfg.DataDir, 0o750); err != nil {
		return nil, err
	}
	if err := os.WriteFile(path, []byte(hex.EncodeToString(k)), 0o600); err != nil {
		return nil, err
	}
	return k, nil
}

func (a *App) seal(plain string) (string, error) {
	k, err := a.secretKey()
	if err != nil {
		return "", err
	}
	blk, _ := aes.NewCipher(k)
	g, _ := cipher.NewGCM(blk)
	n := make([]byte, g.NonceSize())
	if _, err := rand.Read(n); err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(g.Seal(n, n, []byte(plain), nil)), nil
}

func (a *App) unseal(enc string) (string, error) {
	if enc == "" {
		return "", nil
	}
	k, err := a.secretKey()
	if err != nil {
		return "", err
	}
	raw, err := base64.StdEncoding.DecodeString(enc)
	if err != nil {
		return "", err
	}
	blk, _ := aes.NewCipher(k)
	g, _ := cipher.NewGCM(blk)
	if len(raw) < g.NonceSize() {
		return "", errors.New("dữ liệu mật khẩu hỏng")
	}
	p, err := g.Open(nil, raw[:g.NonceSize()], raw[g.NonceSize():], nil)
	return string(p), err
}

func (a *App) loadSMTP(ctx context.Context) smtpCfg {
	c := defaultSMTP()
	var saved smtpCfg
	if ok, _ := kvGet(ctx, a.pool, "smtp", &saved); ok {
		c = saved
	}
	return c
}

func noCRLF(s string) bool { return !strings.ContainsAny(s, "\r\n\x00") }

// cleanSMTP kiểm tra dữ liệu gửi từ CMS (không đụng tới mật khẩu).
func cleanSMTP(d map[string]any, base smtpCfg) (smtpCfg, error) {
	c := base
	var err error
	if c.Host, err = strip(d["host"], 253, "Máy chủ SMTP"); err != nil {
		return c, err
	}
	if !hostRe.MatchString(c.Host) {
		return c, bad("Máy chủ SMTP không hợp lệ (ví dụ mail.3rdhubvietnam.tech)")
	}
	switch p := d["port"].(type) {
	case float64:
		c.Port = int(p)
	case string:
		c.Port, _ = strconv.Atoi(strings.TrimSpace(p))
	}
	if c.Port < 1 || c.Port > 65535 {
		return c, bad("Cổng SMTP phải từ 1 đến 65535")
	}
	if c.Security, err = strip(d["security"], 10, "Kiểu bảo mật"); err != nil {
		return c, err
	}
	if c.Security != "ssl" && c.Security != "starttls" && c.Security != "none" {
		return c, bad("Kiểu bảo mật phải là ssl, starttls hoặc none")
	}
	if c.User, err = strip(d["user"], 200, "Tài khoản SMTP"); err != nil {
		return c, err
	}
	if c.FromEmail, err = strip(d["from_email"], 200, "Email người gửi"); err != nil {
		return c, err
	}
	if !emailRe.MatchString(c.FromEmail) || !noCRLF(c.FromEmail) {
		return c, bad("Email người gửi không hợp lệ")
	}
	if c.FromName, err = strip(d["from_name"], 100, "Tên người gửi"); err != nil {
		return c, err
	}
	if !noCRLF(c.FromName) || !noCRLF(c.User) {
		return c, bad("Tên hoặc tài khoản không được xuống dòng")
	}
	if c.NotifyTo, err = strip(d["notify_to"], 1000, "Email nhận thông báo"); err != nil {
		return c, err
	}
	var tos []string
	for _, t := range splitList(c.NotifyTo) {
		if !emailRe.MatchString(t) || !noCRLF(t) {
			return c, bad("Email nhận thông báo không hợp lệ: %s", t)
		}
		tos = append(tos, t)
	}
	if len(tos) > 10 {
		return c, bad("Tối đa 10 email nhận thông báo")
	}
	c.NotifyTo = strings.Join(tos, ", ")
	c.NotifyLeads = truthy(d["notify_leads"])
	c.ConfirmCustomer = truthy(d["confirm_customer"])
	return c, nil
}

func chunk76(s string) string {
	var b strings.Builder
	for len(s) > 76 {
		b.WriteString(s[:76] + "\r\n")
		s = s[76:]
	}
	b.WriteString(s)
	return b.String()
}

// splitList tách danh sách cách nhau bởi dấu phẩy, chấm phẩy hoặc xuống dòng.
func splitList(s string) []string {
	var out []string
	for _, p := range strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == ';' || r == '\n' || r == ' ' }) {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

// buildMsg dựng thư UTF-8 (tiêu đề mã hoá RFC 2047). Có htmlBody thì gửi cả hai bản (multipart/alternative):
// ứng dụng thư hiện bản HTML, máy không hỗ trợ thì hiện bản chữ.
func buildMsg(c smtpCfg, to []string, subject, body string, htmlBody ...string) []byte {
	from := c.FromEmail
	if c.FromName != "" {
		from = mime.QEncoding.Encode("utf-8", c.FromName) + " <" + c.FromEmail + ">"
	}
	host := c.Host
	if i := strings.LastIndex(c.FromEmail, "@"); i >= 0 {
		host = c.FromEmail[i+1:]
	}
	var b strings.Builder
	b.WriteString("From: " + from + "\r\n")
	b.WriteString("To: " + strings.Join(to, ", ") + "\r\n")
	if c.replyTo != "" && emailRe.MatchString(c.replyTo) && noCRLF(c.replyTo) {
		b.WriteString("Reply-To: " + c.replyTo + "\r\n")
	}
	b.WriteString("Subject: " + mime.QEncoding.Encode("utf-8", subject) + "\r\n")
	b.WriteString("Date: " + time.Now().Format(time.RFC1123Z) + "\r\n")
	b.WriteString("Message-ID: <" + randHex(12) + "@" + host + ">\r\n")
	b.WriteString("MIME-Version: 1.0\r\n")
	part := func(ctype, content string) {
		b.WriteString("Content-Type: " + ctype + "; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n")
		b.WriteString(chunk76(base64.StdEncoding.EncodeToString([]byte(strings.ReplaceAll(content, "\n", "\r\n")))))
		b.WriteString("\r\n")
	}
	if len(htmlBody) == 0 || htmlBody[0] == "" {
		part("text/plain", body)
		return []byte(b.String())
	}
	bd := "=_3rdhub_" + randHex(10)
	b.WriteString("Content-Type: multipart/alternative; boundary=\"" + bd + "\"\r\n\r\n")
	b.WriteString("--" + bd + "\r\n")
	part("text/plain", body)
	b.WriteString("--" + bd + "\r\n")
	part("text/html", htmlBody[0])
	b.WriteString("--" + bd + "--\r\n")
	return []byte(b.String())
}

// smtpSend gửi một thư qua SMTP (ssl = TLS ngay từ đầu, starttls = nâng cấp sau khi kết nối), có giới hạn thời gian.
func smtpSend(c smtpCfg, pass string, to []string, subject, body string, htmlBody ...string) error {
	for _, t := range to {
		if !emailRe.MatchString(t) || !noCRLF(t) {
			return fmt.Errorf("địa chỉ nhận không hợp lệ: %q", t)
		}
	}
	addr := net.JoinHostPort(c.Host, strconv.Itoa(c.Port))
	d := net.Dialer{Timeout: 12 * time.Second}
	tc := &tls.Config{ServerName: c.Host, MinVersion: tls.VersionTLS12}
	var conn net.Conn
	var err error
	if c.Security == "ssl" {
		conn, err = tls.DialWithDialer(&d, "tcp", addr, tc)
	} else {
		conn, err = d.Dial("tcp", addr)
	}
	if err != nil {
		return fmt.Errorf("không kết nối được %s: %w", addr, err)
	}
	defer conn.Close()
	conn.SetDeadline(time.Now().Add(40 * time.Second))
	cl, err := smtp.NewClient(conn, c.Host)
	if err != nil {
		return fmt.Errorf("máy chủ SMTP không phản hồi đúng: %w", err)
	}
	defer cl.Close()
	if c.Security == "starttls" {
		if err := cl.StartTLS(tc); err != nil {
			return fmt.Errorf("không bật được STARTTLS: %w", err)
		}
	}
	if c.User != "" {
		if err := cl.Auth(smtp.PlainAuth("", c.User, pass, c.Host)); err != nil {
			return fmt.Errorf("đăng nhập SMTP thất bại (kiểm tra tài khoản và mật khẩu): %w", err)
		}
	}
	if err := cl.Mail(c.FromEmail); err != nil {
		return fmt.Errorf("máy chủ từ chối email người gửi: %w", err)
	}
	for _, t := range to {
		if err := cl.Rcpt(t); err != nil {
			return fmt.Errorf("máy chủ từ chối người nhận %s: %w", t, err)
		}
	}
	w, err := cl.Data()
	if err != nil {
		return err
	}
	if _, err := w.Write(buildMsg(c, to, subject, body, htmlBody...)); err != nil {
		return err
	}
	if err := w.Close(); err != nil {
		return err
	}
	return cl.Quit()
}

// sendMail gửi thư bằng cấu hình đã lưu. Trả lỗi nếu chưa cấu hình mật khẩu.
func (a *App) sendMail(ctx context.Context, to []string, subject, body string, htmlBody ...string) error {
	return a.sendMailReply(ctx, to, "", subject, body, htmlBody...)
}

// sendMailReply như sendMail, thêm Reply-To (bấm Trả lời sẽ gửi tới địa chỉ này).
func (a *App) sendMailReply(ctx context.Context, to []string, replyTo, subject, body string, htmlBody ...string) error {
	c := a.loadSMTP(ctx)
	c.replyTo = replyTo
	if c.PassEnc == "" && c.User != "" {
		return errors.New("chưa nhập mật khẩu SMTP")
	}
	pass, err := a.unseal(c.PassEnc)
	if err != nil {
		return fmt.Errorf("không đọc được mật khẩu SMTP đã lưu: %w", err)
	}
	return smtpSend(c, pass, to, subject, body, htmlBody...)
}
