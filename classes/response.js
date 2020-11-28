const fs = require('fs');
const Headers = require('./headers.js');

class Response {
  constructor(raw, cacheFilePath, fromCache) {
    Object.assign(this, raw);
    this.cacheFilePath = cacheFilePath;
    this.headers = new Headers(raw.headers);
    this.fromCache = fromCache;

    if (this.bodyBuffer.type === 'Buffer') {
      this.bodyBuffer = Buffer.from(this.bodyBuffer);
    }
  }

  text() {
    return this.bodyBuffer.toString();
  }

  json() {
    return JSON.parse(this.bodyBuffer.toString());
  }

  buffer() {
    return this.bodyBuffer;
  }

  async ejectFromCache() {
    try {
      await fs.promises.unlink(this.cacheFilePath);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
    }
  }
}

module.exports = Response;