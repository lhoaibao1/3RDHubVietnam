-- Thống kê truy cập của chính website, không cookie, không lưu IP hay User-Agent: mỗi lượt xem trang một dòng.
-- vid là mã ẩn danh đổi mỗi ngày (HMAC của IP + trình duyệt với khoá bí mật của máy chủ) chỉ để đếm số khách khác nhau.
CREATE TABLE IF NOT EXISTS stats_hits (
  id bigserial PRIMARY KEY,
  ts bigint NOT NULL,
  vid text NOT NULL,
  path text NOT NULL,
  ref text NOT NULL DEFAULT '',   -- tên miền giới thiệu (hoặc utm_source)
  ch text NOT NULL DEFAULT 'direct', -- direct | search | social | referral | campaign
  cc text NOT NULL DEFAULT '',    -- mã quốc gia (Cloudflare CF-IPCountry)
  dev text NOT NULL DEFAULT '',   -- mobile | tablet | desktop
  br text NOT NULL DEFAULT '',
  os text NOT NULL DEFAULT '',
  lang text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS stats_hits_ts ON stats_hits(ts);
