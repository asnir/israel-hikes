# D1 migration preparation

This foundation is disabled by default. It does not create a database, grant admin access, or change the public site's data source.

## Import

Build the verified source and generate SQL with `node scripts/d1-seed.mjs OUTPUT.sql`. Apply `migrations/0001_trail_store.sql` followed by the seed to a new, empty preview database. The seed uses a transaction and does not overwrite an existing database. Back up before changing populated data.

The seed preserves 233 public sanitized trail records, four long trails, individual photo rights and exact public JSON snapshots. It adds no admins and imports no contact submissions, credentials or visitor origins. Photo bytes remain licensed static assets.

## Verification and cutover

1. Verify counts, foreign keys and every public snapshot against build bytes.
2. Bind a separate preview database as `TRAILS_DB`; enable `TRAIL_READ_SOURCE=d1` only in preview.
3. Verify all public feeds and the full UI before production.
4. Repeat import and verification with a separate production database before enabling it.
5. Keep static snapshots during cutover. Missing rows, malformed JSON and D1 failures fall back to static reads. Public endpoints remain GET/HEAD only.

This is initial-read migration preparation, not admin editing. Editable data requires a verified snapshot-refresh strategy so fallback does not resurrect deleted routes or lose edits. Client catalog loading must use the same authoritative store before admin writes are enabled.

## Free-tier limits

Official pricing and limits: https://developers.cloudflare.com/d1/platform/pricing/ and https://developers.cloudflare.com/d1/platform/limits/ . Free includes 5 million rows read/day, 100,000 written/day, 5 GB total and 500 MB per database. Check current limits before setup. Exhaustion returns errors, so indexed bounded reads, caching and fallback matter. No paid upgrade is included.

## Isolated preview trial

The separate preview database contains public data only and no admin memberships. The preview config binds it with read-only application code. This branch deploys preview only after the existing validation, secret scan and security gates. Production still requires a main push and never runs for this trial PR. Do not merge this branch or enable a production binding without a separate cutover decision.

D1 caps each SQL statement at 100 KB. Large catalog inserts need bound parameters or bounded staging fragments, followed by one assembly into a JSON-valid snapshot and staging cleanup. Verify exact bytes after import, not only counts.
