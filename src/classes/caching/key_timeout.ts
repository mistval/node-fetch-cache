export class KeyTimeout {
  private readonly timeoutHandleForKey: Record<string, NodeJS.Timeout> = {};

  clearTimeout(key: string) {
    clearTimeout(this.timeoutHandleForKey[key]);
  }

  updateTimeout(key: string, durationMs: number, callback: () => unknown) {
    this.clearTimeout(key);
    this.timeoutHandleForKey[key] = setTimeout(() => {
      callback();
    }, durationMs);
  }
}
