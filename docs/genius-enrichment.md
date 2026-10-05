# Genius catalog enrichment

`npm run catalog:enrich:genius -- --production --apply` enriches existing deferred tracks. Set `GCLOUD_PROJECT` and admin Application Default Credentials; the tool reads `GENIUS_ACCESS_TOKEN` or the existing `CLIENT_ACCESS_TOKEN` from the ignored `.env`. Omitting `--apply` reports the deferred count without modifying the catalog.

The batch reuses the app's Genius matching and transactional credit writer. Artist/title similarity thresholds and ambiguity checks remain in force; returned song details must match the selected search result. Existing credits and editorial producer attribution are preserved. IDs, SoundCloud data, saves, reviews, ratings, and favorites are not rewritten. Producer records/counts are updated transactionally only when adding missing producer attribution.

Four workers share a 250 ms minimum interval between API requests. A private Firestore lease prevents overlapping batch runs, with a 30-second heartbeat and two-minute expiry. The tool stops on HTTP errors, timeouts, or invalid song details instead of treating them as unmatched. Already completed tracks are checkpointed by their status, so rerunning processes only remaining deferred tracks. This also means previously unmatched tracks are not retried automatically. No audio or lyrics are downloaded.

Run `npm run test:genius` against a local Firestore emulator at port 8080; it uses only the isolated `demo-earlyworld-genius-tests` namespace. Tests cover concurrent/idempotent writes, producer accounting, social-field preservation, provider failure, missing/ambiguous matches, concurrent title changes, inconsistent song details, existing credits, and admin authorization.

This operator tool runs locally against Firestore and does not require a Functions deployment. Normal app-triggered enrichment remains unchanged until any separately reviewed deployment.

## Live run — September 26, 2026

Processed 6,286 of the 9,800 deferred tracks before Genius returned HTTP 429. One later availability check also returned 429, without a `Retry-After` header; processing is paused rather than continuously retrying.

- Added 3,086 matches; total matched tracks: **3,196**.
- Total unmatched tracks: **3,290**, including the original 90.
- Remaining deferred tracks: **3,514**.
- Among matched tracks: 3,004 have producer credits, 3,100 writer credits, 2,240 other contributor credits, 2,750 album names, and 3,171 release dates.
- Catalog remains 10,000 tracks / 93 artists. Producer catalog expanded to 1,046 records.
- Audits found no missing producers, producer-count mismatches, incomplete matched records, duplicate SoundCloud identities, missing artists, or artist-count mismatches.

The initial run encountered an unclassified request failure after 4,958 tracks. After a successful connection check, resuming correctly skipped completed tracks. Diagnostics now expose only safe error categories, failed track IDs, HTTP codes, and parsed retry times.

Once Genius accepts requests again, resume at a slower rate with `npm run catalog:enrich:genius -- --production --apply --interval-ms=500`. The interval defaults to 250 ms and accepts 250–60,000 ms. HTTP 429 still stops the run; if supplied, the provider's retry time is logged. This tool does not schedule automatic retries or bypass provider limits.

Validation: the full `npm run check` and six isolated Genius backend tests passed. No Functions deployment was performed; enrichment was applied directly through the authorized admin tool.
