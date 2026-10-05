// earlyworld site. Minimal, no dependencies.

// --- Flowing wave background (hero) ---
// Stacked sine lines with a shifting colour gradient, drifting over time, for
// the topographic "sound wave" field. earlyworld's logo is a waveform, so the
// motion is on-theme rather than decorative filler.
(function () {
  const canvas = document.getElementById("waves");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let w = 0;
  let h = 0;
  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    w = r.width;
    h = r.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  window.addEventListener("resize", resize);

  const gradient = () => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0.0, "rgba(255,126,182,0)");
    g.addColorStop(0.18, "rgba(255,126,182,0.55)"); // pink
    g.addColorStop(0.42, "rgba(169,120,255,0.6)"); // violet
    g.addColorStop(0.64, "rgba(120,150,255,0.6)"); // periwinkle (brand)
    g.addColorStop(0.85, "rgba(90,220,220,0.55)"); // teal
    g.addColorStop(1.0, "rgba(90,220,220,0)");
    return g;
  };

  const LINES = 28;
  const draw = (ms) => {
    const t = ms * 0.00042;
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = gradient();
    for (let i = 0; i < LINES; i++) {
      const baseY = h * 0.08 + (i / (LINES - 1)) * (h * 0.86);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 8) {
        const nx = x / w;
        const amp = 16 + 13 * Math.sin(nx * 3 + i * 0.3);
        const y =
          baseY +
          Math.sin(nx * 6 + t * 2 + i * 0.5) * amp +
          Math.sin(nx * 13 - t * 1.3 + i * 0.22) * amp * 0.3;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  };

  if (reduce) {
    draw(0);
  } else {
    const loop = (ms) => {
      draw(ms);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
})();

// --- Animated phone demo ---
// Loops through the feed: focus a track, save it (count ticks up), pop a "rare"
// badge, and slide up a match when the save is a rare one. Honest to the app:
// it never implies in-app playback, only discovery, saving, and matching.
(function () {
  const phone = document.getElementById("phone");
  if (!phone) return;

  const rows = Array.from(phone.querySelectorAll(".prow"));
  const toast = document.getElementById("ptoast");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Entrance: rows fade in once the hero is on screen.
  requestAnimationFrame(() => phone.classList.add("ready"));

  if (reduce) {
    // Static, legible resting state for reduced-motion users.
    rows[0].classList.add("focus");
    return;
  }

  let i = 0;
  const step = () => {
    rows.forEach((r) => r.classList.remove("focus", "saved"));
    toast.classList.remove("show");

    const row = rows[i];
    row.classList.add("focus");

    // Save it a beat after it gets focus.
    setTimeout(() => {
      row.classList.add("saved");
      const c = row.querySelector(".count");
      c.textContent = Number(c.dataset.n) + 1;
    }, 850);

    // A rare save surfaces a match.
    setTimeout(() => {
      if (row.dataset.rare) {
        toast.querySelector(".who").textContent = row.dataset.match;
        toast.querySelector(".trk").textContent = row.querySelector("b").textContent;
        toast.classList.add("show");
      }
    }, 1500);

    // Reset the count for next loop so it doesn't climb forever.
    setTimeout(() => {
      const c = row.querySelector(".count");
      c.textContent = c.dataset.n;
    }, 3100);

    i = (i + 1) % rows.length;
  };

  step();
  setInterval(step, 3300);
})();

// --- Waitlist form ---
// Front-end only for now; point it at a real endpoint before launch.
const form = document.getElementById("waitlist");
const note = document.getElementById("formNote");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    note.textContent = "That email doesn't look right. Try again.";
    note.className = "note err";
    return;
  }
  note.textContent = "You're on the list. We'll be in touch when a spot opens.";
  note.className = "note ok";
  form.reset();
});

document.getElementById("year").textContent = new Date().getFullYear();
