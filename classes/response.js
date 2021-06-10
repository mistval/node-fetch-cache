const fs = require('fs');
const Headers = require('./headers.js');

class Response {
  constructor(raw, cacheFilePath, fromCache) {
    Object.assign(this, raw);
    this.cacheFilePath = cacheFilePath;
    this.headers = new Headers(raw.headers);
    this.fromCache = fromCache;
    this.consumed = false;

    if (this.bodyBuffer.type === 'Buffer') {
      this.bodyBuffer = Buffer.from(this.bodyBuffer);
    }
  }

  consumeBody() {
    if (this.consumed) {
      throw new Error('Error: body used already');
    }

    this.consumed = true;
    return this.bodyBuffer;
  }

  text() {
    return this.consumeBody().toString();
  }

  json() {
    return JSON.parse(this.consumeBody().toString());
  }

  buffer() {
    return this.consumeBody();
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
