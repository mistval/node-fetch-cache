import cacache from 'cacache';
import { Readable } from 'stream';
import { INodeFetchCacheCache } from './cache';
import assert from 'assert';

function getBodyAndMetaKeys(key: string) {
  return [`${key}body`, `${key}meta`] as const;
}

export class FileSystemCache implements INodeFetchCacheCache {
  private readonly ttl?: number | undefined;
  private readonly cacheDirectory: string;

  constructor(options: { ttl?: number; cacheDirectory?: string; } = {}) {
    this.ttl = options.ttl;
    this.cacheDirectory = options.cacheDirectory || '.cache';
  }

  async get(key: string, options?: { ignoreExpiration?: boolean; }) {
    const [, metaKey] = getBodyAndMetaKeys(key);

    const metaInfo = await cacache.get.info(this.cacheDirectory, metaKey);

    if (!metaInfo) {
      return undefined;
    }

    const metaBuffer = await cacache.get.byDigest(this.cacheDirectory, metaInfo.integrity);
    const metaData = JSON.parse(metaBuffer);
    const { bodyStreamIntegrity, empty, expiration } = metaData;

    delete metaData.bodyStreamIntegrity;
    delete metaData.empty;
    delete metaData.expiration;

    const ignoreExpiration = options?.ignoreExpiration;

    if (!ignoreExpiration && expiration && expiration < Date.now()) {
      return undefined;
    }

    const bodyStream = empty
      ? Readable.from(Buffer.alloc(0))
      : cacache.get.stream.byDigest(this.cacheDirectory, bodyStreamIntegrity);

    return {
      bodyStream,
      metaData,
    };
  }

  remove(key: string) {
    const [bodyKey, metaKey] = getBodyAndMetaKeys(key);

    return Promise.all([
      cacache.rm.entry(this.cacheDirectory, bodyKey),
      cacache.rm.entry(this.cacheDirectory, metaKey),
    ]);
  }

  async set(key: string, bodyStream: NodeJS.ReadableStream, metaData: object) {
    const [bodyKey, metaKey] = getBodyAndMetaKeys(key);

    const metaToStore = {
      ...metaData,
      expiration: undefined as (undefined | number),
      bodyStreamIntegrity: undefined as (undefined | string),
      empty: false,
    };

    if (typeof this.ttl === 'number') {
      metaToStore.expiration = Date.now() + this.ttl;
    }

    try {
      metaToStore.bodyStreamIntegrity = await new Promise((fulfill, reject) => {
        bodyStream.pipe(cacache.put.stream(this.cacheDirectory, bodyKey))
          .on('integrity', (i) => fulfill(i))
          .on('error', (e) => {
            reject(e);
          });
      });
    } catch (err: any) {
      if (err.code !== 'ENODATA') {
        throw err;
      }

      metaToStore.empty = true;
    }

    const metaBuffer = Buffer.from(JSON.stringify(metaToStore));
    await cacache.put(this.cacheDirectory, metaKey, metaBuffer);
    const cachedData = await this.get(key, { ignoreExpiration: true });
    assert(cachedData, 'Cached data should be available after storing it');

    return cachedData;
  }
}
