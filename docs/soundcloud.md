# SoundCloud metadata integration

SoundCloud is a server-side metadata source. The app has no player, audio download, stream lookup, or SoundCloud user-account connection. Firebase email/password authentication is unchanged.

## Credentials and tokens

Local tools read `SOUNDCLOUD_CLIENT_ID` and `SOUNDCLOUD_CLIENT_SECRET` from the ignored `.env`. Deployed `previewTrack`, `addTrack`, and `adminSyncSoundCloud` bind those names from Firebase Secret Manager. Emulator credentials live in ignored `functions/.secret.local`. Never use an `EXPO_PUBLIC_` prefix for these values.

The client-credentials grant accesses public metadata. Access/refresh tokens are stored only in `_integrations/soundcloudOAuth`, which is denied to all Firestore clients. A transaction lease serializes refreshes across function instances. Tokens are reused until near expiry; a rejected token triggers one refresh. HTTP redirects are restricted to SoundCloud's API track-metadata endpoint. Error messages and sync reports exclude credentials and raw responses.

## Existing-catalog refresh

The first sync refreshes existing SoundCloud tracks only. It does not discover or import additional releases. It updates title, artwork, duration, canonical source link, and a small `soundcloud` metadata object. Publication time is stored inside that object; the original earlyworld `createdAt` remains unchanged, so refreshing does not promote old releases in the feed.

Artist avatars/profile links are refreshed only when the stored SoundCloud identity or profile URL matches the uploader. Editorial names, aliases, scene tags, catalog counts, artist/producer IDs, Genius credits, saves, ratings, reviews, favorites, and Rotation data are not rewritten.

Track document IDs remain stable. `_soundcloudTracks/{hash(urn)}` maps each SoundCloud track URN to its existing earlyworld ID. Adding a known track through a renamed source URL returns the original ID. Identity collisions are reported for manual reconciliation, not merged automatically.

Unavailable/private releases are marked `sourceStatus: unavailable`; ratings and discussion remain. The track page explains that the original release is unavailable and hides its outbound source link. Existing descriptive metadata is retained for review; this is not a rights-removal workflow. Rate limits, authentication failures, and outages stop the run without marking affected tracks unavailable. Repeating a run is safe.

## Run a sync

Use Node 22 or newer and authorized Application Default Credentials. The explicit project and production flag prevent accidental live writes. The preview may refresh the private OAuth token cache, but does not modify catalog records.

```sh
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:sync:soundcloud -- --production
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:sync:soundcloud -- --production --apply
```

Alternatively, `adminSyncSoundCloud({ afterId?, apply?: boolean })` requires an authenticated Firebase `admin` claim. It processes 25 tracks and returns counts plus `nextCursor`; continue until the cursor is null. No automatic recurring schedule is enabled.

`previewTrack` and `addTrack` now use SoundCloud's official API for SoundCloud URLs. YouTube/Bandcamp metadata behavior is unchanged. The old page-based starter collector is not used by this integration.

## Validation

- Live refresh completed September 26, 2026: 200 existing tracks and 40 artists linked, 200 stable track identity mappings, zero unavailable tracks, zero conflicts, and no new catalog entries. Before/after fingerprints confirmed all original IDs and checked editorial/social fields (including credits, saves, and rating totals) were preserved.
- Deployed API checks passed for authenticated metadata lookup, existing-track deduplication, rejection of non-admin bulk sync, and denied client access to the OAuth cache. The temporary verification account was removed.
- App/Functions type checks, 14 unit/catalog/lifecycle tests, and 33 emulator backend/security tests pass.
- Unit coverage: public-only metadata selection, canonical URLs, stable URNs, token-rejection retry, redirect confinement, rate-limit errors, and exclusion of media URLs/platform engagement statistics.
- Emulator coverage: preservation of social fields and editorial identity, verified uploader updates, identity collisions, renamed-link deduplication, concurrent token refresh, dry runs, unavailable/recovered releases, outage preservation, and admin-only sync.
- Security rules coverage: OAuth cache and identity mappings are unreadable/unwritable by signed-in and signed-out clients.

References: [SoundCloud API guide](https://developers.soundcloud.com/docs/api/guide) and [official OpenAPI specification](https://github.com/soundcloud/api/blob/master/openapi/api.yaml). API credentials establish technical access; permission for the app's intended data use remains a separate question discussed with SoundCloud.

## Expand the catalog

Live import verified September 26, 2026: **10,000 tracks, 93 artists, 91 producers**. Added 9,800 tracks and 53 artists. All original IDs/social fields were preserved; duplicate identities, missing artists, and artist-count mismatches were all zero.

`seed/soundcloud-artists.json` is the reviewed roster of stable SoundCloud user URNs, editorial names, scene tags, and original earlyworld IDs where applicable. Searches only help review candidate identities; search results, reposts, likes, and archive accounts are not automatically imported as artist releases. Add reviewed accounts here to expand the roster.

With admin Application Default Credentials and the server credentials in `.env`:

```sh
# Collect and validate metadata; does not create catalog tracks.
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:import:soundcloud -- --production --target=10000
# Apply the reviewed roster, stopping at the requested total catalog size.
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:import:soundcloud -- --production --apply --target=10000
# Read-only counts, duplicate identities, orphan checks, and artist count audit.
GCLOUD_PROJECT=earlyworld-6831c npm run catalog:audit
```

The importer uses official `/users/{urn}/tracks` pages (200 per request), validates pagination URLs before sending OAuth, and stages sanitized metadata in ignored `.soundcloud-import/` checkpoints. Checkpoints expire after 24 hours. Reruns deduplicate by stable track URN and canonical URL. A private lease prevents overlapping import runs; each page transaction creates identities, tracks, and artist count increments together. Existing tracks are left untouched. No fabricated ratings, saves, producer credits, or popularity metrics are added.

Only public uploads from the reviewed uploader are eligible. Tracks must have a past publication date and run 30–900 seconds; titles marked leaked, unreleased, snippet, preview, type beat, full album, or full mixtape are excluded. These metadata checks are not a guarantee of rights ownership. Each account contributes at most 250 eligible uploads by default (`--per-artist=250`, maximum 1000). The first 100 per artist are imported across the roster before deeper pages, so prolific accounts do not consume the entire target. The target is a stopping total, not an instruction to remove existing tracks. Simultaneous user additions can increase the live total independently.

429s and other provider failures stop the run; resume later instead of circumventing limits. No audio endpoints are called. New tracks keep their original publication date in `createdAt`, so historical imports are not presented as new releases. Bulk entries use `geniusStatus: deferred`; the existing admin-only `adminEnrichTrack` can enrich selected tracks later. The ordinary add-track flow still requests Genius enrichment. Existing Studio credits remain intact.

Discover and artist discographies use virtualized lists. Search now covers the full catalog through a server index, and favorites use paged selection plus shared ID hydration. The September 30 client replaces the full catalog subscriptions with cursor pages and reference hydration. Server-side search and paginated retrieval with reference hydration remain a scaling milestone beyond this beta, rather than silently hiding older tracks behind a client query limit.

Validation for expansion: 17 unit/catalog/lifecycle tests and 36 emulator backend/security tests pass, including concurrent imports, repeated pages, capacity limits, identity conflicts, social-field preservation, and OAuth redirect confinement. Simulator account onboarding is preserved; full signed-in Discover interaction and physical-device performance remain to be checked after onboarding.
