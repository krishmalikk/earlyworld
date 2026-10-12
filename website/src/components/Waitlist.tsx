import { useState, type FormEvent } from "react";

type Status = { tone: "" | "ok" | "err"; text: string };

const IDLE: Status = { tone: "", text: "One email when your spot opens. Nothing else." };

// Front-end only for now; point it at a real endpoint before launch.
export function Waitlist() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>(IDLE);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus({ tone: "err", text: "That email doesn't look right. Try again." });
      return;
    }
    setStatus({ tone: "ok", text: "You're on the list. We'll be in touch when a spot opens." });
    setEmail("");
  };

  return (
    <>
      <form id="waitlist" noValidate onSubmit={submit}>
        <input
          type="email"
          name="email"
          placeholder="you@email.com"
          aria-label="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="btn">
          Request access
        </button>
      </form>
      <p id="formNote" className={`note ${status.tone}`} aria-live="polite">
        {status.text}
      </p>
    </>
  );
}
