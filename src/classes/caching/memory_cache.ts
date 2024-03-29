import assert from 'assert';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
import type { INodeFetchCacheCache, NFCResponseMetadata } from '../../types.js';
import { KeyTimeout } from './key_timeout.js';

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', chunk =>
      chunks.push(chunk as Buffer),
    ).on('error', error => {
      reject(error);
    }).on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
}

export class MemoryCache implements INodeFetchCacheCache {
  private readonly ttl?: number | undefined;
  private readonly keyTimeout = new KeyTimeout();
  private readonly cache = new Map<string, { bodyBuffer: Buffer; metaData: NFCResponseMetadata }>();

  constructor(options?: { ttl?: number }) {
    this.ttl = options?.ttl;
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

  async set(key: string, bodyStream: NodeJS.ReadableStream, metaData: NFCResponseMetadata) {
    const bodyBuffer = await streamToBuffer(bodyStream);
    this.cache.set(key, { bodyBuffer, metaData });

    if (typeof this.ttl === 'number') {
      this.keyTimeout.updateTimeout(key, this.ttl, async () => this.remove(key));
    }

    const cachedResult = await this.get(key);
    assert(cachedResult, 'Failed to cache response');

    return cachedResult;
  }
}
