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
