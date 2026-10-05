# Catalog scaling toward 50,000 tracks

Updated September 30, 2026. This is metadata only: no audio files, players, stream URLs, or lyrics.

## Capacity and source decisions

The September 26 import checkpoint records 10,000 imported catalog tracks, 93 reviewed artists, and 13,321 eligible uploads collected from those accounts. A read-only production aggregate query on September 30 confirmed **10,000 tracks, 93 artists, and 1,046 producers**. The 13,321 eligible-upload estimate remains historical, not a fresh provider collection. At the observed average of 143 eligible uploads per artist, 50,000 tracks would need about 350 artists. Plan for 400–500 reviewed original artist accounts to accommodate unavailable uploads and duplicates. Raising the per-artist cap to 1,000 is not a substitute for breadth.

Run `npm run catalog:capacity` for a local, read-only roster/checkpoint estimate. It does not fetch provider data or claim stale checkpoints are current. The report separates the mathematical cap (93 × 250 = 23,250) from observed eligible uploads (13,321).

Add reviewed, original uploader identities to `seed/soundcloud-artists.json`, with stable SoundCloud user URNs, canonical profiles, editorial names, and scene tags. Verify the identity against the artist's official links. Search hits, repost accounts, fan archives, and similar names are candidates, not verified artists. Keep the existing eligibility checks and cross-roster first-100 import pass. Imports deduplicate stable URNs and retain community IDs and totals.

Producers grow through matched Genius production credits, including co-producers. A title saying “prod.” or an uploader name does not establish a verified Genius production credit. The existing conservative title/primary-artist checks and ambiguity rejection remain. Every credited producer gets an idempotent association; the editorial primary producer is preserved. Historical matched tracks require a deliberate reconciliation before co-producer counts can describe the entire old catalog.

## Provider permission comes first for expansion

`provider-retention.json` records the outstanding agreement scope. Its pending fields must not be interpreted as unlimited retention. Record permitted fields, attribution, server/device/artwork/search retention, artist-profile use, and removal deadlines from each provider's actual agreement. The bulk SoundCloud importer and Genius queue resume command check this record before live expansion; editing the file does not itself grant permission.

The SoundCloud terms apply to metadata as well as audio and include artist-page and caching restrictions. No audio playback does not resolve those questions. [SoundCloud API terms](https://developers.soundcloud.com/docs/api/terms-of-use). Confirm the applicable Genius agreement separately.

No new artist identities were invented and no 50,000-track import was run during this change. Do not increase the live target until the storage/use scope and removal workflow are resolved.

## Implemented retrieval

- The catalog provider no longer subscribes to complete tracks, artists, producers, or releases collections.
- Native browsing uses 25-document pages with Firestore document-ID cursors. Producer spotlight uses track count plus document ID. A stable ID ordering deliberately avoids reorder churn from title/metadata edits.
- Artist discographies, release shelves, Discover, and favorite selection expose pagination. Onboarding selected-artist queries merge groups of at most 30 IDs with a common cursor, so artists beyond the first group remain reachable.
- Saves, favorites, rating cards, release tracklists, and feed activity request their specific IDs through one account-scoped cache. References are deduplicated and subscribed in groups of 30. Account replacement remounts the cache, detaches subscriptions, and rejects late callbacks.
- Page requests serialize, debounce search, cancel by account/query generation, preserve visible IDs on failed refresh, and retry from the same cursor. Loaded records remain live subscriptions backed by native Firestore's offline document cache.
- Search and scene/producer filtering run on the server over `_catalogSearch`, including records never loaded on the device. It supports case/accent-insensitive substrings across titles, artist/producer names, aliases, release types, and scenes. It is not fuzzy or typo-tolerant search.
- Search returns at most 25 IDs, examines at most 250 candidates per request, and returns a continuation even if a filtered candidate page has zero matches. This bounds server work without silently truncating the search. Common substrings or combined filters can require multiple requests; benchmark this before replacing it with a dedicated search service.
- Existing followed-user activity streams retain their 25-row increments, followed artist releases, and scene fallback. Matching/Rotation computation, Studio, and bottom navigation are unchanged.

Fetching a native page and attaching its reference subscription can bill an initial read twice. Multiple mounted screens can also retain their active pages. These costs are bounded by requested content rather than total catalog size; no measured latency or read-cost improvement is claimed yet. See [Firestore cursor pagination](https://firebase.google.com/docs/firestore/query-data/query-cursors).

## Index rollout and consistency

Deploy Firestore indexes and the four entity index triggers before enabling the new client. `buildCatalogSearch` builds at most 1,000 existing documents per minute behind a Firestore lease and persistent per-collection cursor. It marks `_catalogControl/search.ready` only after completing all four collections. Search reports “being prepared” until then instead of returning an incomplete catalog.

The write triggers re-read authoritative records inside a transaction, so duplicate or out-of-order delivery cannot reintroduce a stale title. Only changed search projections are written. Removed records delete their index entry; unavailable sources are excluded from search. Artist scene changes queue bounded reindexing of their tracks and releases. Such changes are eventually consistent while the reindex job runs.

An authorized operator can also backfill/rebuild explicitly:

```sh
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:index -- --production
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:index -- --production --rebuild
```

Use normal authorized Application Default Credentials. Never repurpose the Firebase CLI's saved refresh token. Do not run the operator migration concurrently with the scheduled initial build.

## Provider records and freshness

New SoundCloud imports/refreshes write a private `_providerMetadata/{trackId}/sources/soundcloud` record in the same transaction as the public track projection. Genius matches similarly write a separate provider record. These contain provenance, last successful fetch, last attempt, and provider metadata, not ratings, saves, reviews, or counters. Existing track IDs stay fixed. The current `tracks` fields remain a compatibility projection for rules and older clients; this is an additive transition, not a completed removal of all provider fields from track documents.

Explicit server-owned `editorial` title/artwork/duration overrides survive SoundCloud refresh. Existing artist and primary producer corrections remain intact. Upload publication dates and Genius release dates remain separate. Refreshes preserve earlyworld creation/feed order.

Confirmed 404/410 responses mark a source unavailable and update provider status. A 403 now stops the refresh for investigation instead of treating a potentially app-wide authorization failure as removal. Rate limits and outages do not erase tracks or community records. Automatic expiry, rights-removal purges, local image/document cache invalidation, historical provider snapshot migration, and recurring SoundCloud refresh are **not enabled**: their required behavior depends on the outstanding retention agreement. `expiresAt: null` is an unset policy, not approval for permanent storage.

## Durable Genius queue

`_catalogJobs/{trackId}` deduplicates by track ID and title/artist signature. Opens, saves, and ratings promote jobs; new-track enqueueing and the worker's bounded catalog sweep supply background work. The queue survives restarts and uses a shared provider lease, sequential requests with one-second spacing, five jobs per minute, a persisted seed cursor, and six attempts maximum. Expired processing leases can resume. `Retry-After` pauses the entire worker; other failures use bounded exponential backoff. Authentication failures disable the worker for operator review.

States distinguish matched, unmatched, ambiguous, pending/processing, skipped, and dead. Failures leave source tracks retryable and never erase established credits. Diagnostics contain fixed error codes and IDs, never tokens, raw provider bodies, or review text. Provider counters update transactionally using the existing producer associations.

The worker is disabled unless `_catalogControl/genius.enabled` is true. Enable only after the provider scope/removal prerequisites are met:

```sh
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:jobs
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:jobs -- --production --resume
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:jobs -- --production --pause
```

The initial deployment leaves the old immediate `enrichFromGenius` trigger in place to preserve current add-track behavior. Switch that trigger to the queued implementation only when the queue is authorized/enabled. The old bulk Genius script remains an operator fallback and must not run concurrently with the queue; its limiter is separate. Producer-profile on-demand sync also has its existing independent rate limits.

## Expansion rollout

1. Resolve the provider scope, implement its exact cache/removal requirements, and verify authorized operator access.
2. Finish indexing the existing catalog and check search beyond the first page, favorites, scene onboarding, artist pages, account switching, and offline/error states on the simulator and a physical iPhone.
3. Review artists in batches of 25–50 toward a 400–500-account roster. Refresh the capacity estimate after each collection pass; deduplication and the provider's actual available catalog determine the final count.
4. Preview each approved import; apply in stages (15k → 25k → 35k → 50k), keeping the 250-per-artist cap initially. Retain existing SoundCloud identity mapping and the target-total stop condition.
5. Run `catalog:audit` at each stage. Check duplicate URNs, missing artists, artist counters, provider failures, and stable IDs/social counters. Track reviewed versus pending identities separately.
6. Enable the Genius queue conservatively. Prioritize actual user interest and grow verified producer coverage over time; don't promise complete credits for every underground upload.
7. Measure cold-start catalog reads, search latency/candidate reads, requests/provider/day, oldest pending/dead jobs, and real-device scroll performance before increasing throughput.

## Verification

See the final execution notes in `catalog-data-approach.md`. Unit/lifecycle coverage includes substring candidates, deduplication, pagination retries, account switching and late responses. Isolated backend tests cover bounded continuation, migration, unavailable records, permission boundaries, concurrent enrichment, co-producer counts, ambiguity, Retry-After, exhausted leases, and existing rating accounting. Source permissions, physical-device QA, and live scale/performance validation remain separate requirements.

Deployment: Firestore indexes, search/index-maintenance functions, request/save/rating queue handlers, the disabled queue worker, and normal add/refresh provider snapshots are deployed to `earlyworld-6831c`. Current native checks retain the navy/lavender cards, producer spotlight and Studio. No new native dependencies were added. A stylized Unicode title exposed a production-only index issue: n-grams now split by Unicode code point, with a regression test preventing malformed UTF-16 fragments.

The initial production search index completed and its readiness gate cleared. Simulator verification found `14 HAHAHA LOL` by che with the CXO credit outside the first loaded page. The signed-in user's six saved tracks still hydrated correctly; opening a saved track retained its Studio and rating controls. Loading the next artist-discography page succeeded. No user opinions or social actions were published during verification.
