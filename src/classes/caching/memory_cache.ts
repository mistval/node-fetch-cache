import { Readable } from 'stream';
import { KeyTimeout } from './key_timeout.js';
import { INodeFetchCacheCache } from './cache.js';
import assert from 'assert';

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on('error', (err) => reject(err));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export class MemoryCache implements INodeFetchCacheCache {
  private readonly ttl?: number | undefined;
  private readonly keyTimeout = new KeyTimeout();
  private readonly cache: Record<string, { bodyBuffer: Buffer; metaData: object; }>;

  constructor(options?: { ttl?: number }) {
    this.ttl = options?.ttl;
    this.keyTimeout = new KeyTimeout();
    this.cache = {};
  }

  async get(key: string) {
    const cachedValue = this.cache[key];
    if (cachedValue) {
      return {
        bodyStream: Readable.from(cachedValue.bodyBuffer),
        metaData: cachedValue.metaData,
      };
    }

    return undefined;
  }

  async remove(key: string) {
    this.keyTimeout.clearTimeout(key);
    delete this.cache[key];
  }

  async set(key: string, bodyStream: NodeJS.ReadableStream, metaData: object) {
    const bodyBuffer = await streamToBuffer(bodyStream);
    this.cache[key] = { bodyBuffer, metaData };

    if (typeof this.ttl === 'number') {
      this.keyTimeout.updateTimeout(key, this.ttl, () => this.remove(key));
    }

    const value = await this.get(key);
    assert(value, 'Value should be set after setting it');
    return value;
  }
}
