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
shown are **real underground acts with accurate producer credits** (billy woods /
Kenny Segal, MIKE / dj blackpower, Navy Blue, Wiki & MIKE / The Alchemist); the
save counts are illustrative sample data, not live figures.

## Before going live

- **Waitlist form** (`script.js`) is front-end only. Point it at a real endpoint
  (Formspree, a Cloud Function, Mailchimp, etc.).
- Add real **App Store / Play Store** links once the app is published.
- Add **Privacy / Terms** pages and link them in the footer if you need them.

## Deploy

Any static host works. Drop the `website/` folder onto Netlify, Vercel, GitHub
Pages, Cloudflare Pages, or Firebase Hosting.
