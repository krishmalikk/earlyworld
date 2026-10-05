# Share cards

Listeners share their taste as 9:16 story images. The share icon on your own profile opens the share screen (`app/share.tsx`). It has three tabs, and each one shows the exact card that will be exported.

| Card       | Shows                                                                                                                                                                               | Data                                                                                             |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Orbit**  | Your four favorite tracks orbiting a planet drawn from the logo. Below: each track's star rating and review, your scenes, saves, reviews, and the average rating of your favorites. | `favoriteTrackIds` on your profile, the catalog, and your own ratings from `useRatings()`        |
| **Recap**  | "You found it at N saves" for your earliest find this calendar month, falling back to last month. It also shows how many saves the track has now.                                   | Your own `users/{uid}/saves` since the start of last month, chosen by `pickRecap`                |
| **Review** | One of your reviews: the track as a moon, the stars, the review in large type, and when you saved it.                                                                               | A specific track (`?card=review&trackId=…`), otherwise your most recently updated written review |

Other ways in:

- **Share review** on your own review cards (`RatingCard`).
- **Share review** on a track page once your review is published.

Only published reviews can be shared; pending review text stays private. Other people's profiles and reviews have no share action.

## Output

- **Export:** each card is a fixed 360×640 layout (`shared/share-cards.ts`, `src/components/share/`), captured with `react-native-view-shot` as a 1080×1920 PNG.
- **Share:** opens the system share sheet (`expo-sharing`), which lists Instagram, Messages and other apps.
- **Save to Photos:** uses `expo-media-library` with write-only access.
- **Image loading:** capture waits until each card's artwork has loaded, up to four seconds. After that, missing art shows initials.
- **Analytics:** a `share_card` event records only the card type and the action.

## Design

Approved on the [design canvas](https://claude.ai/artifact/XCAgahXTFwy1dfcwMzycjb). All three cards share:

- the planet mark and wordmark in the header
- round "moon" artwork with orbit rings
- the website's sound-wave field
- Panchang for titles and DM Mono for labels

DM Mono is now bundled. `fontFamily.mono` also uses it, since iOS has no font called `monospace`.

## Native build

`react-native-view-shot`, `expo-sharing` and `expo-media-library` are native modules, so this feature needs a new development build. Older dev clients crash when opening the share screen.

## Verification — October 5, 2026

On the iPhone 17 simulator with a fresh development build:

- **Recap:** rendered from `@krish`'s live saves (BA$$ by che, found at 0 saves in September, now 3), using the last-month fallback.
- **Orbit and Review:** checked with `@bellsandbags` test data through a temporary development-only hook, which has since been removed.
- **Export:** all three cards saved to Photos as exactly 1080×1920 PNGs, matching the approved designs.
- **Fixed during testing:**
  - The export size: view-shot sizes are in points.
  - Saving: SDK 57 deprecates `saveToLibraryAsync` and it throws, so the app now uses `MediaLibrary.Asset.create`.
- **Orbit empty state:** shown for an account without favorites.

The share sheet itself (the "Share" button) needs a tap on the device, so it hasn't been exercised by automation yet.
