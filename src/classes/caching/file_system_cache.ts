import assert from 'assert';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
import cacache from 'cacache';
import type { INodeFetchCacheCache, NFCResponseMetadata } from '../../types';

type StoredMetadata = {
  emptyBody?: boolean;
  expiration?: number | undefined;
} & NFCResponseMetadata;

const emptyBuffer = Buffer.alloc(0);

export class FileSystemCache implements INodeFetchCacheCache {
  private readonly ttl?: number | undefined;
  private readonly cacheDirectory: string;

  constructor(options: { ttl?: number; cacheDirectory?: string } = {}) {
    this.ttl = options.ttl;
    this.cacheDirectory = options.cacheDirectory ?? '.cache';
  }

  async get(key: string, options?: { ignoreExpiration?: boolean }) {
    const cachedObjectInfo = await cacache.get.info(this.cacheDirectory, key);

    if (!cachedObjectInfo) {
      return undefined;
    }

    const storedMetadata = cachedObjectInfo.metadata as StoredMetadata;
    const { emptyBody, expiration, ...nfcMetadata } = storedMetadata;

    if (!options?.ignoreExpiration && expiration && expiration < Date.now()) {
      return undefined;
    }

    if (emptyBody) {
      return {
        bodyStream: Readable.from(emptyBuffer),
        metaData: storedMetadata,
      };
    }

    return {
      bodyStream: cacache.get.stream.byDigest(this.cacheDirectory, cachedObjectInfo.integrity),
      metaData: nfcMetadata,
    };
  }

  async remove(key: string) {
    return cacache.rm.entry(this.cacheDirectory, key);
  }

  async set(key: string, bodyStream: NodeJS.ReadableStream, metaData: NFCResponseMetadata) {
    const metaToStore = {
      ...metaData,
      expiration: undefined as (undefined | number),
      emptyBody: false,
    };

    if (typeof this.ttl === 'number') {
      metaToStore.expiration = Date.now() + this.ttl;
    }

    await this.writeDataToCache(key, metaToStore, bodyStream);

    const cachedData = await this.get(key, { ignoreExpiration: true });
    assert(cachedData, 'Failed to cache response');

    return cachedData;
  }

  private async writeDataToCache(
    key: string,
    storedMetadata: StoredMetadata,
    stream: NodeJS.ReadableStream,
  ) {
    try {
      await new Promise((fulfill, reject) => {
        stream.pipe(cacache.put.stream(this.cacheDirectory, key, { metadata: storedMetadata }))
          .on('integrity', (i: string) => {
            fulfill(i);
          })
          .on('error', (error: Error) => {
            reject(error);
          });
      });
    } catch (error: any) {
      if (error.code !== 'ENODATA') {
        throw error as Error;
      }

      storedMetadata.emptyBody = true;
      await cacache.put(this.cacheDirectory, key, emptyBuffer, { metadata: storedMetadata });
    }
  }
}
