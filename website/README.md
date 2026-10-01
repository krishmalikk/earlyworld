# earlyworld marketing website

A static, single-page marketing site for the **earlyworld** app. Pure HTML/CSS/JS,
no build step and no dependencies. It uses the app's real brand palette
(see [`../BRAND_COLORS.md`](../BRAND_COLORS.md)) and the official logo.

> This is the **marketing website** that showcases the app. It is **not** the app
> itself. earlyworld is a native iOS/Android app and is intentionally not a web app.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | All page content and structure |
| `styles.css` | Brand-matched styling, responsive layout, animations |
| `script.js` | Nav, scroll-reveal, mobile menu, waitlist form handling |
| `assets/earlyworld-logo.png` | App logo (copied from `assets/brand/`) |

## Preview locally

Just open the file:

```sh
open website/index.html
```

Or serve it (recommended, so relative paths behave like production):

```sh
cd website && python3 -m http.server 8080
# then visit http://localhost:8080
```

## Page structure

Hero, a short "what it is" statement, four plain feature blocks, how it works,
FAQ, and an early-access email capture. Deliberately plain: no gradient text, no
glow blobs, no fabricated stats or testimonials, one accent colour used sparingly,
system fonts.

## The phone demo

The hero phone runs a small looping demo (`script.js`): it focuses a track, saves
it so the count ticks up, pops a "rare" badge, and slides up a taste match. It
honours `prefers-reduced-motion` by falling back to a static state. The artists
shown are **real underground rap acts with accurate producer credits** (Nettspend
& Xaviersobased / Evilgiane, OsamaSon / Cranes, OsamaSon & Nettspend / Legion,
OsamaSon & Nettspend / OK); the save counts are illustrative sample data, not live
figures.

The hero also has an animated flowing wave background (`#waves` canvas in
`script.js`), a stacked set of gradient sine lines drifting over time, inspired by
a reference design and on-theme with earlyworld's waveform logo. It renders a
single static frame under `prefers-reduced-motion`.

## Before going live

- **Waitlist form** (`script.js`) is front-end only. Point it at a real endpoint
  (Formspree, a Cloud Function, Mailchimp, etc.).
- Add real **App Store / Play Store** links once the app is published.
- Add **Privacy / Terms** pages and link them in the footer if you need them.

## Deploy

Any static host works. Drop the `website/` folder onto Netlify, Vercel, GitHub
Pages, Cloudflare Pages, or Firebase Hosting.
