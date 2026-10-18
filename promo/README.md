# earlyworld promo video

A 24-second, 1080×1920 motion promo for TikTok, Reels and Shorts, built with [Remotion](https://www.remotion.dev) from real app screens.

```sh
npm install
npm run studio   # preview and scrub in the browser
npm run render   # writes out/earlyworld-promo.mp4
```

Rendering uses the installed Google Chrome; Remotion's bundled headless Chrome crashed on this Mac.

## Structure (30 fps)

| Beat | Frames | On screen |
| --- | --- | --- |
| Hook | 66 | "Heard it before it blew up?" |
| Problem | 76 | "The algorithm plays everyone the same songs." → "We don't." |
| Brand | 78 | Logo, earlyworld, "Rate, save and share the underground." |
| Features | 5 × 84 | Rate, Discover, Match, For you, Diary, each with its real screen in a phone |
| Share | 96 | Orbit and Recap cards |
| End card | 100 | Logo, "Be early.", "Coming soon · iOS & Android" |

Scenes overlap by 12-frame slides or fades. Text stays inside the area TikTok, Reels and Shorts leave uncovered (about 90px at the sides, 200px top, 360px bottom).

## Notes

- **Silent by design:** the audio track is silent (`--enforce-audio-track`) so platforms accept it; add a sound from the platform's library when posting. Don't add track audio without the artist's permission.
- **Screens:** `public/screens/` are simulator captures from `main` (October 17, 2026) with the Expo dev button hidden and the status bar set to 9:41. Recapture after UI changes.
- **App Store:** an App Store preview needs a separate 886×1920 cut with no phone frames and only real app footage.
- **Fonts:** Panchang (Fontshare, ITF Free Font License, see `public/fonts/LICENSE.txt`) and DM Mono.
- **License:** Remotion is free for individuals and companies of up to 3 people.
