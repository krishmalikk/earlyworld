// earlyworld site. Minimal, no dependencies.

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
