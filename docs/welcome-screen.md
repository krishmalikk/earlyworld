# Animated welcome screen

New signed-out launches open an animated introduction before authentication. **Get started** opens Create account; **Sign in** opens the existing sign-in form. Firebase restores the session first: completed accounts keep the existing Matches destination, unfinished accounts resume onboarding, and signed-in deep links stay intact. The native splash remains the short loading screen before React is ready.

`WelcomeScreen` uses the existing midnight/navy/lavender theme. Three fine circular paths surround the earlyworld wordmark. Eight circular SoundCloud artist profile pictures move at different speeds and directions, remaining upright. The shared `Artwork` component selects Retina image sizes and handles failed images with initials. `welcome-artwork.ts` holds a small curated set of public avatar URLs verified against the reviewed SoundCloud artist roster; there is no pre-login Firestore listener, provider API request, or bundled full catalog. Remote images still require network access on a first install; the layout and entry buttons work without them.

Reanimated 4.5.1 and Worklets were already installed and linked in iOS. Each orbit uses a shared progress value and UI-thread transforms, rather than JS timers or per-frame React state. Animations stop on blur, backgrounding, unmount, and Reduce Motion. Reduce Motion changes are observed while the screen is open. Decorative images are hidden from VoiceOver; the wordmark, copy, and buttons remain accessible. The page scrolls on small screens and with large text.

Implementation: `src/components/WelcomeScreen.tsx`, `src/components/WelcomeOrbit.tsx`, `app/index.tsx`, and the startup guard in `shared/startup.ts`. No native dependencies, backend changes, or catalog imports were added.

References: [Reanimated withRepeat](https://docs.swmansion.com/react-native-reanimated/docs/animations/withRepeat/), [withTiming](https://docs.swmansion.com/react-native-reanimated/docs/animations/withTiming/), and [Reduce Motion](https://docs.swmansion.com/react-native-reanimated/docs/device/useReducedMotion/). The latter hook reads the startup preference, so a React Native accessibility subscription also handles subsequent changes.

## Verification

`npm run check` passed, including 30 tests, app/script type checks, UI quality checks, and the Functions build. Startup regression tests cover signed-out entry, returning sessions, incomplete onboarding, and signed-in deep links. An iPhone 17 simulator preview verified the complete layout, remote photos/covers, and moving upright artwork. The preview temporarily rendered the component inside a full-screen Discover route to preserve the existing signed-in session; that override was removed. Returning-user startup was also verified. Physical-device performance, VoiceOver navigation, and changing the system Reduce Motion setting still need device QA.

## October 4 typography update

The orbit has no manual pause control. System Reduce Motion and automatic pausing on background/blur remain. All wordmarks use bundled Panchang Bold; track/release detail titles use Panchang Medium, and the “Create account” / “Sign in” headings use Panchang Medium. Authentication fields, buttons, and supporting copy use the standard UI font. Font assets and their supplied license are in `assets/fonts/panchang`. Screen branding is text only; the native launch screen uses the navy background without a logo image. The OS launcher icon remains configured separately.

The Expo 57 splash plugin leaves stale storyboard constraints when its image is omitted. A 1×1 transparent PNG provides a blank native drawable while preserving the navy background. It contains no logo. The existing Expo Font module loads the bundled static OTF weights before navigation renders; no new native dependency was introduced.

Validation: `npm run check` passed (32 tests plus app/script/Functions type checks and UI quality checks). The welcome, Create account, and Sign in screens were visually checked with Panchang in the iPhone 17 simulator. An arm64 iOS development build succeeded with the blank native splash. Track/release title styles were checked by types; signed-in detail screens were not visually rechecked during this change.

## October 4 artist profile pictures

The orbit uses SoundCloud profile pictures for **Summrs, 1oneam, Autumn!, OsamaSon, xaviersobased, Yung Lean, che, and Black Kray**. All eight were refreshed from the public SoundCloud user API using reviewed account URNs; their source profile links are retained in `welcome-artwork.ts`. Every image is circular, and the shared artwork component requests appropriately sized CDN images for the display density. Song covers are no longer included. These are curated URLs refreshed during development, not an automatic launch-time profile sync.

Validation for the avatar update: all eight 500px CDN image URLs returned HTTP 200 with JPEG content, and `npm run check` passed all 32 tests, type checks, UI quality checks, and the Functions build. The simulator became unresponsive in the developer reload panel, so the updated orbit has not yet been visually verified on-device.
