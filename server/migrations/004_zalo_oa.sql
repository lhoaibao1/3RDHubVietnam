-- Zalo OA (tin tư vấn): mã ngắn để khách ghép tài khoản Zalo với yêu cầu, Zalo user id (theo OA) sau khi ghép,
-- hàng chờ tin chưa gửi được (ngoài khung tương tác Zalo cho phép) và danh sách tin đã xử lý (chống trùng khi Zalo gửi lại).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zalo_code text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zalo_code_exp bigint NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zalo_uid text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS zalo_linked_at bigint NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX IF NOT EXISTS leads_zalo_code ON leads(zalo_code) WHERE zalo_code <> '';
CREATE INDEX IF NOT EXISTS leads_zalo_uid ON leads(zalo_uid) WHERE zalo_uid <> '';

CREATE TABLE IF NOT EXISTS zalo_outbox (
  id bigserial PRIMARY KEY,
  lead_id bigint NOT NULL DEFAULT 0,
  uid text NOT NULL,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | sent | failed
  tries int NOT NULL DEFAULT 0,
  last_error text NOT NULL DEFAULT '',
  created bigint NOT NULL,
  sent_at bigint NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS zalo_outbox_pending ON zalo_outbox(uid) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS zalo_seen (
  msg_id text PRIMARY KEY,
  ts bigint NOT NULL
);
