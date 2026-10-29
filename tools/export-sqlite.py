#!/usr/bin/env python3
"""Xuất dữ liệu CMS bản cũ (SQLite) ra JSON để nạp vào PostgreSQL: server import <file.json>.
Chỉ dùng thư viện chuẩn của Python. Cách dùng: export-sqlite.py /var/lib/3rdhub-cms/cms.db > dump.json"""
import json
import sqlite3
import sys

con = sqlite3.connect("file:%s?mode=ro" % sys.argv[1], uri=True)
con.row_factory = sqlite3.Row
out = {
    "kv": {r["key"]: json.loads(r["value"]) for r in con.execute("SELECT key,value FROM kv")},
    "revisions": [{"ts": r["ts"], "note": r["note"] or "", "snapshot": json.loads(r["snapshot"])}
                  for r in con.execute("SELECT ts,note,snapshot FROM revisions ORDER BY id")],
    "leads": [{k: (r[k] if r[k] is not None else ("" if k != "ts" else 0)) for k in r.keys() if k != "id"}
              for r in con.execute("SELECT * FROM leads ORDER BY id")],
}
json.dump(out, sys.stdout, ensure_ascii=False)
