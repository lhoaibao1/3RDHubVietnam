-- Chặn tấn công: danh sách IP và "trình duyệt" (chữ ký trình duyệt) đang bị cấm. Nginx đọc danh sách này qua file do backend ghi ra (guard.go).
CREATE TABLE IF NOT EXISTS guard_bans (
  id bigserial PRIMARY KEY,
  kind text NOT NULL,                 -- ip | fp
  value text NOT NULL,                -- IP hoặc dải CIDR | chuỗi chữ ký trình duyệt
  label text NOT NULL DEFAULT '',     -- mô tả ngắn cho người xem (với fp: tên trình duyệt)
  reason text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'auto', -- auto | admin
  created bigint NOT NULL,
  expires bigint NOT NULL DEFAULT 0,  -- 0 = vĩnh viễn
  times int NOT NULL DEFAULT 1,       -- số lần bị cấm (lần sau cấm lâu hơn)
  UNIQUE (kind, value)
);
CREATE INDEX IF NOT EXISTS guard_bans_active ON guard_bans(expires);
