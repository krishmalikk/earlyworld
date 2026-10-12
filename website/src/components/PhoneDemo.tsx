import { useEffect, useRef } from "react";

type Track = {
  title: string;
  artists: string;
  producer: string;
  saves: number;
  art: number;
  /** Set for rare saves, which surface a taste match. */
  match?: string;
};

// Real underground rap acts with accurate producer credits. Save counts are
// illustrative sample data, not live figures.
const TRACKS: Track[] = [
  { title: "40", artists: "Nettspend, Xaviersobased", producer: "Evilgiane", saves: 7, art: 1, match: "@opiumfan" },
  { title: "in dis bitch", artists: "OsamaSon", producer: "Cranes", saves: 54, art: 2 },
  { title: "goosebumps", artists: "LAZER DIM 700", producer: "goxan", saves: 5, art: 5, match: "@lofiplug" },
  { title: "chaching", artists: "OsamaSon, Nettspend", producer: "Legion", saves: 8, art: 4, match: "@ragefm" },
  { title: "Style", artists: "2hollis", producer: "2hollis", saves: 38, art: 3 },
  { title: "Limitless", artists: "Yung Fazo", producer: "Murda Beatz", saves: 29, art: 6 },
];

// Loops through the feed: focus a track, save it (count ticks up), pop a "rare"
// badge, and slide up a match when the save is a rare one. Honest to the app:
// it never implies in-app playback, only discovery, saving, and matching.
export function PhoneDemo() {
  const phoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const phone = phoneRef.current;
    if (!phone) return;
    const rows = Array.from(phone.querySelectorAll<HTMLElement>(".prow"));
    const toast = phone.querySelector<HTMLElement>(".ptoast")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Entrance: rows fade in once the phone is mounted.
    const raf = requestAnimationFrame(() => phone.classList.add("ready"));

    if (reduce) {
      // Static, legible resting state for reduced-motion users.
      rows[0].classList.add("focus");
      return () => cancelAnimationFrame(raf);
    }

    const timers: number[] = [];
    let i = 0;
    const step = () => {
      rows.forEach((r) => r.classList.remove("focus", "saved"));
      toast.classList.remove("show");

      const row = rows[i];
      const track = TRACKS[i];
      const count = row.querySelector<HTMLElement>(".count")!;
      row.classList.add("focus");

      // Save it a beat after it gets focus.
      timers.push(
        window.setTimeout(() => {
          row.classList.add("saved");
          count.textContent = String(track.saves + 1);
        }, 850),
      );

      // A rare save surfaces a match.
      timers.push(
        window.setTimeout(() => {
          if (track.match) {
            toast.querySelector(".who")!.textContent = track.match;
            toast.querySelector(".trk")!.textContent = track.title;
            toast.classList.add("show");
          }
        }, 1500),
      );

      // Reset the count for next loop so it doesn't climb forever.
      timers.push(
        window.setTimeout(() => {
          count.textContent = String(track.saves);
        }, 3100),
      );

      i = (i + 1) % rows.length;
    };

    step();
    const interval = window.setInterval(step, 3300);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
      timers.forEach(window.clearTimeout);
    };
  }, []);

  return (
    <div className="phone-wrap">
      <div className="phone" ref={phoneRef} aria-hidden="true">
        <div className="phone__bar">
          <img src="/earlyworld-logo.png" alt="" />
          <span>Discover</span>
        </div>

        <div className="chips">
          <span className="chip on">rage</span>
          <span className="chip">plugg</span>
          <span className="chip">underground</span>
        </div>

        {TRACKS.map((t) => (
          <article key={t.title} className="prow" data-rare={t.match ? "1" : undefined}>
            <span className={`art art--${t.art}`} />
            <span className="pmeta">
              <b>{t.title}</b>
              <i>{t.artists}</i>
              <small>prod. {t.producer}</small>
            </span>
            <button className="save" tabIndex={-1}>
              <span className="glyph">&#9671;</span>
              <span className="count">{t.saves}</span>
            </button>
            <span className="rare-pill">rare</span>
          </article>
        ))}

        <div className="ptoast">
          <span className="ptoast__dot" />
          <span className="ptoast__msg">
            You and <b className="who">@opiumfan</b> both saved <b className="trk">40</b>
          </span>
        </div>
      </div>
    </div>
  );
}
