import { AlbumHero } from "@/components/AlbumHero";
import { PhoneDemo } from "@/components/PhoneDemo";
import { Waitlist } from "@/components/Waitlist";
import { WaveBand } from "@/components/WaveBand";

const FEATURES = [
  {
    title: "Producers get their name on the work",
    body: "Every track lists the producer next to the artist. You can open a producer's full catalog and follow them the same way you follow an artist. Credits fill in automatically when a track is added, and anything you enter yourself takes priority.",
  },
  {
    title: "Rare saves find your people",
    body: "When you save a track it counts toward your taste, and the fewer people who saved it, the more it says about you. earlyworld matches you with listeners who saved the same hard-to-find tracks, and shows you exactly which ones you have in common.",
  },
  {
    title: "Rate what you hear",
    body: "Rate songs and releases in half-stars, add a short review if you feel like it, and pin your favorites to your profile. Your ratings build a history that tells people who you are, next to the community average for each track.",
  },
  {
    title: "It sends you to the real source",
    body: "There is no player inside earlyworld. Every track opens on its original source, so the play lands where it should and the artist and producer get credit for it. No ripped audio, no autoplay, no listening history sold on.",
  },
];

const STEPS = [
  "Pick the scenes and artists you already follow.",
  "Save five tracks to start your profile.",
  "Rate what you hear and add any producer credits that are missing.",
  "Get matched with listeners who saved the same rare tracks.",
];

const FAQ = [
  {
    q: "Can I play music in the app?",
    a: "No. earlyworld links out to each track's original source instead, so artists and producers get the play. There is no built-in player and no autoplay.",
  },
  {
    q: 'What makes a save "rare"?',
    a: "Rarity is just how few people have saved a track. A shared rare save counts for more in matching than a popular one, so finding something early is what connects you to the right people.",
  },
  {
    q: "Where do the producer credits come from?",
    a: "They are filled in carefully when a track is added, and any credit you enter yourself wins. When a credit is unknown it stays blank rather than being guessed.",
  },
  {
    q: "What does it cost?",
    a: "earlyworld is launching in early access. There are no ads and nothing is tracked. Leave your email below and we will tell you when a spot opens.",
  },
  {
    q: "Which platforms does it run on?",
    a: "It is a native app for iOS and Android. There is no web version.",
  },
];

const NAV = [
  { href: "#what", label: "What it is" },
  { href: "#how", label: "How it works" },
  { href: "#faq", label: "FAQ" },
];

export default function App() {
  return (
    <>
      <header className="nav">
        <div className="wrap nav__inner">
          <a className="brand" href="#top">
            <img src="/earlyworld-logo.png" alt="earlyworld logo" />
            <span>earlyworld</span>
          </a>
          <nav className="nav__links">
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
            <a href="#access">Get access</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <AlbumHero />
        <WaveBand />

        <section className="hero">
          <div className="wrap hero__grid">
            <div className="hero__text">
              <h2>Dig deeper into underground music.</h2>
              <p className="lead">
                earlyworld is a small app for finding new tracks, crediting the producers who made
                them, and connecting with listeners who share your taste.
              </p>
              <a href="#access" className="btn">
                Get early access
              </a>
              <p className="note">A native app for iOS and Android. No ads, no autoplay.</p>
            </div>
            <PhoneDemo />
          </div>
        </section>

        <section className="band" id="what">
          <div className="wrap narrow">
            <p className="big">
              Streaming apps push whatever is already popular, and the producer rarely gets a
              mention. earlyworld does the opposite. It is a quieter place for underground music,
              where discovery runs on real taste and credit goes to everyone who made the record.
            </p>
          </div>
        </section>

        <section className="feat">
          <div className="wrap">
            {FEATURES.map((f) => (
              <div key={f.title} className="feat__item">
                <h2>{f.title}</h2>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="band" id="how">
          <div className="wrap narrow">
            <h2 className="band__h">How it works</h2>
            <ol className="steps">
              {STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
            <p className="who">
              It is built for people who care about music past the charts: listeners who want their
              finds to count, producers who want their name on their records, and anyone building a
              profile other people actually trust for new sounds.
            </p>
          </div>
        </section>

        <section className="faq" id="faq">
          <div className="wrap narrow">
            <h2 className="band__h">Questions</h2>
            {FAQ.map((item) => (
              <div key={item.q} className="qa">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="access" id="access">
          <div className="wrap narrow">
            <h2>earlyworld is launching soon.</h2>
            <p>Leave your email and we will let you know when you can get in.</p>
            <Waitlist />
          </div>
        </section>
      </main>

      <footer className="foot">
        <div className="wrap foot__inner">
          <span>earlyworld</span>
          <nav>
            {NAV.map((n) => (
              <a key={n.href} href={n.href}>
                {n.label}
              </a>
            ))}
            <a href="mailto:hello@earlyworld.app">Contact</a>
          </nav>
          <small>© {new Date().getFullYear()} earlyworld</small>
        </div>
      </footer>
    </>
  );
}
