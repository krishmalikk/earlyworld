# September 2026 interface refresh

The supplied mockups guide the composition: prominent artwork, layered navy cards,
clear listener identity, and useful track detail. The existing navy/lavender palette,
bottom navigation, and Studio arrangement remain in place.

## Applied

- Feed: compact artwork shelf, activity/ratings filters, rounded track and review cards,
  inset song previews, producer credits, source, saves, and ratings.
- Discover: large horizontal artwork cards, scene filters, producer spotlights based
  on catalog track counts, and the existing searchable catalog and add-track flow.
- Profiles: centered identity card, scene tags, real account counts, four favorite
  slots, horizontal highest-rated shelf, review cards, saves, and Rotation.
- Track pages: large artwork, release year, genre, duration and album when supplied,
  community rating, original source link, and a prominent rating editor.
- Shared controls: rounded fields and buttons, pill filters, round avatars, and
  clearer section headings using shared design tokens.

No fictional activity, likes, badges, playlists, BPM values, external platform links,
or placeholder ratings were added. Unrated tracks and empty profiles retain honest
empty states. Favorite and rating mutation behavior is unchanged.

## Verification

`npm run check` passes: app/script types, UI quality checks, 19 tests, and Functions
build. The new feed regression covers older ratings remaining reachable when newer
release entries precede them in the combined feed.

The feed, discovery, track detail and profile layouts were inspected in the iPhone
17 simulator with the existing signed-in account. The favorites editor opens and
cancels without changing data. No production ratings, saves, favorites, or profiles
were created or modified for these checks.

The development simulator intermittently stalled during input verification; a runtime
sample showed JavaScript execution in Hermes garbage collection. The root cause is
not established. An optimized JavaScript preview (`--no-dev --minify`) successfully
completed search, track navigation, and rating-editor checks (5 stars to 4½, then
cancel without publishing). This is a preview configuration, not a fix for the
development-runtime stall or a native release-build performance certification.

The working simulator preview uses Metro on port 8082. The normal development
server on 8081 remains available. To start the optimized preview again:

```sh
DEBUG= NODE_OPTIONS=--dns-result-order=ipv4first npx expo start --dev-client --localhost --no-dev --minify --port 8082
```

Physical-device testing and populated multi-listener review/favorite layouts remain
to be checked before a beta release.

## Artwork clarity

The stored SoundCloud `-large` cover URLs were serving 100×100 thumbnails, which blurred when enlarged. The shared Artwork component now requests bounded CDN variants based on its rendered width and device pixel density: 500×500 for smaller covers and 1080×1080 for larger covers. Fill-sized covers wait for layout before choosing a source. Failed larger variants fall back to 500px and then the stored URL; failed originals retain the initials placeholder. URL-based caching and native image downscaling remain enabled, consistent with [Expo Image documentation](https://docs.expo.dev/versions/latest/sdk/image/).

Only recognized public SoundCloud artwork/avatar URLs are transformed. Other providers, signed URLs, and original assets are left unchanged. No catalog migration or backend deployment is needed; existing and new catalog artwork use the same renderer.

Verified a catalog image returned 100×100, 500×500, and 1080×1080 assets. Visually checked the Discover shelf and the “2 Friends” track page in the iPhone 17 simulator; both display sharper images. All 22 unit tests and the app/script/Functions type checks passed. Original low-resolution uploads can still look soft; this change cannot recreate missing image detail.

## November 2: native tab bar

The tab bar is now Expo Router's `NativeTabs` (`app/(tabs)/_layout.tsx`), which uses the system `UITabBarController`. On iOS 26 the system draws it with Liquid Glass and derives the background from the content behind it; `backgroundColor`, `blurEffect` and `shadowColor` only apply on iOS 18 and earlier, and Android gets the Material bottom bar with the same lavender tint. Icons are SF Symbols on iOS and Material Symbols on Android, since native bars cannot render Ionicons.

Native tabs draw no header, so each tab is now a directory with its own `Stack` (`(feed)`, `discover`, `create`, `matches`, `profile`) using `tabStackOptions` in `src/navigation/tab-stack.tsx`. Routes such as `/(tabs)/discover` are unchanged. Native stack headers do not accept `letterSpacing`, and on iOS 26 they centre the title. Content scrolls under the bar: iOS insets the first scroll view automatically and Android wraps screens in a bottom safe area, so `Page` keeps omitting the bottom edge inside tabs.

Verified in the iPhone 17 simulator on iOS 26.5 with the existing development client; no native rebuild was needed because `react-native-screens` already ships the tab host. Not verified: Android, iOS 18 fallback styling, and `minimizeBehavior="onScrollDown"`, which did not visibly minimise during a simulated scroll on Matches and is documented as unsupported for `FlatList` screens.
