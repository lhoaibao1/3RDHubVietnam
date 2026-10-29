package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

// legacyDump là định dạng JSON xuất từ cơ sở dữ liệu SQLite của bản cũ (xem tools/export-sqlite.py).
type legacyDump struct {
	KV        map[string]json.RawMessage `json:"kv"`
	Revisions []struct {
		TS       int64           `json:"ts"`
		Note     string          `json:"note"`
		Snapshot json.RawMessage `json:"snapshot"`
	} `json:"revisions"`
	Leads []leadRow `json:"leads"`
}

// errHasData: CSDL đã có dữ liệu nên không import (main thoát với mã 3, deploy.sh coi là bình thường).
var errHasData = errors.New("đã có dữ liệu")

// importLegacy nạp dữ liệu từ bản Python/SQLite cũ vào PostgreSQL. Chỉ chạy được khi CSDL còn trống
// (chưa có nội dung nào được lưu), để không ghi đè dữ liệu đang dùng.
func (a *App) importLegacy(ctx context.Context, file string) error {
	raw, err := os.ReadFile(file)
	if err != nil {
		return err
	}
	var d legacyDump
	if err := json.Unmarshal(raw, &d); err != nil {
		return fmt.Errorf("file không đúng định dạng: %w", err)
	}
	var n int64
	if err := a.pool.QueryRow(ctx, `SELECT (SELECT COUNT(*) FROM revisions)+(SELECT COUNT(*) FROM leads)`).Scan(&n); err != nil {
		return err
	}
	if n > 0 {
		return fmt.Errorf("CSDL đã có dữ liệu (%d bản ghi), bỏ qua import để không ghi đè: %w", n, errHasData)
	}
	tx, err := a.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	for _, k := range []string{"secret", "admin_hash", "updated"} {
		if v, ok := d.KV[k]; ok {
			if _, err := tx.Exec(ctx, `INSERT INTO kv(key,value) VALUES($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, k, string(v)); err != nil {
				return err
			}
		}
	}
	if v, ok := d.KV["content"]; ok {
		var anyC any
		if err := json.Unmarshal(v, &anyC); err != nil {
			return err
		}
		c, err := cleanContent(anyC)
		if err != nil {
			return fmt.Errorf("nội dung cũ không hợp lệ: %w", err)
		}
		if err := kvSet(ctx, tx, "content", c); err != nil {
			return err
		}
	}
	for _, r := range d.Revisions {
		if _, err := tx.Exec(ctx, `INSERT INTO revisions(ts,note,snapshot) VALUES($1,$2,$3::jsonb)`, r.TS, r.Note, string(r.Snapshot)); err != nil {
			return err
		}
	}
	for _, l := range d.Leads {
		if l.Status == "" {
			l.Status = "new"
		}
		if l.Lang == "" {
			l.Lang = "vi"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO leads(ts,name,phone,company,need,message,lang,ip,ua,status,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
			l.TS, l.Name, l.Phone, l.Company, l.Need, l.Message, l.Lang, l.IP, l.UA, l.Status, l.Note); err != nil {
			return err
		}
	}
	if err := tx.Commit(ctx); err != nil {
		return err
	}
	if _, ok := d.KV["admin_hash"]; ok { // giữ mật khẩu cũ: file mật khẩu tạm của lần khởi tạo không còn đúng
		os.Remove(filepath.Join(a.cfg.DataDir, "initial-admin-password.txt"))
	}
	fmt.Printf("Đã import: %d phiên bản, %d yêu cầu khách\n", len(d.Revisions), len(d.Leads))
	return nil
}

// copyUploads sao chép ảnh tải lên từ thư mục cũ (nếu khác thư mục mới).
func copyUploads(from, to string) (int, error) {
	if from == to {
		return 0, nil
	}
	ents, err := os.ReadDir(from)
	if err != nil {
		return 0, err
	}
	os.MkdirAll(to, 0o755)
	n := 0
	for _, e := range ents {
		if e.IsDir() {
			continue
		}
		dst := filepath.Join(to, e.Name())
		if _, err := os.Stat(dst); err == nil {
			continue
		}
		b, err := os.ReadFile(filepath.Join(from, e.Name()))
		if err != nil {
			return n, err
		}
		if err := os.WriteFile(dst, b, 0o644); err != nil {
			return n, err
		}
		n++
	}
	return n, nil
}
