import { ReadableStream } from "stream/web";
import assert from 'assert';
import type { INodeFetchCacheCache, NFCResponseMetadata } from '../../types.js';
import { KeyTimeout } from './key_timeout.js';

async function streamToBuffer(stream: ReadableStream): Promise<Buffer> {
  const chunks = [];
  
  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
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
        bodyStream: new Blob([cachedValue.bodyBuffer]).stream() as Omit<ReadableStream<any>, "closed">,
        metaData: cachedValue.metaData,
      };
    }

    return undefined;
  }

  async remove(key: string) {
    this.keyTimeout.clearTimeout(key);
    this.cache.delete(key);
  }

  async set(key: string, bodyStream: Omit<ReadableStream, "closed">, metaData: NFCResponseMetadata) {
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
