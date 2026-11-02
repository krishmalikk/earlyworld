export type ProfileIdentity = { username: string; avatarUrl: string };
export type LoadedProfile = ProfileIdentity & { id: string };
const BATCH = 30;

/**
 * One account's listener identities. Rows on a screen share batched requests; `null` means
 * the server withheld the profile (blocked, suspended, deleting or missing).
 */
export class ProfileStore {
  private values = new Map<string, ProfileIdentity | null>();
  private mounted = new Map<string, number>();
  private queued = new Set<string>();
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  constructor(
    private load: (uids: string[]) => Promise<LoadedProfile[]>,
    private fail: (error: unknown) => void = () => {},
    private delay = 30,
  ) {}
  get = (uid: string) => this.values.get(uid);
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  retain(uid: string) {
    this.mounted.set(uid, (this.mounted.get(uid) || 0) + 1);
    if (!this.values.has(uid)) this.enqueue([uid]);
    return () => {
      const count = this.mounted.get(uid) || 0;
      if (count > 1) this.mounted.set(uid, count - 1);
      else this.mounted.delete(uid);
    };
  }
  /** Refreshes what is on screen; unmounted entries reload when they are next retained. */
  refresh() {
    for (const uid of this.values.keys()) if (!this.mounted.has(uid)) this.values.delete(uid);
    this.enqueue([...this.mounted.keys()]);
  }
  open() {
    this.closed = false;
    this.enqueue([]);
  }
  close() {
    this.closed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  private enqueue(uids: string[]) {
    uids.forEach((uid) => this.queued.add(uid));
    if (!this.queued.size || this.timer || this.closed) return;
    this.timer = setTimeout(() => this.flush(), this.delay);
  }
  private flush() {
    this.timer = null;
    const uids = [...this.queued];
    this.queued.clear();
    for (let i = 0; i < uids.length; i += BATCH) {
      const group = uids.slice(i, i + BATCH);
      this.load(group)
        .then((items) => this.publish(group, items))
        .catch((error) => {
          if (!this.closed) this.fail(error);
        });
    }
  }
  private publish(group: string[], items: LoadedProfile[]) {
    if (this.closed) return;
    const found = new Map(items.map((item) => [item.id, item]));
    let changed = false;
    for (const uid of group) {
      const item = found.get(uid),
        old = this.values.get(uid);
      if (item && old?.username === item.username && old.avatarUrl === item.avatarUrl) continue;
      if (!item && old === null) continue;
      this.values.set(uid, item ? { username: item.username, avatarUrl: item.avatarUrl } : null);
      changed = true;
    }
    if (changed) this.listeners.forEach((listener) => listener());
  }
}
