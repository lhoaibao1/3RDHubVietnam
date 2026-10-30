package main

import (
	"os"
	"strconv"
	"strings"
)

// Config đọc từ biến môi trường.
type Config struct {
	Port        string
	Bind        string
	DatabaseURL string
	DataDir     string // chứa thư mục uploads
	AdminDir    string // bản build của trang quản trị (Vue)
	SiteDir     string // chỉ dùng khi chạy thử cục bộ: phục vụ luôn site tĩnh
	AdminPass   string // mật khẩu quản trị ban đầu (chỉ dùng lần chạy đầu)
	CMSHosts    []string
	SessionTTL  int64
	// Zalo OA (tin tư vấn cho khách, dùng chung OA với 3RDHub; xem zalooa.go)
	ZaloTokenURL string // ZALO_OA_TOKEN_URL: điểm lấy access token mượn từ 3RDHub
	ZaloShareKey string // ZALO_OA_SHARE_KEY: khoá do chủ sản phẩm tạo trong 3RDHub
	ZaloAppID    string // ZALO_APP_ID: App ID của ứng dụng Zalo nhận webhook
	ZaloOAID     string // ZALO_OA_ID
	ZaloSecret   string // ZALO_WEBHOOK_SECRET: OA Secret Key của ứng dụng Zalo (xác thực chữ ký webhook)
	ZaloPublic   bool   // ZALO_OA_PUBLIC=1: hiện mã và nút Zalo OA cho khách sau khi gửi form
	ZaloPoll     bool   // ZALO_POLL=1: đọc tin gần nhất mỗi 45 giây khi không dùng được webhook
	ZaloAPIBase  string // ZALO_API_BASE: chỉ dùng khi thử (máy chủ Zalo giả), để trống khi chạy thật
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func loadConfig() Config {
	c := Config{
		Port:         env("PORT", "8787"),
		Bind:         env("BIND", "127.0.0.1"),
		DatabaseURL:  env("DATABASE_URL", "postgres://cms@127.0.0.1:5432/cms?sslmode=disable"),
		DataDir:      env("CMS_DATA", "./data"),
		AdminDir:     env("ADMIN_DIR", "./admin"),
		SiteDir:      os.Getenv("SITE_DIR"),
		AdminPass:    os.Getenv("CMS_ADMIN_PASSWORD"),
		SessionTTL:   12 * 3600,
		ZaloTokenURL: env("ZALO_OA_TOKEN_URL", ""),
		ZaloShareKey: strings.TrimSpace(os.Getenv("ZALO_OA_SHARE_KEY")),
		ZaloAppID:    env("ZALO_APP_ID", "3689777608400566243"),
		ZaloOAID:     env("ZALO_OA_ID", "147468245835855615"),
		ZaloSecret:   strings.TrimSpace(os.Getenv("ZALO_WEBHOOK_SECRET")),
		ZaloPublic:   env("ZALO_OA_PUBLIC", "") == "1",
		ZaloPoll:     env("ZALO_POLL", "") == "1",
		ZaloAPIBase:  env("ZALO_API_BASE", ""),
	}
	if ttl, err := strconv.Atoi(os.Getenv("SESSION_TTL")); err == nil && ttl > 0 {
		c.SessionTTL = int64(ttl)
	}
	for _, h := range strings.Split(os.Getenv("CMS_HOSTS"), ",") {
		if h = strings.ToLower(strings.TrimSpace(h)); h != "" {
			c.CMSHosts = append(c.CMSHosts, h)
		}
	}
	return c
}
