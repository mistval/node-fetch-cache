import assert from 'assert';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
import cacache from 'cacache';
import type { INodeFetchCacheCache, NFCResponseMetadata } from '../../types';

type ParsedMetadata = {
  bodyStreamIntegrity?: string;
  empty?: boolean;
  expiration?: number;
} & NFCResponseMetadata;

function getBodyAndMetaKeys(key: string) {
  return [`${key}body`, `${key}meta`] as const;
}

export class FileSystemCache implements INodeFetchCacheCache {
  private readonly ttl?: number | undefined;
  private readonly cacheDirectory: string;

  constructor(options: { ttl?: number; cacheDirectory?: string } = {}) {
    this.ttl = options.ttl;
    this.cacheDirectory = options.cacheDirectory ?? '.cache';
  }

  async get(key: string, options?: { ignoreExpiration?: boolean }) {
    const [, metaKey] = getBodyAndMetaKeys(key);

    const metaInfo = await cacache.get.info(this.cacheDirectory, metaKey);

    if (!metaInfo) {
      return undefined;
    }

    const metaBuffer = await cacache.get.byDigest(this.cacheDirectory, metaInfo.integrity);
    const metaData = JSON.parse(metaBuffer) as ParsedMetadata;
    const { bodyStreamIntegrity, empty, expiration } = metaData;

    delete metaData.bodyStreamIntegrity;
    delete metaData.empty;
    delete metaData.expiration;

    if (!options?.ignoreExpiration && expiration && expiration < Date.now()) {
      return undefined;
    }

    const bodyStream = Boolean(empty) || !bodyStreamIntegrity
      ? Readable.from(Buffer.alloc(0))
      : cacache.get.stream.byDigest(this.cacheDirectory, bodyStreamIntegrity);

    return {
      bodyStream,
      metaData,
    };
  }

  async remove(key: string) {
    const [bodyKey, metaKey] = getBodyAndMetaKeys(key);

    return Promise.all([
      cacache.rm.entry(this.cacheDirectory, bodyKey),
      cacache.rm.entry(this.cacheDirectory, metaKey),
    ]);
  }

  async set(key: string, bodyStream: NodeJS.ReadableStream, metaData: NFCResponseMetadata) {
    const [bodyKey, metaKey] = getBodyAndMetaKeys(key);

    const metaToStore = {
      ...metaData,
      expiration: undefined as undefined | number,
      bodyStreamIntegrity: undefined as undefined | string,
      empty: false,
    };

    if (typeof this.ttl === 'number') {
      metaToStore.expiration = Date.now() + this.ttl;
    }

    try {
      metaToStore.bodyStreamIntegrity = await new Promise((fulfill, reject) => {
        bodyStream.pipe(cacache.put.stream(this.cacheDirectory, bodyKey))
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

      metaToStore.empty = true;
    }

    const metaBuffer = Buffer.from(JSON.stringify(metaToStore));
    await cacache.put(this.cacheDirectory, metaKey, metaBuffer);
    const cachedData = await this.get(key, { ignoreExpiration: true });
    assert(cachedData, 'Failed to cache response');

    return cachedData;
  }
}
