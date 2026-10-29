# Lệnh thường dùng. Cần Node.js >= 20 và Go >= 1.22 trên máy phát triển (VPS không cần Node).
.PHONY: web server-test dev-server deps

deps:            ## cài thư viện giao diện
	cd web && npm ci

web: deps        ## build website (-> site/) và trang quản trị (-> admin/), nhớ commit cả hai thư mục
	cd web && npm run build

server-test:     ## test backend với PostgreSQL thật: make server-test TEST_DATABASE_URL=postgres://...
	cd server && TEST_DATABASE_URL="$(TEST_DATABASE_URL)" go test -count=1 ./...

dev-server:      ## chạy backend: make dev-server DATABASE_URL=postgres://...
	cd server && DATABASE_URL="$(DATABASE_URL)" CMS_DATA=../.data ADMIN_DIR=../admin SITE_DIR=../site CMS_ADMIN_PASSWORD=matkhau-thu-nghiem go run .
