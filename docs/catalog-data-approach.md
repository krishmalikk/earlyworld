# Catalog data: recommended approach

Date: September 27, 2026  
Status: Execution underway September 30, 2026. Paged retrieval, shared reference hydration, full-catalog substring search, index migration, and a durable enrichment queue are implemented. Live bulk expansion and retention-dependent removal/refresh remain pending provider scope. See [implementation and rollout](catalog-scaling.md).

## Direction

Keep Firebase and the backend. Improve how earlyworld retrieves, retains, refreshes, and serves music metadata instead of replacing the existing stack.

Earlyworld is a discovery and community app. SoundCloud supplies track metadata, Genius supplies matched credits, and earlyworld owns its users' ratings, reviews, saves, and favorites. No audio downloads or playback are needed.

## Current limitations

- The app subscribes to the entire tracks, artists, and producers collections. Virtualized lists reduce rendered views, but do not reduce the catalog documents fetched.
- Search and several screens depend on that complete in-memory catalog.
- Provider metadata and earlyworld community aggregates share track documents.
- The bulk Genius enrichment tool is resumable, but runs locally and stops on provider errors. It does not schedule retries.
- Stored metadata is not automatically current when a provider changes or removes a release.
- Permanent retention of API-derived metadata has not been established as permitted for this use case.

See [current architecture](architecture.md), [SoundCloud integration](soundcloud.md), and [Genius enrichment](genius-enrichment.md) for implementation details and recorded run results.

## 1. Confirm provider storage permissions

Not downloading audio does not automatically make permanent metadata storage acceptable. SoundCloud's terms define User Content broadly, including text, images, and other data, and restrict persistent caching. Obtain clarification for earlyworld's specific catalog, artist pages, artwork caching, and intended commercial use. Check Genius's applicable terms separately; approval from one provider does not cover the other.

Record which fields may be retained, for how long, with what attribution, and what must happen after removal or revoked access. If permanent storage is not permitted, use permitted session access or another appropriately licensed source. A refresh schedule alone does not establish permission to store data.

These decisions must cover server storage, Firestore's device cache, image caches, and any search index—not just the primary database.

Reference: [SoundCloud API terms](https://developers.soundcloud.com/docs/api/terms-of-use).

## 2. Replace full-catalog subscriptions

- Load feed and discovery results in bounded pages, initially 25 items, using stable ordering and Firestore cursors.
- Fetch artist discographies by artist ID with pagination.
- Hydrate the specific track IDs needed for saves, favorites, ratings, and feed activity through a shared cache and batched reads.
- Keep listeners focused on visible activity and account-specific state. Detach them on account changes and other appropriate lifecycle boundaries.
- Move catalog search and filtering to a server query or suitable search index. Search must still cover the complete catalog, including tracks not loaded on the device.

Do not simply cap the current global subscription: that would silently hide older tracks and break reference lookups. Select the search implementation after checking required matching behavior, cost, and provider retention permissions.

References: [Firestore pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors) and [listener billing](https://firebase.google.com/docs/firestore/pricing).

## 3. Separate community records from provider metadata

Keep stable earlyworld track IDs so ratings, reviews, saves, favorites, and discussions survive metadata refreshes and provider URL changes.

Separate provider-specific fields from earlyworld-owned data. Retain provider identifiers and mappings only as permitted, and record provenance for imported fields. SoundCloud upload timestamps must remain distinct from original release dates; provider popularity must remain distinct from earlyworld saves and ratings.

Provider refreshes must not overwrite community data or silently replace editorial corrections. Removing restricted provider content should leave an appropriate unavailable-track state for community records, subject to applicable deletion requirements.

## 4. Run enrichment through a controlled background queue

- Prioritize tracks people open, save, rate, or follow; process the remaining catalog at a lower background priority.
- Deduplicate jobs and make writes idempotent so retries cannot double-count producers or create duplicate records.
- Bound worker concurrency and share provider request limits across workers.
- Honor `Retry-After` when supplied. Otherwise use conservative, bounded backoff; stop automatic retries after repeated failures and expose the reason to operators.
- Distinguish a confident match, no match, an ambiguous result, and a temporary provider failure. An outage must not mark a track permanently unmatched.
- Keep the existing artist/title checks and avoid overwriting established credits with uncertain matches.

The queue should survive process restarts without depending on a developer's laptop. Store job progress and safe diagnostics without logging tokens, review text, or raw provider responses.

## 5. Make freshness explicit

For permitted provider data, record its source, last successful fetch, last attempted refresh, and any expiry requirement. Refresh frequently viewed records as needed and less-used records less often, within provider rules and quotas.

Differentiate temporary outages from confirmed removal or loss of access. Reflect provider restrictions promptly, including in local caches and search results. Use stale data during an outage only where retention rules permit it.

## Implementation order

1. Establish provider permissions and document field-level retention decisions.
2. Replace full-catalog loading with pagination, complete-catalog search, and reference hydration.
3. Separate provider metadata from community records through an additive migration that preserves IDs.
4. Move enrichment into a durable queue with rate-limit handling and bounded retries.
5. Add refresh/removal handling, then measure reads, startup time, search latency, and queue failures.

## Acceptance checks

- A cold app session no longer fetches all 10,000 tracks.
- Search finds tracks beyond the first loaded page; pagination has no missing or duplicate results under the chosen ordering.
- Existing saves, favorites, ratings, matching, Rotation, and Studio credits continue to work.
- Account switching clears account-specific state and subscriptions.
- Concurrent/retried enrichment preserves credits and producer counts; provider failures remain retryable.
- Provider removal and expiry rules apply consistently to the database, device caches, and search index.
- Existing track IDs and community records survive the migration.

This is an incremental architecture improvement, not a proposal to rebuild the app or replace Firebase.

## September 30 implementation notes

The app no longer opens global catalog listeners. Browsing uses 25-item cursor pages; references use pooled subscriptions; search has a resumable server index over the full catalog. Provider snapshots are now separate on new imports/refreshes, while old track fields remain a compatibility projection. Genius queue work is persistent, deduplicated and bounded, distinguishes ambiguity from outages, and accounts for co-producers.

The historical roster yielded 13,321 eligible uploads across 93 reviewed artists; at that yield, roughly 350 artists would reach 50k. Target 400–500 reviewed accounts to allow for duplicates/removals. `npm run catalog:capacity` reproduces the estimate without API calls. No new bulk import has been run.

Provider permissions are recorded as pending in [provider-retention.json](provider-retention.json). Scheduled provider refresh, legal-removal/expiry behavior across server/device/artwork caches, and a larger live import must wait for that scope. This is not a completed claim of provider-policy compliance. Detailed code behavior, commands, migration/deployment scope, and remaining limitations are in [catalog-scaling.md](catalog-scaling.md).

Verification on September 30: `npm run check` passes (27 unit/lifecycle tests plus app/scripts/Functions type and UI-quality checks); 45 isolated catalog/Genius/SoundCloud/security tests and eight existing rating accounting tests pass, for **80 tests** total. The final iOS production bundle exports successfully. Simulator checks confirm the 25-track initial page, producer spotlight, saved-track hydration, preserved Studio/rating controls, and loading the next artist-discography page. Physical-iPhone, offline cache expiry and 50k-scale latency/read-cost measurements remain pending.

Production index completion was verified in the simulator: searching `14 HAHAHA LOL` returned the matching che track and CXO credit even though it was outside the initial 25 loaded tracks. The index readiness gate has cleared. No listener ratings, saves, favorites, follows, or reviews were changed during these UI checks.
