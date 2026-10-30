-- Bộ nhớ đệm bản dịch Việt -> Anh (khoá là băm của đoạn tiếng Việt) để không dịch lại cùng một đoạn.
CREATE TABLE IF NOT EXISTS tr_cache (
    h  text PRIMARY KEY,
    en text NOT NULL,
    ts bigint NOT NULL
);
