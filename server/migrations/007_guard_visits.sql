-- Lịch sử khách truy cập để điều tra khi bị tấn công: mỗi dòng là một (ngày, IP, thiết bị). Tự xoá sau số ngày cài trong CMS (mặc định 30).
CREATE TABLE IF NOT EXISTS guard_visits (
  day text NOT NULL,                  -- YYYY-MM-DD theo giờ Việt Nam
  ip text NOT NULL,
  dv text NOT NULL DEFAULT '',        -- mã thiết bị (băm ẩn danh)
  cc text NOT NULL DEFAULT '',
  ua text NOT NULL DEFAULT '',
  model text NOT NULL DEFAULT '',
  fp text NOT NULL DEFAULT '',
  path text NOT NULL DEFAULT '',
  views int NOT NULL DEFAULT 0,
  first bigint NOT NULL,
  last bigint NOT NULL,
  PRIMARY KEY (day, ip, dv)
);
CREATE INDEX IF NOT EXISTS guard_visits_last ON guard_visits(last);
CREATE INDEX IF NOT EXISTS guard_visits_ip ON guard_visits(ip);
