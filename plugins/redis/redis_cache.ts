import { Buffer } from 'buffer';
import { Readable } from 'stream';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { INodeFetchCacheCache, NFCResponseMetadata } from 'node-fetch-cache';

type StoredMetadata = {
  expiration?: number | undefined;
} & NFCResponseMetadata;

type ExtendedRedisOptions = {
  ttl?: number | undefined;
} & RedisOptions;

// Redis Connection Parameters
// add host, port or path as options to set database.
// additionally, set `ttl` for a default expiry
// Leave host, port or path undefined for localhost:6379

export class RedisCache implements INodeFetchCacheCache {
  private readonly ttl?: number | undefined;
  private readonly redis: Redis;
  private readonly redisOptions: RedisOptions = {};

  constructor(options: ExtendedRedisOptions = {}, redisInstance?: Redis) {
    this.redisOptions = options ?? {};
    this.ttl = options?.ttl;
    this.redis = redisInstance ?? new Redis(this.redisOptions);
  }

  async get(key: string) {
    const cachedObjectInfo = await this.redis.getBuffer(key);

    if (cachedObjectInfo === null) {
      return undefined;
    }

    const readableStream = Readable.from(cachedObjectInfo);
    const storedMetadata = await this.redis.get(`${key}:meta`);

    if (!storedMetadata) {
      return undefined;
    }

    const storedMetadataJson = JSON.parse(storedMetadata) as StoredMetadata;
    const { expiration, ...nfcMetadata } = storedMetadataJson;

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
      expiration: undefined as undefined | number,
    };

    if (typeof this.ttl === 'number') {
      metaToStore.expiration = Date.now() + this.ttl;
    }

    const buffer: Buffer = await new Promise((fulfill, reject) => {
      const chunks: Buffer[] = [];

      bodyStream.on('data', chunk => {
        chunks.push(chunk as Buffer);
      });

      bodyStream.on('end', async () => {
        try {
          fulfill(Buffer.concat(chunks));
        } catch (error) {
          reject(error);
        }
      });

      bodyStream.on('error', error => {
        reject(error);
      });
    });

    await (typeof this.ttl === 'number' ? this.redis.set(key, buffer, 'PX', this.ttl) : this.redis.set(key, buffer));

    if (metaToStore) {
      await (typeof this.ttl === 'number' ? this.redis.set(`${key}:meta`, JSON.stringify(metaToStore), 'PX', this.ttl) : this.redis.set(`${key}:meta`, JSON.stringify(metaToStore)));
    }

    return {
      bodyStream: Readable.from(buffer),
      metaData: metaToStore,
    };
  }
}
