# Posts and short videos

Implementation started October 1, 2026. Catalog metadata remains separate from uploaded media. No SoundCloud/Genius audio or video is downloaded or played.

## Current rollout status

The social/compatibility Functions, Storage-finalization trigger, Firestore indexes, Firestore rules, Storage rules and Hosting pages are deployed to `earlyworld-6831c`. [Community information and support](https://earlyworld-6831c.web.app/community.html) and `/post/{id}` share landing pages return HTTP 200. An unauthenticated social-status request returns 401 / UNAUTHENTICATED.

The private `earlyworld-media` Cloud Run service is deployed in `us-central1`, and the processing scheduler is connected to it. Only the Functions runtime service account has permission to invoke the worker. The Storage-finalization trigger runs in `us-east1`, matching the existing bucket. The deployment script configures Storage event publishing and the Firebase Storage service agent's Firestore-rules access; noninteractive Firebase CLI deployment does not automatically grant the latter.

Google Cloud and Application Default Credentials now use the authorized `krish.malik@gmail.com` account. Moderator access has been assigned to that existing earlyworld account, preserving existing claims. Sign out and back into the app to refresh the claim. Operator configuration is initialized with support contact `earlyworldofficial@gmail.com`.

A USD 100 monthly project budget is configured with actual-spend alerts at $50, $80 and $100. Billing administrator `krish.malik@gmail.com` is a default recipient. The budget covers the project, including non-media Firebase costs, and is **not a spending cap**. Budget ID: `aef6f2d4-4227-493b-a4ba-9e4f38bdfdcd`. TTL is active for `_socialQuotas.expiresAt` and `_rateLimits.expiresAt`.

Public creation, publication and playback remain disabled. Live media validation passed using disposable accounts and synthetic fixtures. Uploads were temporarily enabled and restored to disabled afterward. No test posts were published; test accounts and objects were removed. Public-launch prerequisites below remain outstanding.

## Experience

Five tabs: Feed, Discover, Create, Matches, Profile. `/add` redirects to Create. The old public catalog-creation callable now requires an admin claim; catalog jobs remain available to operators.

Create offers posts (1,000 characters, four photos, one catalog attachment) and existing videos (5–60 seconds, 150 MB). Scene tags are optional, limited to three. Selected files are copied to an account-specific local draft directory. Uploads show progress, allow cancellation/retry, and do not promise background completion after termination. Device drafts expire after seven inactive days. Approved posts cannot replace their media.

The Feed retains its catalog radar, releases, saves, and listener ratings. Approved posts are a separate activity identity. Filters: All activity, Posts, Ratings & reviews. Videos has Explore/Following and scenes, chronological publication order, vertical paging, one active player and at most the next player prepared. Clips preserve framing, loop, start muted, and pause when the screen loses focus, the app backgrounds, or comments open. Sound choice lasts for the account session. Likes, private bookmarks, comments and share links are independent of track saves/ratings.

Profiles link to Posts, Videos, Bookmarked posts, and private submissions after favorites. Pending/rejected text submissions are visible to their author. Written reviews, discussions, profile bios and photos now pass through moderation; numerical ratings still update immediately. The app retains the currently approved version during review of an edit.

## Private/public boundary

- `_postDrafts`: author-owned proposed content and revision state; private to callable APIs.
- `posts`: approved content only; client Firestore access is denied. Server-authorized reads check both directions of blocking, suspension and deletion.
- `_socialMedia`: private upload tickets, paths, validation status, leases and Transcoder job references.
- `_mediaJobs`, `_socialCleanup`: processing and eventual deletion work.
- `_postComments`: approved and pending single-level comments. Only approved comments or the requester's own pending/rejected comments appear in API responses.
- `_textSubmissions`, `_moderation`, `_socialReports`: private review queues and decisions; moderation uses an admin custom claim. Reports record reporter and subject separately.
- `_socialAccounts`: private eligibility band, policy acceptance, suspension and deletion state.
- `users/{uid}/postBookmarks`: private, independent of Saved Tracks.
- `_socialBlocks` plus owner-scoped markers: mutual visibility restrictions and follow prevention.
- `_accountDeletion`: resumable cleanup that reconciles rating, comment and like counts, removes follows/saves through their existing accounting triggers, and waits for media cleanup before deleting the authentication account.

Deterministic IDs and transactions prevent duplicate submissions/interactions. Draft saves compare normalized content; identical resubmissions preserve version and quota usage. Approval preserves first publication time. Deletion hides the post immediately, then removes files and subordinate records. A user can still request account deletion while suspended, with a recent sign-in.

Cross-account profile, review, discussion, activity and leaderboard reads also use `readCommunity`; direct access is restricted to prevent alternate routes bypassing blocking. Tiny account/global invalidation documents drive React data hooks. Account changes discard prior account state. Cached responses remain visible after network failures; authorization failures clear protected content. Media URLs expire after five minutes and need an online authorized refresh.

## Media service

`services/media-worker` is a private Cloud Run service invoked by the Functions scheduler with an identity token. It validates actual bytes and dimensions, uses Sharp to normalize photos and strip metadata, and ffprobe to inspect video duration, orientation and audio presence. Google Transcoder produces H.264 MP4 at 720/480 sizing with AAC only when an audio stream exists. ffmpeg generates the preview thumbnail. Processing never trusts the picker metadata as validation.

Sources upload resumably to `social-staging/{uid}/{postId}/{mediaId}`. Rules require an exact, unexpired owner ticket, exact byte count/MIME type and the global upload switch. Firebase rejects client changes to its reserved download-token field but generates a token during upload. The finalization trigger and completion API revoke that token before queueing processing. A transient bearer-link window exists between upload completion and revocation; staging originals are never returned through post APIs. Processed objects and original uploads have no client read permission; callable responses sign authorized processed objects for five minutes. The `playback` switch controls signing video URLs; thumbnails can remain readable. Already issued URLs remain usable until expiry.

Successful original uploads are deleted. Abandoned/rejected drafts enter cleanup after seven days. Cleanup waits for worker leases and active Transcoder jobs and removes media, comments, bookmarks and public post records. A durable dispatch marker prevents a timed-out job-creation RPC from creating a duplicate billed job. An ambiguous dispatch is reconciled against Transcoder jobs; it fails closed rather than automatically sending a second creation request.

Limits: 10 submissions/account/day, three video tickets/account/day, 40 photo tickets/account/day, and 1,200 source-video seconds/project/day. Canceled video tickets count toward the daily upload quota. These limit abuse and processing, not all bandwidth charges. Worker requests retry up to six times with backoff. A conclusively failed Transcoder job with a transient provider error gets one new job with optimization disabled, following [Google’s troubleshooting guidance](https://docs.cloud.google.com/transcoder/docs/troubleshooting#internal-error); that retry reserves processing allowance again. Other terminal failures stop immediately. Unknown dispatch outcomes stay in reconciliation and never trigger a second job automatically. Operational events omit content, eligibility and private media URLs.

References: [Transcoder jobs and filtering](https://docs.cloud.google.com/transcoder/docs/how-to/jobs), [video configuration](https://docs.cloud.google.com/transcoder/docs/transcode-video), [signed URLs](https://docs.cloud.google.com/storage/docs/access-control/signed-urls), [Expo Video](https://docs.expo.dev/versions/latest/sdk/video/).

## Deployment

Do not enable public creation as part of deployment. The default for creation, publication, upload and playback switches is false. Admins can prepare internal submissions while public creation remains disabled. Upload and publication switches still need to be explicitly enabled for internal media testing.

1. Authenticate a project-authorized Google Cloud account, and set Application Default Credentials for operator scripts. Use `earlyworld-6831c` explicitly; never rely on an unrelated default project.
2. Deploy the callable Functions and new Firestore indexes before the client. Coordinate the tightened rules with distribution of the new client: older builds used direct community queries.
3. Build/deploy the private media worker with `bash infra/social/deploy-worker.sh PROJECT BUCKET FUNCTIONS_RUNTIME_SERVICE_ACCOUNT`. The script configures least-purpose service identities, one worker instance/concurrency, no public invoker and private bucket permissions. Verify the Transcoder service agent can read/write this bucket.
4. Put the resulting worker URL in the Functions runtime environment as `SOCIAL_MEDIA_WORKER_URL`; redeploy `processPostMedia`. Do not put it in an `EXPO_PUBLIC_` variable.
5. Run `npm run social:admin -- init earlyworld-6831c` with authorized ADC. This initializes disabled switches and the public support email `earlyworldofficial@gmail.com` without resetting existing flags.
6. The user approved moderator access for the existing account `krish.malik@gmail.com`. Assign via `npm run social:admin -- moderator earlyworld-6831c krish.malik@gmail.com`, preserving existing claims. Reauthenticate the app to refresh claims. Do not create a replacement account if no matching account exists.
7. Deploy Hosting for the private-content share landing page and public community information. The HTTPS landing page opens `earlyworld://post/{id}`; no post content is embedded publicly. Universal/App Links with platform signing fingerprints can be added after distribution identities are finalized.
8. Use `infra/social/budget.json` with the actual project number to create a USD 100 Cloud Billing budget with 50%, 80%, 100% actual-spend alerts. This template covers the project, including other Firebase costs. Confirm recipients in Cloud Billing. Alerts and estimated usage gates are **not billing caps**.
9. Rebuild native development/release apps for Expo Video; JS refresh alone cannot install the native module.

## Public-launch gates

The support contact is earlyworldofficial@gmail.com. Do not enable public creation until designated moderators, coverage and escalation, rights-complaint response, existing public-content review, age/privacy review, and real-device testing are recorded. Set `launchReady` and `legacyReviewComplete` only after completing that work. The feature-switch script refuses public creation without these attestations.

Review existing profile names/bios/avatars, track discussions and written reviews. The initial policy pages are implementation copy requiring the planned US teen privacy and content review; an age gate is not a compliance guarantee. See [Apple UGC requirements](https://developer.apple.com/app-store/review/guidelines/#user-generated-content).

Operational process: moderators review the complete video (including audio), all photos and text before approving; reject with an actionable reason. Check reports daily during beta, prioritize threats/exploitation/private information, suspend accounts when appropriate, record the resolution, and route rights complaints to the support inbox. No automated legal determination or guaranteed response SLA is implied.

## Validation record

- `npm run check` passed: app/script/Functions types, UI quality and 32 unit tests.
- 54 isolated Firestore backend/rules tests passed, including existing rating aggregate regressions, moderation privacy, stable revisions, duplicate requests, report subject identity, blocking across legacy routes, account-deletion counters, more than 30 followed authors, and bookmarks of older posts. The full 54-case suite passed again after the upload changes. When using `firebase emulators:exec`, unset its injected `FIREBASE_CONFIG` for these tests so their explicit per-suite demo project IDs match their database cleanup calls; otherwise test state leaks between cases.
- Both Storage emulator tests passed: exact authorized uploads, owner isolation, immutable originals, private originals/processed media, and rejection of unknown tickets and public avatar writes. The live provider, rather than the emulator, enforces the reserved metadata-field restriction; server finalization revokes provider-generated tokens. `npm run test:social:storage` starts isolated Firestore/Storage emulators on ports 8085/9195; Java 21+ must be on PATH.
- Three media configuration/retry tests passed for 5/60-second boundaries, silent clips, rotation, aspect ratio, and bounded retries of terminal transient failures.
- iOS native build succeeded with Expo Video, installed and launched in iPhone 17 simulator. The Create screen and new navigation render. Live callable/media validation is recorded below separately from native UI validation.
- Live production integration passed: authenticated resumable uploads, Storage finalization, normalized photo output, silent H.264 video, rotated H.264/AAC video, rejection of a two-second clip, unpublished-post privacy, original deletion, denial of direct processed-file access, and signed MP4 byte-range responses (206). Both video variants were inspected with ffprobe: correct orientation, six-second duration, and audio only on the input that had audio. Low-resolution inputs are not upscaled. The first silent Transcoder job returned provider `InternalError`; the fresh full run passed. The bounded retry branch has unit coverage but was not exercised by the successful rerun.
- Physical iPhone/Android playback, screen-reader, large-text, interrupted upload, weak network and repeated swipe/memory testing remain rollout checks. The simulator automation reported that no window was available for the final live-backend UI pass; the earlier native build/Create-screen check remains the last visual validation.
- Worker dependency audit reports two moderate transitive advisories (`gaxios`/`uuid`); no critical/high advisories remain in that worker audit. Resolve or review these before public launch; do not force a breaking dependency override without validation.

No public launch, legal signoff, physical-device result, or guaranteed $100 cap is implied by these checks.
