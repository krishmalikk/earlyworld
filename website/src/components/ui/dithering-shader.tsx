import * as React from "react";
import { Dithering, type DitheringProps } from "@paper-design/shaders-react";
import { cn } from "@/lib/utils";

export type DitheringShaderProps = {
  shape?: DitheringProps["shape"];
  type?: DitheringProps["type"];
  colorBack?: string;
  colorFront?: string;
  /** Size of each dither pixel, in CSS pixels. @default 3 */
  pxSize?: number;
  /** Animation speed. 0 freezes the pattern. @default 1 */
  speed?: number;
  className?: string;
};

/**
 * Animated ordered-dither pattern rendered in WebGL (Paper Design's
 * `Dithering` shader). Fills its positioned parent. Freezes under
 * `prefers-reduced-motion`.
 */
export function DitheringShader({
  shape = "wave",
  type = "8x8",
  colorBack = "#000000",
  colorFront = "#ffffff",
  pxSize = 3,
  speed = 1,
  className,
}: DitheringShaderProps) {
  const reduce = React.useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  return (
    <Dithering
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}
      shape={shape}
      type={type}
      colorBack={colorBack}
      colorFront={colorFront}
      size={pxSize}
      speed={reduce ? 0 : speed}
    />
  );
}

export default DitheringShader;
