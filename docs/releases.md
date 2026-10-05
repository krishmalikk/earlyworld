# Releases: albums, EPs, mixtapes, compilations, and singles

Release pages have high-resolution artwork, an artist link, release type/date when supplied, ordered tracks, and independent half-star ratings with optional 500-character reviews. Linked songs keep their existing ratings, saves, and Studio credits. Missing catalog songs link to their public SoundCloud page; importing a release does not silently create artists or duplicate songs.

Discover has a Releases filter. Artist profiles group their discography by release type. Listener profiles have a separate four-release favorites shelf and chronological release rating/review history. Release opinions do not change track opinions, song favorites, saves, matching, or Rotation. Profile rating/review totals include both types; their histories remain separate. Release activity cards in the main feed are not part of this implementation.

## Sources and identity

The importer reads SoundCloud's official public metadata API. It only visits existing earlyworld artists with previously verified SoundCloud user URNs. A release must be public, owned by that artist, and explicitly classified as album, EP, mixtape, compilation, or single by the provider. Ordinary or unclassified playlists are skipped, even when their title sounds like an album. LPs are presented as albums. Genius album-name strings alone cannot establish an ordered tracklist and are not converted into release records.

Each release uses the hash of its stable SoundCloud playlist URN as its ID. The ordered playlist tracks endpoint supplies the tracklist. Song references resolve through existing SoundCloud URN mappings, with canonical URL hashes as a fallback. No title-based merges occur. Import retries merge metadata while preserving ratings and timestamps; per-artist and catalog leases prevent overlapping jobs. A failed page leaves its checkpoint available for retry. A 401 refreshes OAuth once; 429 and other provider failures stop the page. Tokens remain server-side. API destinations are restricted before attaching credentials; redirects and media endpoints are disallowed.

To keep callable work bounded, each artist request checks up to five playlists. The catalog request visits up to five existing artists, with checkpoints between requests. Current import support accepts complete public tracklists of 1–200 tracks. Incomplete, private, or inaccessible tracklists are skipped and counted on the artist import status instead of publishing a partial album. Provider outages and rate limits still stop the page for retry. Provider publication dates are retained when supplied; playlist upload time is not invented as the release date.

## Storage and mutations

- `releases/{hash(playlistUrn)}`: release metadata, ordered track references, and rating aggregates.
- `releaseRatings/{hash(uid:releaseId)}`: one editable opinion per listener/release, with server timestamps.
- User fields: `favoriteReleaseIds`, `releaseRatingCount`, and `releaseReviewCount` are server-owned.
- `_releaseSync/{artistId}` and `_integrations/releaseCatalog`: private leases/checkpoints.
- `artists/{artistId}.releaseSync`: read-only artist import progress.

Authenticated callables: `setReleaseRating`, `deleteReleaseRating`, `setFavoriteReleases`, `syncArtistReleases`, and `syncReleaseCatalog`. Rating updates and deletes transactionally reconcile release and profile counts; identical submissions are no-ops. Rating and favorites logic is shared with the existing track APIs, with distinct collections, fields, and rate limits (60 rating mutations and 30 favorite changes per hour per account). Release sync calls are limited to 30 per hour per account. Firestore denies direct writes and permits release/opinion reads only when signed in.

The existing accessible rating editor and favorites editor serve both content types. Failed mutations retain drafts. Reads use account-scoped subscriptions and native cache; writes require the callable response. Analytics record publication, favorite changes, and failures without review text. The existing small-beta catalog subscription model is retained; server pagination/search remains a separate scaling task.

## Import operations

In Discover → Releases, “Find more releases” advances the existing-artist catalog. Each artist also has a Load releases/Load more releases action. Completed artists are not repeatedly scanned; a future scheduled refresh policy is a separate task.

For operators with authorized Application Default Credentials and SoundCloud credentials in `.env`:

```sh
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:sync:releases -- --production --pages=20
```

This command writes release metadata. It is resumable and stops on provider failures. It does not use stored Firebase CLI credentials outside their normal CLI flow. No recurring import schedule is enabled.

## Validation

`npm run check` checks app/script types, design conventions, the unit suite, and the Functions build. Emulator suites cover both existing track ratings and release ratings, ownership, half-stars, reviews, favorites, repeated/concurrent mutations, private server fields, complete ordered imports, metadata-only API access, identity reuse, and import checkpoints.

```sh
npm run test:releases
DEBUG= FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --import tsx --test --test-concurrency=1 tests/ratings.backend.test.mts tests/firestore.rules.test.mts
```

Source: [SoundCloud public API specification](https://github.com/soundcloud/api/blob/master/openapi/api.yaml).

## Live rollout — September 28, 2026

Deployed all release APIs, the shared track rating APIs, Firestore rules, and release review indexes to `earlyworld-6831c`. The first backfill produced **120 releases across 37 existing artists**: 104 albums, 13 EPs, and 3 singles. Ordered tracklists contain 1,479 references to existing earlyworld songs and 36 external-only songs. No new artist records, audio files, or fabricated ratings were created. Additional artist pages remain; “Find more releases” and artist-specific imports resume their checkpoints. Mixtape and compilation types are supported but were not present among the imported, explicitly classified releases in this initial audit.

Live verification caught and fixed provider-added tracking parameters in release links and inaccessible tracklists that reported a nonzero count but returned no songs. Regression tests cover both cases. The validated suites total 62 passing tests (22 unit, 8 existing track rating, 8 release rating, 8 import, 16 security-rule tests). App/script types, Functions build, UI quality checks, and the iOS production JavaScript export passed.

Visual release-screen QA remains pending: computer-use access to Simulator repeatedly failed with `cgWindowNotFound`, including after restarting its window. Do not treat the successful bundle export as a visual or physical-device check. The existing account and its ratings/favorites were not modified for verification.

Temporary Firebase Auth accounts were used solely for authenticated metadata import/audit and no listener profiles were created for them. One earlier verification session expired before its test-account cleanup could be confirmed. Subsequent checks reauthenticate before cleanup and were removed successfully. Cleanup of the remaining test account is pending its specific UID from the user; automatic approval review rejected exporting the entire Auth directory to locate it. No broad Auth export was performed.
