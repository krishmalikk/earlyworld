# Live Firebase — September 26, 2026

## Configuration

- Project: `earlyworld-6831c`.
- Firestore: `(default)`, Native mode, `nam5`.
- Functions: Node.js 22, second generation, `us-central1`.
- Storage: `earlyworld-6831c.firebasestorage.app`, `US-EAST1`.
- Authentication: email/password enabled.
- Registered iOS bundle: `com.krrishess.earlyworld`.
- Genius: `GENIUS_ACCESS_TOKEN` is stored in Secret Manager and bound to enrichment Functions.

The ignored local `.env` uses the registered iOS bundle, and `.env.local` has an empty `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST`. The generated native iOS plist points to this live project. Rebuild native apps after changing their Firebase plist or bundle ID; restart Metro after changing public environment values.

Embedded playback has been removed. `EXPO_PUBLIC_EMBED_ORIGIN` is no longer needed, and track source links open outside the app.

Simulator-only accounts, saves, and ratings remain in the local emulators. They are not copied into the live project. Create a fresh account in the live app, or sign in with an existing cloud account.

## Deployment

```sh
npx firebase deploy --project earlyworld-6831c --only firestore,storage,functions
```

The initial deployment included 16 Functions and both rule sets. Playback removal retires `beginPlayback` and `recordEngagement`, leaving 14 Functions at that point. The SoundCloud metadata integration adds `adminSyncSoundCloud` for a current total of 15. All nine composite indexes are `READY`. First deployment required a retry after Google's Eventarc permissions and Functions artifact repository finished provisioning. The CLI configured automatic cleanup of old build images in the Functions artifact repository.

The catalog seed is non-destructive: it inserts missing tracks and preserves existing saves, credits, and counters. Run it only with authorized Application Default Credentials, after the Genius creation trigger is deployed:

```sh
GCLOUD_PROJECT=earlyworld-6831c npm run seed -- --production
```

## Verification

- Seeded all 200 catalog tracks and 40 artists into live Firestore. Genius enrichment finished with 110 matched tracks, 90 unmatched, and zero pending; unmatched tracks keep credits empty. The catalog now has 91 producer records, including producers discovered from Genius. Backfilled 52 unclaimed entries after the new trigger's startup; completed credits were preserved.
- Live email/password sign-up and client profile creation passed. An authenticated temporary account exercised rating creation, identical-submit no-op, score editing, review removal, deletion, repeated deletion, and favorite reordering. Direct client rating writes and unauthenticated rating reads were denied; authenticated reads succeeded. Removed the temporary test account, profile, rating, and rate-limit records afterward.
- `npm run check` passed: app TypeScript, 11 unit/catalog/lifecycle tests, and Functions compilation.
- Rebuilt and installed `com.krrishess.earlyworld` on the iPhone 17 simulator, verified the embedded live Firebase configuration, and visually confirmed the sign-in screen. Metro runs on IPv4 localhost with the emulator override disabled.
- Full simulator interaction checks and the 28 emulator backend/rules tests are recorded in [ratings.md](ratings.md). They preceded the cloud switch; the live iOS account flow awaits the owner's new account.

## Playback removal

- Removed players from track pages and onboarding, the playback tracker, playback state, and the app's `react-native-webview` dependency. Source links open outside earlyworld.
- Removed listen callables and stopped generating or requiring Bandcamp embed URLs. Existing documents need no migration.
- Saves and comments remain the engagement sources. Existing history is retained; Rotation's formula, matching, ratings, and Studio credits are unchanged.
- Updated onboarding/profile guidance and setup documentation. Removed the unused embed-origin environment setting.
- App TypeScript, 10 remaining unit/catalog/lifecycle tests, Functions compilation, and 15 backend emulator tests pass. The obsolete playback tests were removed; Rotation coverage now exercises save activity.
- Deployed the updated save/comment and metadata Functions and deleted both playback endpoints. The iOS simulator rebuild succeeded and reopened at sign-in; signed-in track/onboarding visual checks await an account.

## SoundCloud metadata

SoundCloud credentials are configured in Secret Manager. `previewTrack` and `addTrack` use the official metadata API, and `adminSyncSoundCloud` supports protected, paginated refreshes of existing tracks. The integration has no playback and no recurring import schedule. See [soundcloud.md](soundcloud.md) for commands, token handling, identity preservation, and validation.

## Catalog expansion — September 26, 2026

The live SoundCloud catalog now contains **10,000 tracks, 93 artists, and 91 producers**: 9,800 new tracks and 53 new artists. The reviewed roster yielded 13,321 eligible public uploads before applying the target. The original 200-track fixture remains unchanged for local tests.

The post-import audit found 10,000 unique SoundCloud identities and mappings, no missing artist references, and no artist track-count mismatches. All original track IDs and fingerprinted editorial/social fields (including Genius credits, ratings, and saves) were preserved. Existing Genius coverage is 110 matched and 90 unmatched; the 9,800 bulk imports are explicitly deferred for later enrichment.

App/Functions checks, importer TypeScript checks, 17 unit tests, and 36 emulator tests passed. Discover and artist discographies now use virtualized lists, while full catalog subscriptions remain for beta search/offline behavior. No new Function deployment or native rebuild is required by this expansion. The simulator remains on the owner's unfinished onboarding; no profile choices were submitted during verification.

## Remaining device validation

The full checklist is in [device-checklist.md](device-checklist.md). A physical iPhone is still required for VoiceOver gestures, real keyboard behavior, offline failures/recovery, and external source-link checks before inviting beta testers. Public-launch moderation, reporting, blocking, and account deletion remain a separate milestone.
