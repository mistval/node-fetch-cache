import assert from 'assert';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
import type { INodeFetchCacheCache, NFCResponseMetadata } from '../../types';

// type INodeFetchCacheCache = {
//   get(key: string): Promise<{
//     bodyStream: NodeJS.ReadableStream;
//     metaData: NFCResponseMetadata;
//   } | undefined>;
//   set(
//     key: string,
//     bodyStream: NodeJS.ReadableStream,
//     metaData: NFCResponseMetadata
//   ): Promise<{
//     bodyStream: NodeJS.ReadableStream;
//     metaData: NFCResponseMetadata;
//   }>;
//   remove(key: string): Promise<void | unknown>;
// };

type StoredMetadata = {
  emptyBody?: boolean;
  expiration?: number | undefined;
} & NFCResponseMetadata;

const emptyBuffer = Buffer.alloc(0);

// redisConnection url string format
// redis://<REDIS_USER>:<REDIS_PASSWORD>@<REDIS_HOST>:<REDIS_PORT>
// leave undefined for localhost:6789

export class RedisCache implements INodeFetchCacheCache {
  private readonly ttl?: number | undefined;
  private readonly redis;
  private readonly redisConnection?: string | undefined;
  private readonly redisOptions?: object | undefined;

  constructor(options: { ttl?: number; redisConnection?: string; redisOptions?: {} } = {}) {
    this.redisConnection = options.redisConnection;
    this.redisOptions = options.redisOptions;

    let Redis;
    try {
      Redis = require('ioredis');
    } catch (e) {
      console.log('ioredis is not installed. Redis support is disabled.');
    }

    if (Redis) {
      this.redis = new Redis(this.redisConnection, this.redisOptions);
    }

    this.ttl = options.ttl;
  }

  async get(key: string, options?: { ignoreExpiration?: boolean }) {
    const cachedObjectInfo = await this.redis.get(key);

    if (!cachedObjectInfo) {
      return undefined;
    }
  
    const readableStream = Readable.from(cachedObjectInfo);
    // readableStream.push(null);  // do we need to terminate?
  
    const storedMetadata = await this.redis.get(`${key}:meta`);
    const { emptyBody, expiration, ...nfcMetadata } = storedMetadata;

    if (!options?.ignoreExpiration && expiration && expiration < Date.now()) {
      return undefined;
    }

    if (emptyBody) {
      return {
        bodyStream: Readable.from(emptyBuffer),
        metaData: storedMetadata,  // why returning storedMetaData instread of nfcMetadata?
      };
    }

    return {
      bodyStream: readableStream,
      metaData: nfcMetadata,
    };
  }

  async remove(key: string) {
    await this.redis.del(key);
    await this.redis.del(`${key}:meta`);
    return true;
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

    await this.writeDataToRedis(key, metaToStore, bodyStream);

    const cachedData = await this.redis.get(key);
    assert(cachedData, 'Failed to cache response');

    const cachedMetaData = await this.redis.get(`${key}:meta`);
    assert(cachedMetaData, 'Failed to cache metadata');

    return cachedData;
  }

  private async writeDataToRedis(
    key: string,
    storedMetadata: StoredMetadata,
    bodyStream: NodeJS.ReadableStream,
  ) {
    let chunks: any = [];

    await new Promise((fulfill, reject) => {
      bodyStream.on('data', (chunk) => {
        chunks.push(chunk);
      });

      bodyStream.on('end', async () => {
        try {
          const buffer = Buffer.concat(chunks);

          await this.redis.set(key, buffer);

          if (storedMetadata) {
            await this.redis.set(`${key}:meta`, JSON.stringify(storedMetadata));
          }

          fulfill(null);
        } catch (err) {
          reject(err);
        }
      });

      bodyStream.on('error', (err) => {
        reject(err);
      });
    })
  }
}