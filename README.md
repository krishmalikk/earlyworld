# earlyworld

A native Expo + Firebase underground music discovery app. Rotation belongs to artists **and** producers; rare saves connect listeners. Dark, compact UI; SoundCloud, YouTube, and Bandcamp embeds only.

## Run it

Use Node 22 LTS (the deployed Functions runtime), npm, and an **Expo development build**. Expo Go and web are not supported because the app uses native Firebase persistence, Analytics, and Crashlytics.

```sh
npm ci
npm --prefix functions ci
cp .env.example .env
```

1. Create a Firebase project on Blaze. Enable Email/Password Auth, Firestore (Native mode), and Storage. Register iOS and Android apps; set their identifiers in `.env`.
2. Download `GoogleService-Info.plist` and `google-services.json` into this directory, or set their paths in `.env`. These files are ignored by Git. Put the real Firebase Hosting origin in `EXPO_PUBLIC_EMBED_ORIGIN` for YouTube's Referer.
3. Select your project and configure the server-only Genius token:

   ```sh
   npx firebase login
   npx firebase use --add
   npx firebase functions:secrets:set GENIUS_ACCESS_TOKEN
   npx firebase deploy --only firestore,storage,functions
   ```

4. Seed the verified catalog using Application Default Credentials or a service-account path outside the repository:

   ```sh
   GCLOUD_PROJECT=your-project-id npm run seed -- --production
   ```

   This creates missing records only and preserves existing save counts, credits, and user data. New track creation invokes Genius enrichment. No demo users, saves, follower counts, or Rotation tiers are fabricated.

5. Link an EAS project, put its ID in `.env`, and make a development build:

   ```sh
   npx eas-cli login
   npx eas-cli init
   npx eas-cli build --profile development --platform ios
   # Or --platform android; use --profile simulator for the iOS Simulator.
   npm start
   ```

   Supply native Firebase config files as EAS file environment variables (`GOOGLE_SERVICES_PLIST`, `GOOGLE_SERVICES_JSON`) for remote builds. Local builds also work via `npm run ios` / `npm run android` after the native configs are installed. `app.config.ts` deliberately does not invent Firebase credentials.

## Verify

```sh
npm run check          # app types, pure logic, catalog, actual React listener lifecycle, Functions compile
npm run test:rules     # Java 21+ required; starts a demo Firestore emulator
npm run test:backend   # actual handlers + Admin SDK against the demo emulator
npx expo export --platform ios --platform android --output-dir dist --no-bytecode
```

The rules test SDK is a dev-only test driver. App code imports only `@react-native-firebase`; there is no Firebase JS SDK in the application, no query library, and no remote data in Zustand.

For local full-stack work:

```sh
npx firebase emulators:start --project demo-earlyworld
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 GCLOUD_PROJECT=demo-earlyworld npm run seed
```

Set `EXPO_PUBLIC_FIREBASE_EMULATOR_HOST` to the machine's LAN address for a real device (or `127.0.0.1` for an iOS simulator). Native config must identify the same demo project. Do not use `localhost` from an Android emulator; use `10.0.2.2`. A local Genius token can go in `functions/.secret.local` (ignored). Functions run on port 5001; Firestore 8080; Auth 9099; Storage 9199.

## What is implemented

- Email/password auth and reset; six-step resumable onboarding; transactional lowercase username reservation; 512px avatar upload; scene selection; artist follows; five initial saves; direct initial matching.
- Live paginated feed of followed listeners' saves and followed artists'/producers' catalog releases, with scene-based cold-start fallback.
- In-memory catalog search across tracks, artists, producers, aliases, and scene tags. The three catalog listeners populate React context; native Firestore persists their data to disk.
- URL normalization and atomic deduplication; oEmbed preview; prominent producer credit; public release confirmation.
- Platform embeds, explicit interaction, unique naturally played seconds, 60% threshold, elapsed-time validation, and server-side one-hour deduplication. No audio is fetched or stored by the app/backend.
- Artist and producer profiles, full catalogs, tier badges, and collection-group leaderboards; matches with rare shared tracks; user profiles, saves, follows, and bio editing.
- Retry-safe save counters and permanent saver cap; capped engagement arrays and daily comments; multiplicative nightly Rotation; rarity-weighted matching every fifth save and nightly.
- Conservative, secret-backed Genius credits enrichment at creation; manual admin re-enrichment; user-entered producer takes precedence; no lyrics code.

## Deliberate schema additions

See [docs/architecture.md](docs/architecture.md) for backend details and tradeoffs. Tracks are added by any authenticated user **through `addTrack`**, rather than a direct client Firestore create. This makes deduplication and protected field initialization one trusted transaction. Raw track writes are denied.

`rotation` rows include `entityId` and `uid` for the requested leaderboard index. `following` rows include `targetId` / `targetType`, distinguishing artist follows from user follows. Server-only activity and bookkeeping collections reconcile unordered trigger delivery and support a bounded feed.

## Catalog provenance

[seed/catalog.json](seed/catalog.json) contains 200 public tracks from 40 artists and approximately 20 producers. Each entry includes the verified source URL and collection timestamp; explicit producer credits include a source URL. Counts start at zero in earlyworld, independently of platform popularity. Missing production credits remain null. Scene tags are editorial classifications.

The reproducible `npm run catalog:collect` collector reads public page metadata only, checks uploader ownership, and excludes tracks marked leaked, unreleased, snippet, or preview. It never requests audio, media transcodings, private APIs, API client IDs, or lyrics. Account handles can change; failures are recorded in `seed/collection-report.json`. Review changes before reseeding. "prod. me" on the artist's own upload is normalized to that artist's name.

## Deployment checks still needing your project/device

Native compilation, Firebase sign-in/Storage upload on a device, real SoundCloud/YouTube playback, and live Genius calls require your native config files, Firebase project, and Genius secret. JavaScript bundle export is not a substitute for an installed-device smoke test. A fresh production database has no taste matches until at least two real users share saves.

Bandcamp has no documented progress bridge equivalent to SoundCloud/YouTube. Its embed plays normally, but only saves and comments contribute engagement; no listen is invented. Third-party embed telemetry cannot cryptographically prove listening: server-owned scores, elapsed-time checks, and deduplication prevent direct score writes, not every possible modified-client attack. Enable Firebase App Check with device attestation before a public launch if stronger abuse resistance is required.

Nightly work is paginated and sequential for the MVP. Before a much larger user base, fan out scheduled computation to Cloud Tasks rather than letting a single invocation exceed its time limit. Arrays intentionally stop growing at the specified 300 tracks / 104 weeks. Configure TTL on `_rateLimits.expiresAt`, `_commentDays.expiresAt`, and `_playbackSessions.expiresAt`; keep retry/idempotency markers and permanent saver-cap state.
