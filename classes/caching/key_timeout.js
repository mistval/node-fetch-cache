export class KeyTimeout {
  constructor() {
    this.timeoutHandleForKey = {};
  }

  clearTimeout(key) {
    clearTimeout(this.timeoutHandleForKey[key]);
  }

  updateTimeout(key, durationMs, callback) {
    this.clearTimeout(key);
    this.timeoutHandleForKey[key] = setTimeout(() => {
      callback();
    }, durationMs);
  }
}
