# Account deletion and support requests

Updated October 18, 2026. This is an implementation/runbook record, not a completed public-launch policy review.

## User entry points

- In app: Profile → Settings → Delete account. Cancellation does not call the backend. A failed request preserves local composition files; those files are cleared only after acceptance.
- Web: `https://earlyworld-6831c.web.app/delete-account.html`. This opens an email draft to `earlyworldofficial@gmail.com`; it is not an automated deletion form. The requester must send the email and support must verify ownership.
- The website footer and hosted community page link to the deletion page. In-app deletion links there as a fallback.

## Sign-in methods

The callable derives the UID from authentication and requires an authentication time within five minutes. Missing, malformed, future, and stale times fail. Password and Google users with stale authentication sign out and sign in again, then explicitly return and confirm deletion; no automatic deletion retry occurs.

Apple-linked accounts on iPhone obtain a fresh Apple credential, reauthenticate the **same Firebase user**, and pass the fresh authorization code to RNFirebase `revokeToken`. A different Apple ID is rejected rather than switching accounts. Cancellation stops before queuing deletion. The ID token is refreshed before the callable. Non-iOS Apple-linked accounts are directed to iPhone or the web support request. A failed backend request after Apple revocation can be retried, but the two operations are not an atomic transaction.

References: [Firebase Apple authentication and token revocation](https://firebase.google.com/docs/auth/ios/apple), [RNFirebase social authentication](https://rnfirebase.io/auth/social-auth), [Google Play external deletion resources](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

## Support handling

1. A designated support operator monitors the published mailbox. Identify the account by username/email, including an Apple relay email where applicable. Knowledge of an email or username alone is not proof of ownership. Never ask for passwords, OTPs, or identity documents.
2. Prefer the authenticated in-app deletion flow. If the user cannot use it, complete a documented ownership-verification process through a verified channel before any administrator queues removal. Do not delete an account merely because an email requests it.
3. Use the existing `_accountDeletion/{uid}` background workflow, not Auth-console deletion alone: deleting only Auth leaves content/media behind. An administrator handling a verified request must atomically set `_socialAccounts/{uid}` to `deleting: true, suspended: true` and create the deletion job with `stage: 0, complete: false, createdAt: server timestamp`, only if no job exists. Invalidate `socialState/current` with a server timestamp. Record verification in the restricted support case, not public app data. Never reset a running job.
4. Apple provider access revocation must also be addressed for manually handled Apple requests; the Firebase account record does not contain a reusable Apple access token. The in-app Apple flow supplies a fresh authorization code. Do not describe manual Auth deletion alone as Apple-token revocation.
5. Monitor the job and media cleanup until `complete: true`. Investigate failed jobs and processing leases. Reply that deletion completed only then. Handle requests to remove support correspondence separately.

The support mailbox and operator ownership-verification/response process must be operational before relying on email deletion requests for launch. This code does not automate or test mailbox delivery.

## Cleanup behavior and retention

Acceptance flags the account so server-authorized social reads/interactions reject it and emits a social invalidation. Previously displayed cached content is not remotely erased from other devices. Cleanup is asynchronous: the account worker runs every minute; media cleanup runs hourly. A large backlog or active worker lease can extend completion. No fixed completion SLA is implemented.

The worker removes authored posts, comments, ratings/reviews, profile, uploads, saves, likes, blocks, bookmarks, follows, and the Firebase Auth user. Rating/like/comment counters reconcile transactionally; saves and follows use existing idempotent reconciliation triggers. A ten-minute settling period precedes final profile removal. More than 25 orphan media records now remain in the scan until their cleanup completes, so later pages cannot be stranded.

The final `_socialAccounts` record contains only deletion/suspension flags, preventing still-valid pre-deletion ID tokens from reopening social access. The deletion job/completion marker and service security/accounting records remain private. Provider logs, backups, and support correspondence have separate retention configurations; this change does not invent or configure retention periods. Catalog entities and independent content by other listeners remain. Private signed media URLs expire after five minutes.

## Verification and remaining device checks

Isolated Auth, Firestore, and Storage emulator tests exercise the deletion workflow with password, Google, and Apple authentication claims, stale/malformed authentication, duplicate queue requests, full queued cleanup, more than 25 media records, source/processed/avatar deletion, and counter reconciliation. Replaying completed cleanup does not decrement counters again. These tests use disposable emulator identities and do not delete real accounts.

The emulator cannot perform a real Google/Apple credential exchange or verify Apple's revocation service. Before shipping, use disposable real-provider accounts on a physical iPhone to verify Apple sheet cancellation, wrong-Apple-ID rejection, token revocation, network failure after revocation, Google re-sign-in, and final Auth removal. Also verify Google's flow on Android. Never use the owner's production account for destructive tests.
