import { DitheringShader } from "@/components/ui/dithering-shader";

// Dithered wave band between the album hero and the phone section, in the
// brand navy and lavender. Edges fade into the page background.
export function WaveBand() {
  return (
    <section className="relative flex h-[300px] items-center justify-center overflow-hidden bg-background sm:h-[420px]">
      <DitheringShader
        shape="wave"
        type="8x8"
        colorBack="#050710"
        colorFront="#4b5394"
        pxSize={3}
        speed={0.6}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,var(--color-background),transparent_25%,transparent_75%,var(--color-background))]"
      />
      <p className="relative z-10 px-6 text-center font-display text-[clamp(2rem,7vw,5rem)] leading-none font-bold tracking-[-0.03em] text-foreground [text-shadow:0_2px_24px_rgba(5,7,16,0.9)]">
        Train your ears.
      </p>
    </section>
  );
}
