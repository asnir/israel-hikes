# Preview then owner-approved production

Workers Free only. Do not upgrade billing or alter the puzzle Workers.

- Preview: https://israel-hikes-preview.amikamsnir.workers.dev/
- Production: https://israel-hikes.amikamsnir.workers.dev/
- A main push validates, then deploys preview when CLOUDFLARE_DEPLOY_ENABLED is explicitly enabled.
- The production job waits for GitHub environment `production` approval by `asnir`. Never approve on the owner's behalf. Administrator bypass is disabled, and only main may deploy. Self-review prevention is off because the sole owner must be able to approve their own main push.
- After reviewing preview, the owner opens the workflow run, chooses Review deployments, selects production and Approve and deploy. Reject stale runs rather than approving them after newer changes.
- Production consumes the exact static assets uploaded by that run's preview job and the same commit's Worker source. Artifact retention is 7 days; after expiry, rerun validation/preview rather than attempting a stale production approval.
- Preview and production have independent Workers and Durable Object state. Contact stays disabled in both configs pending approved setup and integration testing.
- Production's Turnstile secret is encrypted in that Worker. Preview contact stays disabled; preview has no issue-creation credentials. Neither preview nor production can edit trails through the form.
- Account-owned token is Editor on israel-hikes and israel-hikes-preview only; stored in israel-hikes repo Actions secret, expires January 8, 2027. Verification uses the account endpoint. Account ID comes from the owner account dashboard.
- A public preview is not a private staging area: only sanitized public content belongs in it.

The environment gate protects workflow deployments, not account owners who deliberately change settings or deploy manually. GitHub accounts remain asnir, so a browser assistant technically shares the owner's ability to approve; the assistant must never press the production approval button for the owner.

Approval UI reference: https://docs.github.com/en/actions/managing-workflow-runs-and-deployments/managing-deployments/reviewing-deployments
