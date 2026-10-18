import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';
import {
  Background,
  colors,
  Eyebrow,
  fonts,
  KineticLine,
  Logo,
  Phone,
  useEntrance,
} from './brand';

// Text stays inside the area TikTok, Reels and Shorts leave uncovered (~90px sides, 200px top, 360px bottom).
const SAFE = { top: 200, side: 90, bottom: 360 };
const T = 12; // transition length in frames

function Hook() {
  return (
    <AbsoluteFill style={{ justifyContent: 'center', padding: SAFE.side }}>
      <KineticLine text="Heard it" size={118} />
      <KineticLine text="before it" size={118} delay={8} />
      <KineticLine text="blew up?" size={118} delay={16} color={colors.accent} />
    </AbsoluteFill>
  );
}

function Problem() {
  const frame = useCurrentFrame();
  const out = interpolate(frame, [34, 44], [1, 0.25], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', padding: SAFE.side, gap: 56 }}>
      <div style={{ opacity: out, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
        <Eyebrow text="The algorithm" />
        <KineticLine text="plays everyone the same songs." size={92} delay={4} stagger={3} />
      </div>
      <KineticLine text="We don’t." size={120} delay={38} color={colors.accent} />
    </AbsoluteFill>
  );
}

function Brand() {
  const p = useEntrance(0);
  const sub = useEntrance(16);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 60, padding: SAFE.side }}>
      <div style={{ transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`, opacity: p }}>
        <Logo size={330} />
      </div>
      <KineticLine text="earlyworld" size={130} delay={6} />
      <div
        style={{
          fontFamily: fonts.body,
          fontSize: 50,
          lineHeight: 1.3,
          color: colors.muted,
          textAlign: 'center',
          opacity: sub,
          transform: `translateY(${interpolate(sub, [0, 1], [24, 0])}px)`,
        }}
      >
        Rate, save and share
        <br />
        the underground.
      </div>
    </AbsoluteFill>
  );
}

/** One feature: label and headline up top, the real screen rising from below. */
function Feature({ step, label, title, screen }: { step: string; label: string; title: string; screen: string }) {
  const frame = useCurrentFrame();
  const rise = useEntrance(4);
  const drift = interpolate(frame, [0, 90], [0, -60]);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: SAFE.top,
          left: SAFE.side,
          right: SAFE.side,
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        <Eyebrow text={`${step} · ${label}`} />
        <KineticLine text={title} size={92} align="left" delay={3} stagger={3} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 640,
          display: 'flex',
          justifyContent: 'center',
          transform: `translateY(${interpolate(rise, [0, 1], [900, 0]) + drift}px) rotate(${interpolate(rise, [0, 1], [6, -2])}deg)`,
        }}
      >
        <Phone src={screen} width={600} />
      </div>
    </AbsoluteFill>
  );
}

function Cards() {
  const left = useEntrance(6);
  const right = useEntrance(14);
  const card = (src: string, p: number, side: -1 | 1) => (
    <Img
      src={staticFile(src)}
      style={{
        position: 'absolute',
        top: 700,
        left: '50%',
        width: 440,
        height: 440 * (1636 / 912),
        marginLeft: -220 + side * 190,
        borderRadius: 34,
        boxShadow: `0 40px 120px rgba(0,0,0,0.6), 0 0 0 2px ${colors.line}`,
        opacity: p,
        transform: `translateY(${interpolate(p, [0, 1], [700, 0])}px) rotate(${side * interpolate(p, [0, 1], [18, 7])}deg)`,
      }}
    />
  );
  return (
    <AbsoluteFill>
      <div style={{ position: 'absolute', top: SAFE.top, left: SAFE.side, right: SAFE.side, display: 'flex', flexDirection: 'column', gap: 28 }}>
        <Eyebrow text="06 · Share" />
        <KineticLine text="Flex what you found first." size={92} align="left" delay={3} stagger={3} />
      </div>
      {card('screens/orbit-card.png', left, -1)}
      {card('screens/recap-card.png', right, 1)}
    </AbsoluteFill>
  );
}

function EndCard() {
  const p = useEntrance(0);
  const tag = useEntrance(18);
  return (
    <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 54, padding: SAFE.side }}>
      <div style={{ transform: `scale(${interpolate(p, [0, 1], [0.7, 1])})`, opacity: p }}>
        <Logo size={260} />
      </div>
      <KineticLine text="earlyworld" size={130} delay={4} />
      <KineticLine text="Be early." size={110} delay={12} color={colors.accent} />
      <div
        style={{
          marginTop: 30,
          fontFamily: fonts.mono,
          fontSize: 40,
          letterSpacing: 6,
          textTransform: 'uppercase',
          color: colors.muted,
          opacity: tag,
        }}
      >
        Coming soon · iOS &amp; Android
      </div>
    </AbsoluteFill>
  );
}

const FEATURES = [
  { step: '01', label: 'Rate', title: 'Rate every track, ½ to 5 stars.', screen: 'screens/track.png' },
  { step: '02', label: 'Discover', title: 'Dig through every scene.', screen: 'screens/discover.png' },
  { step: '03', label: 'Match', title: 'Rare saves find your people.', screen: 'screens/matches.png' },
  { step: '04', label: 'For you', title: 'Reviews from your kind of listener.', screen: 'screens/feed.png' },
  { step: '05', label: 'Diary', title: 'Every find, logged.', screen: 'screens/diary.png' },
];
const SCENES: { frames: number; node: React.ReactNode }[] = [
  { frames: 66, node: <Hook /> },
  { frames: 76, node: <Problem /> },
  { frames: 78, node: <Brand /> },
  ...FEATURES.map((f) => ({ frames: 84, node: <Feature {...f} /> })),
  { frames: 96, node: <Cards /> },
  { frames: 100, node: <EndCard /> },
];
export const PROMO_FRAMES = SCENES.reduce((n, s) => n + s.frames, 0) - (SCENES.length - 1) * T;

export function Promo() {
  return (
    <AbsoluteFill>
      <Background />
      <TransitionSeries>
        {SCENES.map((scene, i) => (
          <React.Fragment key={i}>
            {i > 0 ? (
              <TransitionSeries.Transition
                presentation={i >= 3 && i <= 8 ? slide({ direction: 'from-right' }) : fade()}
                timing={linearTiming({ durationInFrames: T })}
              />
            ) : null}
            <TransitionSeries.Sequence durationInFrames={scene.frames}>{scene.node}</TransitionSeries.Sequence>
          </React.Fragment>
        ))}
      </TransitionSeries>
    </AbsoluteFill>
  );
}
