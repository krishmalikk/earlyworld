# earlyworld code-quality register and audit

Reviewed September 26, 2026 against Expo 57 / React Native 0.86.

Source: Malik Chohra, [Avoid AI Code Slop in React Native: 6 Patterns + the Fix](https://aimobilelauncher.com/blog/avoid-ai-code-slop-react-native-mobile), May 25, 2026. This document summarizes the relevant ideas and records earlyworld's implementation; it does not reproduce the article.

## Article checklist

The article recommends a short repository rulebook covering native streaming compatibility, layout-driven animations, design tokens, image loading, purchase identifiers, and synchronous storage reads. Its central suggestion is to make recurring conventions explicit before generating code. A rulebook complements review and testing; it cannot establish that every defect is gone.

## Findings and decisions

| Area          | Finding in earlyworld                                                             | Action                                                                                                                                                                  |
| ------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming     | No streaming feature or client stream reader                                      | No transport changes. Check the installed SDK if streaming is introduced.                                                                                               |
| Animations    | No measurement/effect animation chains                                            | No new animation layer. Keep the Studio arrangement's calculated geometry.                                                                                              |
| Design system | Brand colors were centralized; spacing and typography were scattered              | Added `shared/theme.ts` and adopted its values across screens and components.                                                                                           |
| Images        | Four separate core Image usages, duplicated shelf covers, no shared failure state | Added Expo Image and one `Artwork` component for covers/avatars, with cache policy, source recycling, and initials fallback. The bundled logo uses Expo Image directly. |
| Purchases     | No RevenueCat or entitlements                                                     | No billing code or dependency added.                                                                                                                                    |
| Local storage | No MMKV; Firestore native cache and React subscriptions already own server data   | Preserve the existing ownership model.                                                                                                                                  |

## Corrections to blanket advice

React Native's Image **does** have native caching controls. Expo Image was chosen here for explicit, consistent cache configuration and shared cover behavior, not because core Image is universally uncached. See [React Native image caching](https://reactnative.dev/docs/images#cache-control) and [Expo Image](https://docs.expo.dev/versions/latest/sdk/image/). No claimed speedup has been benchmarked on earlyworld.

Current Expo documentation supports streams and demonstrates `expo/fetch` with a stream reader. A blanket ban on `getReader()` would be inappropriate for this SDK; future streaming work must verify its actual transport and native behavior. See [Expo fetch and streams](https://docs.expo.dev/versions/latest/sdk/expo/#expofetch-api).

Memoization is not a general cure for synchronous storage: memo initializers still run during rendering. If persistent preferences are added, choose a documented reactive storage API or deliberate hydration flow, and measure startup behavior.

## Repository rules

- Use `shared/brand.ts` for brand colors and `shared/theme.ts` for spacing, typography, radii, and image defaults. Reuse `src/components/ui.tsx` primitives. The spacing scale preserves existing measurements; this cleanup is not a visual redesign.
- Prefer named StyleSheet entries for substantial static styles. Small style compositions may refer to tokens directly. Calculated dimensions, responsive percentages, press state, and the Studio arrangement are valid local values; avoid generating a separate abstraction for every number.
- Use `Artwork` for remote covers and avatars. Use Expo Image directly for special cases such as the bundled brand logo. Keep `contentFit`, accessibility, and source changes explicit.
- Keep server snapshots in their existing React providers/hooks. Preserve subscription cleanup and account boundaries. Do not add storage or Firestore listeners per track row.
- Use types to remove stale imports and invalid APIs. Validate untrusted data at boundaries; UI code must not hide mistakes with explicit `any`.
- Keep SoundCloud credentials server-side and preserve metadata-only behavior. This audit does not authorize audio downloads, playback, new cloud imports, or schema changes.
- Verify installed native dependencies with a development build. Types alone cannot establish native-module availability.

## Additional cleanup applied

Removed unused imports, including Firestore and Save remnants in `TrackRow`. Enabled unused-local and unused-parameter checking for the app, Functions, and scripts. Catalog scripts now have their own strict TypeScript check in the main check command.

Replaced the feed's nested per-track artist search with a memoized artist-ID set. Memoized onboarding catalog selection so typing a name or bio does not repeat a 10,000-track scan. Favorite search runs only while its picker is open and recalculates when its actual inputs change.

`npm run quality` parses TypeScript source to flag core Image imports (including aliases), literal static design values, and explicit UI `any`. It deliberately does not ban current Expo streaming APIs. These checks cover recurring source patterns, not every possible way to bypass a convention. The main `npm run check` includes them and their regression test.

## Validation and remaining limits

- App, script, and Functions type checks passed.
- UI quality checks and all 18 unit/catalog/lifecycle tests passed.
- iOS development build succeeded with Expo Image linked; installed and opened on iPhone 17 simulator. The bundled logo and sign-in layout were visually checked.
- The rebuilt simulator is at sign-in. Signed-in remote-image, favorites, and feed interaction checks still require a session. No cloud records, ratings, catalog metadata, or user profiles were changed by this cleanup.
- No claim of a completely defect-free or universally fast codebase is made. Physical-device image scrolling, accessibility, and cold-start performance still need measurement.
- Full catalog subscriptions still read the 10,000-track catalog on a cold cache. Virtualization bounds views, not database reads. Server pagination/search with saved/favorite reference hydration remains a separate architecture task; a silent query cap would break existing features.

Future audits should update this register with concrete findings and evidence, rather than enlarging a generic stop-list.

## September 30 catalog update

The historical full-catalog listener limitation above has been addressed with cursor pages, server search and reference hydration. The blanket test prohibition on one-shot reads now permits the shared bounded cursor pager: it fetches page IDs/documents and then delegates visible records to pooled subscriptions. Screens still cannot introduce ad hoc one-shot reads or put server snapshots in Zustand. See [catalog scaling](catalog-scaling.md) for remaining rollout, cache-retention and performance requirements.
