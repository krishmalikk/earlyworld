# earlyworld marketing website

A single-page marketing site for the **earlyworld** app, built with Vite, React,
TypeScript and Tailwind CSS v4, laid out for shadcn/ui (`components.json`,
`src/components/ui`, `src/lib/utils.ts`, `@/` → `src/`). It uses the app's real
brand palette (see [`../BRAND_COLORS.md`](../BRAND_COLORS.md)) and the official logo.

> This is the **marketing website** that showcases the app. It is **not** the app
> itself. earlyworld is a native iOS/Android app and is intentionally not a web app.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Vite entry: meta tags, font preload, React root |
| `src/App.tsx` | Page content and section order |
| `src/components/AlbumHero.tsx` | Opening hero: Panchang wordmark over the album corridor |
| `src/components/ui/image-stream-hero.tsx` | Reusable 3D image-corridor primitive (shadcn-style) |
| `src/components/WaveBand.tsx` | Dithered wave band under the hero |
| `src/components/ui/dithering-shader.tsx` | WebGL dither shader primitive (wraps `@paper-design/shaders-react`) |
| `src/components/PhoneDemo.tsx` | Animated phone feed demo |
| `src/components/Waves.tsx` | Flowing wave canvas behind the album corridor |
| `src/components/Waitlist.tsx` | Early-access email form |
| `src/data/albums.ts` | Album covers shown in the hero |
| `src/index.css` | Tailwind entry and brand tokens (`bg-background`, `text-accent`, `font-display`…) |
| `src/site.css` | Hand-written section styles, loaded in a cascade layer below Tailwind utilities |
| `public/albums/` | Self-hosted album covers (600px) |
| `public/fonts/Panchang-Variable.woff2` | Panchang display font (variable 200-800, self-hosted) |

Headings and the wordmark use **Panchang** (Fontshare); body copy stays on the system
sans. The font licence is included at `public/fonts/Panchang-License.txt`.

## Develop

```sh
cd website
npm install
npm run dev       # http://localhost:5173
npm run build     # typecheck + production build into website/dist
npm run preview   # serve the built site
```

New shadcn components can be added with `npx shadcn@latest add <name>`; they land in
`src/components/ui`.

## Page structure

Album corridor hero, the phone demo section, a short "what it is" statement, four plain feature blocks, how it works,
FAQ, and an early-access email capture. Deliberately plain: no gradient text, no
glow blobs, no fabricated stats or testimonials, one accent colour used sparingly.

## The album hero

The first screen is the earlyworld wordmark in Panchang over two mirrored rails of
album covers streaming toward the viewer (`ImageStreamHero`). The covers are real
underground rap releases (Nettspend, OsamaSon, 2hollis, xaviersobased, Che, Ken
Carson, Destroy Lonely, Yeat, Lucy Bedroque, prettifun, Kankan, jaydes), taken from
each release's Apple Music listing. To change them, drop a square image in
`public/albums/` and add it to `src/data/albums.ts`. The corridor is sized by its own
width, so on portrait screens it is rendered wider than the viewport to fill the
height. Under `prefers-reduced-motion` it freezes as a still.

## The phone demo

The phone below the hero runs a small looping demo (`PhoneDemo.tsx`): it focuses a track, saves
it so the count ticks up, pops a "rare" badge, and slides up a taste match. It
honours `prefers-reduced-motion` by falling back to a static state. The artists
shown are **real underground rap acts with accurate producer credits** (Nettspend
& Xaviersobased / Evilgiane, OsamaSon / Cranes, OsamaSon & Nettspend / Legion,
OsamaSon & Nettspend / OK); the save counts are illustrative sample data, not live
figures.

The hero also has an animated flowing wave background (`Waves.tsx`), a stacked set of gradient sine lines drifting over time, inspired by
a reference design and on-theme with earlyworld's waveform logo. It renders a
single static frame under `prefers-reduced-motion`.

## Before going live

- **Waitlist form** (`Waitlist.tsx`) is front-end only. Point it at a real endpoint
  (Formspree, a Cloud Function, Mailchimp, etc.).
- **Album covers** are copyrighted artwork used for promotion. Confirm you're comfortable
  using them (or swap in cleared art) before launch.
- Add real **App Store / Play Store** links once the app is published.
- Add **Privacy / Terms** pages and link them in the footer if you need them.

## Deploy

Any static host works. Run `npm run build` and deploy `website/dist` to Netlify,
Vercel, GitHub Pages, Cloudflare Pages, or Firebase Hosting (build command
`npm run build`, output directory `dist`, root `website`).
