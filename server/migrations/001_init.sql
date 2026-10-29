-- Cấu trúc cơ sở dữ liệu ban đầu của 3RDHub CMS.
-- kv: các giá trị dạng JSON (nội dung website, mật khẩu băm, khoá ký phiên, thời điểm cập nhật)
CREATE TABLE IF NOT EXISTS kv (
    key   text PRIMARY KEY,
    value jsonb NOT NULL
);

-- Lịch sử các lần lưu nội dung (giữ 60 bản gần nhất)
CREATE TABLE IF NOT EXISTS revisions (
    id       bigserial PRIMARY KEY,
    ts       bigint NOT NULL,
    note     text NOT NULL DEFAULT '',
    snapshot jsonb NOT NULL
);

-- Yêu cầu tư vấn từ form liên hệ
CREATE TABLE IF NOT EXISTS leads (
    id      bigserial PRIMARY KEY,
    ts      bigint NOT NULL,
    name    text NOT NULL,
    phone   text NOT NULL,
    company text NOT NULL DEFAULT '',
    need    text NOT NULL DEFAULT '',
    message text NOT NULL DEFAULT '',
    lang    text NOT NULL DEFAULT 'vi',
    ip      text NOT NULL DEFAULT '',
    ua      text NOT NULL DEFAULT '',
    status  text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'done', 'spam')),
    note    text NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS leads_ts_idx ON leads (ts DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx ON leads (status);
