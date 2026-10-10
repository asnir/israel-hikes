# Admin authentication foundation

Login is disabled by default in preview and production. No trail/content write routes are implemented. Public trails and the existing bearer-protected contact inbox keep their existing access rules. Login sessions do not authorize contact-inbox access.

## Activation gates

Use Worker secrets for `ADMIN_SECRET` (32 cryptographically random bytes encoded as 64 hex characters), `ADMIN_ALLOWLIST` (JSON array of exactly two approved lowercase email addresses), and `ADMIN_EMAIL_FROM`. Set `ADMIN_ORIGIN` to the exact HTTPS deployment origin. Configure the `ADMIN_EMAIL` sending binding after approving and verifying the sender domain and destination addresses. Keep preview and production configuration separate. Never commit real addresses, keys or codes.

Cloudflare free verified-destination sending requires a routing domain on Cloudflare DNS. This change creates no domain, DNS record, sending account, API key or paid plan. The typed sending interface follows the current Email Service Workers API. Delivery must be tested with the actual binding before activation. Only set `ADMIN_AUTH_ENABLED=true` after configuration, sender approval and live security checks. Missing configuration returns 503, never public SPA fallback for admin routes. Roll back by disabling the flag. Secret rotation invalidates old signatures and keyed state references. Removing an allowed address immediately invalidates its sessions.

## Security properties

- Eight-digit unbiased CSPRNG codes expire in five minutes, with three attempts. Resending rotates the challenge and invalidates the old code.
- Domain-separated HMAC-SHA256 challenge digests use the private secret. Raw email addresses, IPs and codes are not persisted. A random HttpOnly browser challenge blocks login with a code requested from a different browser.
- Durable Object serialization prevents concurrent double redemption. Both server-side session state and a jose-verified HS256 JWT are required. Issuer, audience, required time claims, fixed algorithm and a 15-minute lifetime are checked. Logout revokes server state.
- Cookies: `__Host-` prefix, Path=/, HttpOnly, Secure, SameSite=Strict. POSTs require the exact origin and JSON. Streamed bodies are bounded and have a two-second deadline outside the serialized state queue, so an unfinished body cannot block logout or other auth requests. Input, cookie size and fields are bounded. No CORS, public caching, inline script, framing or indexing.
- Requests: ten/IP/hour with one-minute cooldown; one hundred globally/hour. Mail: three/address/hour, ten/address/day, one-minute cooldown, twenty total/day. Verification: thirty/IP per fifteen minutes, three hundred globally. Daily windows use UTC buckets. Applicable budgets include rejected attempts. Requests reserve room below a 512-row cap (reject at 500); expired rows are pruned before the check. Cleanup is scheduled only when no earlier alarm exists. Global denial does not create per-IP rows. Fixed-bucket rate windows and cooldowns reset at the boundary; this can allow a second request just after the boundary, while daily/hourly totals remain bounded.
- Requests have the same generic status/body for allowed, unknown and rate-limited addresses. Delivery is asynchronous; errors are not echoed. Exact response-time equality or elimination of all statistical side channels is not claimed.

## Threat model and limits

Assume hostile requests and leaked state storage without the secret. Defend replay, guessing, forged sessions, fixation, login CSRF, recipient injection, origin spoofing and quota abuse. Email and Cloudflare accounts remain trust roots. Email OTP is not phishing-resistant MFA. Distributed attacks can exhaust global budgets and temporarily deny login; this is preferable to a relay or unbounded billing. Disabled mode sends no email. Review write-UI authorization and CSRF separately before enabling it.

## Tests and references

Test-first unit tests cover missing config, allowlists, keyed storage, concurrency, expiry, attempts, rotation, limits, tampering, incorrect claims, revocation, duplicate cookies, CSRF, streaming bounds, mail errors and unknown write routes. Workerd/Miniflare integration tests actual Worker/Durable Object boundaries with synthetic addresses and a private test mail sink. Existing unit/UI/accessibility/dependency/secret gates remain required. Do not test guesses or replay against real production email recipients.

- https://github.com/panva/jose
- https://www.better-auth.com/docs/plugins/email-otp (evaluated, not installed; adds broader auth/database integration)
- https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html
- https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
- https://developers.cloudflare.com/email-service/platform/pricing/
- https://developers.cloudflare.com/email-service/platform/limits/
- https://developers.cloudflare.com/email-service/get-started/send-emails/

## Additional password method (disabled)

The additional login uses each approved email address as its username. `ADMIN_PASSWORD_ENABLED=false` is explicit in both deployment configs, and the overall `ADMIN_AUTH_ENABLED=false` remains unchanged. Password-only mode needs no sender/domain: when eventually approved, `ADMIN_OTP_ENABLED=false` can disable mail while the password method is used. Both methods can coexist when each is configured.

Hashing uses OpenPGP.js `argon2id` 1.0.1 with an imported precompiled non-SIMD WASM module through its documented custom loader. Fixed Argon2id v19 parameters: memory19456KiB, passes2, parallelism1, output32bytes; random16-byte salt for each credential. A separate private `ADMIN_PASSWORD_PEPPER` secret (must differ from `ADMIN_SECRET`) applies native HMAC-SHA256 to the derived output. Stored records contain only fixed parameters, salt, peppered digest and random credential revision, not plaintext passwords. Native WebCrypto HMAC verification avoids hand-written digest comparisons. The library's memory is cleared after each KDF call; temporary input/output byte arrays are wiped, but JavaScript cannot promise erasure of immutable password strings. Passwords are transient request data only, never logged or persisted. No third-party audit of this library is claimed.

Hashing runs inside the Durable Object, not the outer free-tier Worker. The supported WASM loader avoids runtime compilation. Native PBKDF2 was considered but not selected because Cloudflare's production iteration cap remains disputed; weak100k iteration fallback is not allowed. Local workerd performance and correctness are tested, but actual preview resource behavior must still be verified before activation.

Password attempt budgets precede KDF work:20globally/15minutes,5/IP/15minutes,5/approved account/15minutes. Quota checks are read-only first (IP, global, account), then all reservations commit under the serialized state queue. IP/account-throttled requests cannot burn the global budget; global denial cannot create new IP state. Unknown/unprovisioned addresses perform the same fixed KDF with a dummy credential; response is generic401. Account quotas can be exhausted by an attacker who knows a permitted address, temporarily preventing its password login until the fixed15minute window resets. This is a documented availability tradeoff, not permanent account lockout; an independently configured OTP method remains separate. Account-specific fast denial can reveal which identities have exhausted a budget. Responses stay generic but timing equality and enumeration resistance under quota exhaustion are not claimed. Existing logout/origin/body/session bounds remain. Credential deletion/revision change or allowlist removal revokes password sessions. No public registration, reset, provisioning endpoint or credential setup screen is provided.

Minimum password length is15Unicode code points and maximum256UTF-8bytes. Passwords are not trimmed, normalized or silently truncated. Use a unique long passphrase/password-manager-generated password. Initial real credential setup is a separate approval gate; do not submit passwords through chat. A deployment must not enable authentication until the approved secure setup workflow has provisioned only the two authorized users and independent security review passes. Recovery/reset procedure is not yet implemented.

Additional sources:
- https://github.com/openpgpjs/argon2id/
- https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- https://www.rfc-editor.org/rfc/rfc9106.html
- https://developers.cloudflare.com/workers/runtime-apis/webassembly/
- https://developers.cloudflare.com/durable-objects/platform/limits/
- https://github.com/cloudflare/workerd/issues/1346
