package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

const version = "1.0.0"

func newApp(ctx context.Context) (*App, error) {
	cfg := loadConfig()
	pool, err := openDB(ctx, cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	if err := migrate(ctx, pool); err != nil {
		return nil, err
	}
	d, err := loadDefaults()
	if err != nil {
		return nil, err
	}
	a := &App{cfg: cfg, pool: pool, defaults: d, rl: newLimiter(), tr: newTranslator()}
	if err := a.initData(ctx); err != nil {
		return nil, err
	}
	return a, nil
}

func main() {
	cmd := "serve"
	if len(os.Args) > 1 {
		cmd = os.Args[1]
	}
	ctx := context.Background()
	switch cmd {
	case "version", "--version":
		fmt.Println(version)
	case "serve":
		a, err := newApp(ctx)
		if err != nil {
			log.Fatal(err)
		}
		serve(a)
	case "reset-password", "--reset-password":
		a, err := newApp(ctx)
		if err != nil {
			log.Fatal(err)
		}
		pw := randHex(9)
		if len(os.Args) > 2 {
			pw = os.Args[2]
		}
		if err := kvSetPool(ctx, a.pool, "admin_hash", hashPW(pw)); err != nil {
			log.Fatal(err)
		}
		fmt.Println("Mật khẩu quản trị mới:", pw)
	case "import":
		if len(os.Args) < 3 {
			log.Fatal("cách dùng: server import <file.json> [thư-mục-uploads-cũ]")
		}
		a, err := newApp(ctx)
		if err != nil {
			log.Fatal(err)
		}
		if err := a.importLegacy(ctx, os.Args[2]); err != nil {
			if errors.Is(err, errHasData) {
				log.Print(err)
				os.Exit(3)
			}
			log.Fatal(err)
		}
		if len(os.Args) > 3 {
			n, err := copyUploads(os.Args[3], a.uploads())
			if err != nil {
				log.Fatal(err)
			}
			fmt.Printf("Đã sao chép %d ảnh\n", n)
		}
	default:
		log.Fatalf("lệnh không hợp lệ: %s (serve | reset-password | import | version)", cmd)
	}
}

func serve(a *App) {
	srv := &http.Server{
		Addr:              a.cfg.Bind + ":" + a.cfg.Port,
		Handler:           a,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	go func() {
		for range time.Tick(5 * time.Minute) {
			a.rl.gc()
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-stop
		c, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		srv.Shutdown(c)
	}()
	log.Printf("3RDHub CMS chạy tại http://%s (dữ liệu: %s)", srv.Addr, a.cfg.DataDir)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
	a.pool.Close()
}
