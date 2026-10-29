package main

import (
	"context"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

func openDB(ctx context.Context, url string) (*pgxpool.Pool, error) {
	pool, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	// chờ cơ sở dữ liệu sẵn sàng (khi dịch vụ vừa khởi động cùng PostgreSQL)
	var last error
	for i := 0; i < 30; i++ {
		c, cancel := context.WithTimeout(ctx, 3*time.Second)
		last = pool.Ping(c)
		cancel()
		if last == nil {
			return pool, nil
		}
		time.Sleep(time.Second)
	}
	pool.Close()
	return nil, fmt.Errorf("không kết nối được PostgreSQL: %w", last)
}

// migrate chạy các file migrations/*.sql theo thứ tự, mỗi file đúng một lần.
func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	if _, err := pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`); err != nil {
		return err
	}
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)
	for _, name := range names {
		var done bool
		if err := pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE version=$1)`, name).Scan(&done); err != nil {
			return err
		}
		if done {
			continue
		}
		sqlText, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		tx, err := pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sqlText)); err != nil {
			tx.Rollback(ctx)
			return fmt.Errorf("migration %s: %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations(version) VALUES($1)`, name); err != nil {
			tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

// ---- kv: giá trị JSON theo khoá

func kvGet(ctx context.Context, q interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}, key string, out any) (bool, error) {
	var raw []byte
	err := q.QueryRow(ctx, `SELECT value FROM kv WHERE key=$1`, key).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, json.Unmarshal(raw, out)
}

func kvSet(ctx context.Context, tx pgx.Tx, key string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = tx.Exec(ctx, `INSERT INTO kv(key,value) VALUES($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, key, string(b))
	return err
}

func kvSetPool(ctx context.Context, pool *pgxpool.Pool, key string, v any) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	_, err = pool.Exec(ctx, `INSERT INTO kv(key,value) VALUES($1,$2::jsonb) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`, key, string(b))
	return err
}
