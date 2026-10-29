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
}

func env(key, def string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return def
}

func loadConfig() Config {
	c := Config{
		Port:        env("PORT", "8787"),
		Bind:        env("BIND", "127.0.0.1"),
		DatabaseURL: env("DATABASE_URL", "postgres://cms@127.0.0.1:5432/cms?sslmode=disable"),
		DataDir:     env("CMS_DATA", "./data"),
		AdminDir:    env("ADMIN_DIR", "./admin"),
		SiteDir:     os.Getenv("SITE_DIR"),
		AdminPass:   os.Getenv("CMS_ADMIN_PASSWORD"),
		SessionTTL:  12 * 3600,
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
