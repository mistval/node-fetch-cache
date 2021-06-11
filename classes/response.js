const stream = require('stream');
const Headers = require('./headers.js');

class Response {
  constructor(raw, ejectSelfFromCache, fromCache) {
    Object.assign(this, raw);
    this.ejectSelfFromCache = ejectSelfFromCache;
    this.headers = new Headers(raw.headers);
    this.fromCache = fromCache;
    this.bodyUsed = false;

    if (this.bodyBuffer.type === 'Buffer') {
      this.bodyBuffer = Buffer.from(this.bodyBuffer);
    }
  }

  get body() {
    return stream.Readable.from(this.bodyBuffer);
  }

  consumeBody() {
    if (this.bodyUsed) {
      throw new Error('Error: body used already');
    }

    this.bodyUsed = true;
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

  ejectFromCache() {
    return this.ejectSelfFromCache();
  }
}

module.exports = Response;
