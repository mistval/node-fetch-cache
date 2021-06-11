const FPersist = require('fpersist');
const KeyTimeout = require('./key_timeout.js');

module.exports = class FileSystemCache {
  constructor(options = {}) {
    this.ttl = options.ttl;
    this.keyTimeout = new KeyTimeout();

    const cacheDirectory = options.cacheDirectory || '.cache';
    this.cache = new FPersist(cacheDirectory);
  }

  get(key) {
    return this.cache.getItem(key);
  }

  remove(key) {
    this.keyTimeout.clearTimeout(key);
    return this.cache.deleteItem(key);
  }

  async set(key, value) {
    await this.cache.setItem(key, value);

    if (typeof this.ttl === 'number') {
      this.keyTimeout.updateTimeout(key, this.ttl, () => this.remove(key));
    }
  }
};
