# earlyworld brand colors

The app uses the supplied [earlyworld logo](assets/brand/earlyworld-logo.png) unchanged. Its near-black navy background and silver-to-periwinkle highlights define the interface palette.

The logo contains gradients and texture, so these are representative pixels sampled from the original 1024 × 1024 PNG, rather than a claim that it contains only eight colors. Sample coordinates are measured from the top-left corner.

## Colors sampled from the logo

| Color    | HEX       | RGB           | Sample (x, y) | Role                                                |
| -------- | --------- | ------------- | ------------- | --------------------------------------------------- |
| Midnight | `#050710` | 5, 7, 16      | 30, 30        | Main background; launch screen                      |
| Navy     | `#0C1425` | 12, 20, 37    | 512, 120      | Cards, inputs, navigation surfaces                  |
| Silver   | `#FAFAFC` | 250, 250, 252 | 300, 440      | Primary text; platinum details                      |
| Ice      | `#CED8FC` | 206, 216, 252 | 740, 440      | Multiplatinum details                               |
| Lavender | `#A9B3FC` | 169, 179, 252 | 855, 383      | Primary buttons, active tabs, links                 |
| Lilac    | `#DDD9FD` | 221, 217, 253 | 512, 295      | Highlights; diamond details                         |
| Steel    | `#7283B2` | 114, 131, 178 | 512, 750      | Supporting brand color from the emblem's lower edge |
| Mist     | `#9EABD3` | 158, 171, 211 | 350, 720      | Secondary text and metadata                         |

## Supporting interface colors

These colors complement the logo; they are not direct pixel samples.

| Token / role                         | HEX                   |
| ------------------------------------ | --------------------- |
| Borders and dividers                 | `#2B3652`             |
| Artwork placeholder background       | `#18223A`             |
| Selected chips                       | `#202A48`             |
| Error text                           | `#F6988F`             |
| Gold certification background / text | `#2D2630` / `#DECAA0` |
| Platinum certification background    | `#172033`             |
| Diamond certification background     | `#29253F`             |

Gold keeps a warm tint so certification levels remain visually distinct. Errors use a separate coral tone and a written message.

## Usage

- Use Midnight for the page canvas and Navy for elevated surfaces.
- Use Silver for primary text and Mist for supporting text.
- Use Lavender for primary actions, with Midnight text on filled buttons.
- Preserve the logo's original gradients; do not tint or stretch the image.
- Keep album artwork in its original colors.

At full opacity, Silver on Midnight has a 19.29:1 contrast ratio, Mist on Navy has 8.07:1, and Midnight on Lavender has 10.09:1. These cover primary text, secondary text on panels, and filled button labels; disabled states intentionally use reduced opacity.

The shared source of truth is [shared/brand.ts](shared/brand.ts). React Native components use these tokens. [app.config.ts](app.config.ts) also declares the Midnight background for Expo, whose config runs outside Metro.

The logo appears on the sign-in, onboarding, loading, and tab navigation screens. Expo uses the same PNG for the app icon and launch screen. Native icon and launch screen changes require a native rebuild to appear on an installed app.
