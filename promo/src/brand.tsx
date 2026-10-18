import { loadFont } from '@remotion/fonts';
import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

/** Brand values copied from shared/brand.ts and shared/theme.ts in the app. */
export const colors = {
  bg: '#050710',
  panel: '#0C1425',
  line: '#2B3652',
  text: '#FAFAFC',
  muted: '#9EABD3',
  accent: '#A9B3FC',
  banner: '#1D2552',
};
export const fonts = { display: 'Panchang', mono: 'DM Mono', body: 'system-ui, -apple-system, sans-serif' };

loadFont({ family: 'Panchang', url: staticFile('fonts/Panchang-Bold.otf'), weight: '700' });
loadFont({ family: 'Panchang', url: staticFile('fonts/Panchang-Medium.otf'), weight: '500' });
loadFont({ family: 'DM Mono', url: staticFile('fonts/DMMono_400Regular.ttf'), weight: '400' });

// Settled springs: snappy without the default overshoot.
export const snap = { damping: 16, stiffness: 140, mass: 0.8 };

/** 0→1 entrance progress starting at `delay` frames. */
export function useEntrance(delay = 0) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: snap });
}

/** The app's flowing wave-line background, drifting slowly. */
export function Waves({ opacity = 1 }: { opacity?: number }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const lines = 26;
  return (
    <AbsoluteFill style={{ opacity }}>
      <svg width={width} height={height}>
        {Array.from({ length: lines }, (_, i) => {
          const t = i / (lines - 1);
          const bulge = Math.sin(Math.PI * t);
          const y = 60 + (height - 120) * t;
          const amplitude = 14 + 46 * bulge;
          const phase = i * 0.6 + frame * 0.025;
          let d = '';
          for (let step = 0; step <= 60; step++) {
            const x = -40 + ((width + 80) * step) / 60;
            const yy = y + amplitude * Math.sin(0.006 * x + phase);
            d += `${step === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${yy.toFixed(1)} `;
          }
          return (
            <path
              key={i}
              d={d}
              stroke={colors.accent}
              strokeOpacity={0.06 + 0.12 * bulge}
              strokeWidth={2.5}
              fill="none"
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}

export function Background({ waves = 1 }: { waves?: number }) {
  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg }}>
      <Waves opacity={waves} />
    </AbsoluteFill>
  );
}

/** Words that spring up one after another. */
export function KineticLine({
  text,
  delay = 0,
  size = 110,
  color = colors.text,
  stagger = 4,
  align = 'center',
}: {
  text: string;
  delay?: number;
  size?: number;
  color?: string;
  stagger?: number;
  align?: 'center' | 'left';
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: align === 'center' ? 'center' : 'flex-start',
        columnGap: size * 0.28,
        fontFamily: fonts.display,
        fontWeight: 700,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: -size * 0.02,
        color,
      }}
    >
      {text.split(' ').map((word, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: snap });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [size * 0.5, 0])}px)`,
            }}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}

export function Eyebrow({ text, delay = 0 }: { text: string; delay?: number }) {
  const p = useEntrance(delay);
  return (
    <div
      style={{
        fontFamily: fonts.mono,
        fontSize: 38,
        letterSpacing: 8,
        textTransform: 'uppercase',
        color: colors.accent,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [20, 0])}px)`,
      }}
    >
      {text}
    </div>
  );
}

/** A real app screenshot in a simple phone frame. */
export function Phone({
  src,
  width = 640,
  style,
}: {
  src: string;
  width?: number;
  style?: React.CSSProperties;
}) {
  const height = width * (2622 / 1206);
  const bezel = width * 0.035;
  return (
    <div
      style={{
        width: width + bezel * 2,
        height: height + bezel * 2,
        padding: bezel,
        borderRadius: width * 0.16,
        background: '#14182A',
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 2px ${colors.line}, 0 0 90px rgba(169,179,252,0.18)`,
        ...style,
      }}
    >
      <Img
        src={staticFile(src)}
        style={{ width, height, borderRadius: width * 0.13, display: 'block' }}
      />
    </div>
  );
}

export function Logo({ size }: { size: number }) {
  return (
    <Img
      src={staticFile('logo.png')}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        boxShadow: `0 0 0 2px ${colors.line}, 0 30px 90px rgba(169,179,252,0.25)`,
      }}
    />
  );
}
