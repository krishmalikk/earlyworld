# earlyworld — marketing website

A static, single-page marketing site for the **earlyworld** app. Pure HTML/CSS/JS,
no build step and no dependencies. It uses the app's real brand palette
(see [`../BRAND_COLORS.md`](../BRAND_COLORS.md)) and the official logo.

> This is the **marketing website** that showcases the app — it is **not** the app
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

Follows a standard high-converting app-landing layout: hero → trust strip →
problem/why → benefit-led feature rows → how it works → who it's for →
testimonials → FAQ → final call-to-action → footer.

## Before going live

- **Waitlist form** (`script.js`) is front-end only. Point it at a real endpoint
  (Formspree, a Cloud Function, Mailchimp, etc.).
- **Testimonials** are illustrative placeholders — swap in real quotes.
- **Legal links** (Privacy, Terms) in the footer are placeholders.
- Add real **App Store / Play Store** badges once the app is published.

## Deploy

Any static host works — drop the `website/` folder onto Netlify, Vercel, GitHub
Pages, Cloudflare Pages, or Firebase Hosting.
