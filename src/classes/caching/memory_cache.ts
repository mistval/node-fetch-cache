import { Buffer } from 'node:buffer';
import { Readable } from 'node:stream';
import assert from 'node:assert';
import { KeyTimeout } from './key_timeout.js';
import { type INodeFetchCacheCache } from './cache.js';

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', chunk => chunks.push(Buffer.from(chunk as Buffer)));
    stream.on('error', error => {
      reject(error);
    });
    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

export class MemoryCache implements INodeFetchCacheCache {
  private readonly ttl?: number | undefined;
  private readonly keyTimeout = new KeyTimeout();
  private readonly cache = new Map<string, { bodyBuffer: Buffer; metaData: Record<string, unknown> }>();

  constructor(options?: { ttl?: number }) {
    this.ttl = options?.ttl;
    this.keyTimeout = new KeyTimeout();
  }

  async get(key: string) {
    const cachedValue = this.cache.get(key);
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
    this.cache.delete(key);
  }

  async set(key: string, bodyStream: NodeJS.ReadableStream, metaData: Record<string, unknown>) {
    const bodyBuffer = await streamToBuffer(bodyStream);
    this.cache.set(key, { bodyBuffer, metaData });

    if (typeof this.ttl === 'number') {
      this.keyTimeout.updateTimeout(key, this.ttl, async () => this.remove(key));
    }

    const value = await this.get(key);
    assert(value, 'Value should be set after setting it');
    return value;
  }
}
