# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

3RDHub Vietnam website (3rdhubvietnam.tech) and its CMS (cms.3rdhubvietnam.tech). Text and comments in the repo are Vietnamese.

## Layout and the one rule that bites
- `web/` Vue 3 + Vite + TS source: `web/src` = public site, `web/admin` = CMS UI. `server/` Go + PostgreSQL (only extra dep `pgx`, vendored).
- **Built output is committed**: `site/` and `admin/`. The VPS has no Node; a cron auto-deploys `main` via `deploy.sh`. After any UI change run `make web` (or `cd web && npm run build`) and commit `site/` + `admin/` too.

## Commands
```bash
make web                                   # npm ci, vue-tsc typecheck, build site/ + admin/ (includes prerender)
cd web && npm run dev                      # site :5173;  npm run dev:admin -> CMS :5174 (both proxy /api to :8787)
cd web && npm run check:strings            # every UI string has an EN translation and is editable in the CMS
make dev-server DATABASE_URL='postgres://postgres@127.0.0.1:5432/dev?sslmode=disable'   # CMS login host: cms.localhost:8787
cd server && TEST_DATABASE_URL='postgres://postgres@127.0.0.1:5432/cmstest?sslmode=disable' go test -mod=vendor -count=1 ./...
cd server && ... go test -mod=vendor -run TestSEOEnglish ./...     # single test
bash tools/test-deploy.sh                  # dry-runs deploy.sh nginx/systemd generation (needs PGHOST/PGPORT)
NODE_PATH=$(npm root -g) node tools/e2e/<seo|lang|admin|i18n|guard|dash|look|register|policies>.js   # Playwright against :8787
```
`e2e/register.js` needs `HUB_MOCK=1 HUB_SITE_KEY=khoa-thu`. Playwright APIRequest cannot resolve `cms.localhost`; use `page.evaluate(fetch)`.

## Architecture (needs several files to see)
- **i18n is compile-time**: write Vietnamese in Vue templates; `web/build/i18nTransform.ts` turns static text into `$t()`. English lives one-entry-per-line in `web/src/lib/en.json`; CMS-editable catalog in `web/admin/src/strings.json`. CMS saves auto-translate VI→EN (`server/translate.go`, `autoTranslate`; SEO fields via `translateSEO`); a hand-edited EN is kept.
- **URLs are `/vi/...` and `/en/...`** (router prefix `/:lang(vi|en)?`, guard in `web/src/router.ts`). nginx serves both from the same prerendered `<slug>.html`; the Go dev server strips the prefix (`langPrefixRe`).
- **SEO**: `web/scripts/prerender.mjs` writes per-route HTML with nginx SSI blocks (`/api/seo/<t|d|c|v|l>?p=<page>&l=$rh_lg`); `server/seo.go` returns CMS overrides (`seot_/seod_` VI, `seot_en_/seod_en_` EN) or EN defaults. `$rh_lg` comes from an nginx `map` in `deploy.sh`; `applySSI` imitates SSI when Go serves the site. **`web/scripts/seo.json` must equal `server/seed/seo.json`** (a test enforces it; `cp` after editing). Client side counterpart: `web/src/composables/useSeo.ts`.
- **Content model**: one JSON `Content` document (`server/content.go`; settings keys whitelisted in `settingKeys`/`settingMax`) saved with history; CMS tabs in `web/admin/src/views`.
- **3D**: `web/src/three/styles/{kit,skin,host}.ts`; night-native skins get a daytime variant in light mode (`dayVariant`); scene rebuilt on theme change.
- **Guard (anti-DDoS)** `server/guard.go`: layers Cloudflare → nginx rate limits → backend bans. Backend writes `*.conf` into `GUARD_DIR` (`/etc/nginx/3rdhub-guard`) and touches `reload`; systemd path unit runs `nginx -t && reload`. nginx 429s are proxied to `/api/guard/strike` (127.0.0.1 only). Real IP is trusted only from Cloudflare ranges. Never banned: private/loopback, Cloudflare, allowlist, admin's own IP.
- **Analytics** `server/stats.go`: cookieless, IP-less beacon `/api/hit`; feeds the CMS dashboard (`DashView.vue`).
- **Zalo OA** `server/zalo_own.go` (own OAuth v4, secrets sealed with AES-GCM) + `zalooa.go` (customer code `3R-xxxxx`, webhook, outbox). OA can only message users who messaged it, hence the code step on the registration form. Webhook returns 200 even on bad signature (Zalo's test button) but ignores the event. ZNS (paid) was removed on purpose; don't add without asking.
- **Email**: `mailTpl` in `server/notify.go`; preview via `mailpreview_test.go` with `MAIL_PREVIEW_DIR`.
- `deploy.sh` generates the whole nginx vhost (heredoc, so `\$` escapes) and systemd units; `tools/test-deploy.sh` asserts its output, so update it when changing nginx blocks.

## Gotchas
- Anything sensitive (SMTP password, VPS credentials, UAT login) is entered in the CMS or passed via env, never committed.
- Auto-deploy means a push to `main` is production; keep nginx changes validated by `tools/test-deploy.sh`.
