/**
 * A Map that never holds more than `max` entries.
 *
 * Caches that key on user-supplied input (every URL a preview is asked for,
 * every origin whose robots.txt is read) grow for as long as the app runs. On
 * a laptop with 4 GB of RAM that is a slow leak. This keeps the newest `max`
 * entries and drops the oldest, which is the right trade for a cache: an
 * evicted entry is just fetched again.
 */
export class BoundedMap<K, V> extends Map<K, V> {
  constructor(private readonly max: number) {
    super()
  }

  override set(key: K, value: V): this {
    if (this.has(key)) this.delete(key)
    super.set(key, value)
    while (this.size > this.max) {
      const oldest = this.keys().next().value as K
      this.delete(oldest)
    }
    return this
  }
}
