import { Readable } from 'stream';
import { KeyTimeout } from './key_timeout.js';

function streamToBuffer(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export class MemoryCache {
  constructor(options = {}) {
    this.ttl = options.ttl;
    this.keyTimeout = new KeyTimeout();
    this.cache = {};
  }

  get(key) {
    const cachedValue = this.cache[key];
    if (cachedValue) {
      return {
        bodyStream: Readable.from(cachedValue.bodyBuffer),
        metaData: cachedValue.metaData,
      };
    }

    return undefined;
  }

  remove(key) {
    this.keyTimeout.clearTimeout(key);
    delete this.cache[key];
  }

  async set(key, bodyStream, metaData) {
    const bodyBuffer = await streamToBuffer(bodyStream);
    this.cache[key] = { bodyBuffer, metaData };

    if (typeof this.ttl === 'number') {
      this.keyTimeout.updateTimeout(key, this.ttl, () => this.remove(key));
    }

    return this.get(key);
  }
}
