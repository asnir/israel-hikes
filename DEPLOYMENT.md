# Preview then owner-approved production

Workers Free only. Do not upgrade billing or alter the puzzle Workers.

- Preview: https://israel-hikes-preview.amikamsnir.workers.dev/
- Production: https://israel-hikes.amikamsnir.workers.dev/
- A main push validates, then deploys preview when CLOUDFLARE_DEPLOY_ENABLED is explicitly enabled.
- The production job waits for GitHub environment `production` approval by `asnir`. Never approve on the owner's behalf. Administrator bypass is disabled, and only main may deploy. Self-review prevention is off because the sole owner must be able to approve their own main push.
- After reviewing preview, the owner opens the workflow run, chooses Review deployments, selects production and Approve and deploy. Reject stale runs rather than approving them after newer changes.
- Production consumes the exact static assets uploaded by that run's preview job and the same commit's Worker source. Artifact retention is 7 days; after expiry, rerun validation/preview rather than attempting a stale production approval.
- Preview and production have independent Workers and Durable Object state. Contact is enabled in both configs and fails closed when its encrypted secrets are absent.
- Production's Turnstile secret is encrypted in that Worker. Preview contact is enabled with its own encrypted secrets; preview has no issue-creation credentials. Neither preview nor production can edit trails through the form.
- Account-owned token is Editor on israel-hikes and israel-hikes-preview only; stored in israel-hikes repo Actions secret, expires January 8, 2027. Verification uses the account endpoint. Account ID comes from the owner account dashboard.
- A public preview is not a private staging area: only sanitized public content belongs in it.

The environment gate protects workflow deployments, not account owners who deliberately change settings or deploy manually. GitHub accounts remain asnir, so a browser assistant technically shares the owner's ability to approve; the assistant must never press the production approval button for the owner.

Approval UI reference: https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/reviewing-deployments

## Narrow dashboard bootstrap

The preview job reads the preview Worker deployment origin the same way before every upload, because the preview Worker was also dashboard-created.

The owner-approved production job reads only the production hiking Worker deployment origin. If it is dashboard-created, the first upload uses exact Wrangler 4.30.0, which supports this assets/Durable Objects configuration and asks the usual dashboard overwrite confirmation without importing unrelated account-level route/domain metadata. It retains secrets, applies the checked local configuration and never broadens the per-Worker token. The existing production environment review remains mandatory. Once the first successful upload is Wrangler-owned, subsequent jobs select current exact Wrangler 4.149.0 automatically. Unknown origin or unreadable metadata stops the job. The bootstrap is not a guarantee that upload will succeed; deployed bytes are checked afterward.

Production verification also runs when the upload command fails late, because a metadata/trigger read can fail after the Worker version was uploaded. A successful byte check in that case proves the site is serving the tested assets, not that all trigger updates completed. The original failed deploy step remains failed; no failure is hidden or ignored, and the owner gate is unchanged.
