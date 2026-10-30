-- Email của khách (không bắt buộc) để gửi thư xác nhận khi đăng ký.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email text NOT NULL DEFAULT '';
