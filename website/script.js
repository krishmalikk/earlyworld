// earlyworld marketing site — lightweight interactions, no dependencies.

// Nav background on scroll
const nav = document.getElementById("nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
onScroll();
window.addEventListener("scroll", onScroll, { passive: true });

// Mobile menu
const toggle = document.getElementById("navToggle");
toggle.addEventListener("click", () => {
  const open = nav.classList.toggle("menu-open");
  toggle.setAttribute("aria-expanded", String(open));
});
nav.querySelectorAll(".nav__links a").forEach((a) =>
  a.addEventListener("click", () => {
    nav.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
  })
);

// Scroll reveal
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    });
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Waitlist form (front-end only — wire up to a real endpoint later)
const form = document.getElementById("waitlist");
const note = document.getElementById("formNote");
form.addEventListener("submit", (e) => {
  e.preventDefault();
  const email = form.email.value.trim();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!valid) {
    note.textContent = "Please enter a valid email address.";
    note.className = "cta__fine err";
    return;
  }
  note.textContent = "You're on the list. We'll be in touch when your spot opens.";
  note.className = "cta__fine ok";
  form.reset();
});

// Footer year
document.getElementById("year").textContent = new Date().getFullYear();
