/** Unique, naturally played seconds. Jumps, stalled clocks, and replayed segments add nothing. */
export class PlaybackTracker {
  private previous: { position: number; time: number } | null = null;
  private covered = new Set<number>();
  private armed = false;
  private sent = false;
  interact() {
    this.armed = true;
  }
  resetPosition() {
    this.previous = null;
  }
  sample(position: number, duration: number, playing: boolean, now: number) {
    if (
      !this.armed ||
      this.sent ||
      !Number.isFinite(position) ||
      !Number.isFinite(duration) ||
      duration < 10 ||
      duration > 3600
    )
      return null;
    const prev = this.previous;
    this.previous = playing ? { position, time: now } : null;
    if (!playing || !prev) return null;
    const delta = position - prev.position;
    const wall = (now - prev.time) / 1000;
    if (wall <= 0 || wall > 3 || delta <= 0 || delta > Math.min(3, wall * 1.35 + 0.2)) return null;
    for (let second = Math.ceil(prev.position); second < Math.floor(position); second++)
      this.covered.add(second);
    // Subsecond progress is counted once on each integer boundary.
    if (Math.floor(position) > Math.floor(prev.position))
      this.covered.add(Math.floor(position) - 1);
    if (this.covered.size >= duration * 0.6) {
      this.sent = true;
      return { seconds: this.covered.size, duration };
    }
    return null;
  }
}
