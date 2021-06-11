const KeyTimeout = require('./key_timeout.js');

module.exports = class MemoryCache {
  constructor(options = {}) {
    this.ttl = options.ttl;
    this.keyTimeout = new KeyTimeout();

    if (options.global && !globalThis.nodeFetchCache) {
      globalThis.nodeFetchCache = {};
    }

    this.cache = options.global
      ? globalThis.nodeFetchCache
      : {};
  }

  get(key) {
    return this.cache[key];
  }

  remove(key) {
    this.keyTimeout.clearTimeout(key);
    delete this.cache[key];
  }

  set(key, value) {
    this.cache[key] = value;

    if (typeof this.ttl === 'number') {
      this.keyTimeout.updateTimeout(key, this.ttl, () => this.remove(key));
    }
  }
}
