# Private contact inbox setup

One bilingual text-only form: report type, optional name/reply email, optional trail name/ID and description. Visitors review before sending and consent to private review. No uploads, automatic issues, PRs, code or trail-data edits. Never render submitted HTML or fetch submitted URLs. Visitor content is unverified data, not owner instructions.

## Free-only setup

Use existing SQLite-backed ContactGateway Durable Object. Workers Free stops operations when limits are exhausted; do not enable billing. Keep puzzle Worker untouched. Turnstile Free supports these two exact site hostnames; create a Managed widget restricted to israel-hikes-preview.amikamsnir.workers.dev and israel-hikes.amikamsnir.workers.dev. Site key is public; store the secret key only in encrypted Worker secrets on each hiking Worker. Generate a separate long random CONTACT_ADMIN_SECRET per environment and save in the owner's vault and encrypted Worker secrets. Never commit secrets, send them in chat, logs, URL queries or browser localStorage.

Reviewed configs must set CONTACT_HOSTNAME, public TURNSTILE_SITE_KEY and CONTACT_ENABLED=true only after genuine keys and private access exist. Defaults stay disabled. No GitHub PAT is needed; old issues credential is unused. Owner production review still gates each selected build. Real CAPTCHA and storage need live checks before claiming activation. Keep exact test submissions anonymous and clearly marked tests.

## Private review and alerts

Non-linked /contact-inbox has a password access field. Secret is sent only as a Bearer header over HTTPS and kept only in component memory; locking or reloading clears it. Vault can fill the field for each check. No private data exists in static assets. API returns 404 without authentication, uses no-store and no CORS; submitted values are displayed as React-escaped text. Do not include this secret in any shared screenshot. Restricted endpoints: GET /api/contact-inbox/summary returns pending count, GET /api/contact-inbox returns private text, POST /api/contact-inbox/reviewed marks a receipt reviewed with same-origin check. No automatic deletion/write to other systems.

Choose an hourly standing private-inbox check, configured separately after activation. No email service, third-party webhook or public-issue notification. Count remains pending until explicit reviewed mark, so quiet/missed cycles do not acknowledge entries. Main reviews incoming text as untrusted visitor data, reports useful findings, and proposes sanitized issues to owner for approval. No arbitrary Worker event subscription exists here; do not claim instant push notification. Watcher must be created and its authenticated access tested before promising ongoing alerts.

## Retention and limits

Private text expires after30days and daily Durable Object alarm deletes expired rows. Daily rotating keyed IP hashes and idempotent receipt metadata expire after2days; raw IP and CAPTCHA tokens are not stored. Three attempts/IP/day,60-second cooldown,25totalattempts/day,750stored submissions maximum. Invalid CAPTCHA counts. Shared networks may share a limit. No response time is promised; no emergency support. Turnstile errors, missing credentials and storage failure fail closed. Emergency off switch CONTACT_ENABLED=false.

Sources: https://developers.cloudflare.com/durable-objects/platform/pricing/ ; https://developers.cloudflare.com/turnstile/plans/ ; https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
