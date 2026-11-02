/** Bounded most-recently-used map, so long sessions cannot grow memory without limit. */
export class RecentCache<T> {
  private values = new Map<string, T>();
  constructor(private max = 100) {}
  get(key: string) {
    const value = this.values.get(key);
    if (value === undefined) return undefined;
    this.values.delete(key);
    this.values.set(key, value);
    return value;
  }
  set(key: string, value: T) {
    this.values.delete(key);
    this.values.set(key, value);
    if (this.values.size > this.max) this.values.delete(this.values.keys().next().value!);
  }
  delete(key: string) {
    this.values.delete(key);
  }
  clear() {
    this.values.clear();
  }
}
