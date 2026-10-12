import { ImageStreamHero, type CorridorPath } from "@/components/ui/image-stream-hero";
import { Waves } from "@/components/Waves";
import { ALBUMS } from "@/data/albums";

// Album covers are square, so the cards are too.
const SQUARE: CorridorPath = { cardWidth: 20, cardHeight: 20, cardRadius: 0.6 };

export function AlbumHero() {
  return (
    <section className="relative h-[calc(100svh-64px)] min-h-[500px] w-full overflow-hidden bg-background">
      <Waves className="waves--hero" />

      {/* The corridor scales with its own width, so on portrait screens it is
          made wider than the viewport (and centred) to fill the height. */}
      <ImageStreamHero
        images={ALBUMS}
        cards={12}
        speed={22}
        axis={52}
        path={SQUARE}
        className="absolute inset-y-0 left-1/2 w-[max(100%,175svh)] -translate-x-1/2"
      />

      {/* Fade the corridor out behind the wordmark and the copy. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-gradient-to-b from-background via-background/70 to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-background via-background/80 to-transparent"
      />

      <div className="relative z-10 flex h-full flex-col items-center justify-between px-6 pt-10 pb-12 text-center sm:pt-14 sm:pb-16">
        <h1 className="font-display text-[clamp(2.4rem,11vw,8.5rem)] leading-none font-bold tracking-[-0.04em] text-foreground">
          earlyworld
        </h1>

        <div className="flex max-w-xl flex-col items-center gap-6">
          <p className="text-balance text-lg text-muted-foreground sm:text-xl">
            Find records before everyone else, credit the producers who made them, and meet
            listeners who share your taste.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href="#access" className="btn font-display text-sm tracking-[-0.01em]">
              Get early access
            </a>
            <a
              href="#what"
              className="rounded-lg border border-border px-6 py-3 font-display text-sm font-semibold tracking-[-0.01em] text-foreground no-underline transition-colors hover:border-accent hover:text-accent"
            >
              What it is
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
