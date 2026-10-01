// earlyworld site. Minimal, no dependencies.

// Waitlist form. Front-end only for now; point it at a real endpoint before launch.
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
