class RateLimiter {
  private lastRunByKey = new Map<string, number>();
  private queueByKey = new Map<string, Promise<void>>();

  async schedule<T>(key: string, minIntervalMs: number, task: () => Promise<T>): Promise<T> {
    const previous = this.queueByKey.get(key) ?? Promise.resolve();

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.queueByKey.set(key, previous.then(() => gate));

    await previous;
    try {
      const last = this.lastRunByKey.get(key) ?? 0;
      const waitMs = Math.max(0, last + minIntervalMs - Date.now());
      if (waitMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
      this.lastRunByKey.set(key, Date.now());
      return await task();
    } finally {
      release();
    }
  }
}

export const rateLimiter = new RateLimiter();
