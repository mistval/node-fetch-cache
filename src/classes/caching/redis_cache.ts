import assert from 'assert';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
import Redis from 'ioredis';
import type { INodeFetchCacheCache, NFCResponseMetadata } from '../../types';

type StoredMetadata = {
	emptyBody?: boolean;
	expiration?: number | undefined;
} & NFCResponseMetadata;

const emptyBuffer = Buffer.alloc(0);

// Redis Connection Parameters
// redisConnection is any format supported by ioredis
// Eg. redis://<REDIS_USER>:<REDIS_PASSWORD>@<REDIS_HOST>:<REDIS_PORT>
// Leave undefined for localhost:6789

export class RedisCache implements INodeFetchCacheCache {
	private readonly ttl?: number | undefined;
	private readonly redis;
	private readonly redisConnection?: any | undefined;
	private readonly redisOptions?: Record<string, unknown> | undefined;

	constructor(options: { ttl?: number; redisConnection?: any; redisOptions?: Record<string, unknown> } = {}) {
		this.redisConnection = options.redisConnection;
		this.redisOptions = options.redisOptions;

		// Need to test for optional dependencies.
		// let Redis;
		// try {
		//   import {Redis} from 'ioredis';
		// } catch (e) {
		//   console.log('ioredis is not installed. Redis support is disabled.');
		//   console.log('ioredis is not installed. Redis support is disabled.');
		// }

		// Need to test for optional dependencies.
		// let Redis;
		// (async () => {
		//   try {
		//     let { Redis } = await import('ioredis');
		//     console.log('Package exists and can be imported:', Redis);
		//   } catch (error) {
		//     console.error('Error importing package:', error);
		//   }
		// })();

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

		const readableStream = Readable.from([Buffer.from(cachedObjectInfo)]);
		// Do we need to terminate this stream?
		// readableStream.push(null);

		const storedMetadata = await this.redis.get(`${key}:meta`);
		const { emptyBody, expiration, ...nfcMetadata } = storedMetadata;

		if (!options?.ignoreExpiration && expiration && expiration < Date.now()) {
			return undefined;
		}

		if (emptyBody) {
			return {
				bodyStream: Readable.from(emptyBuffer),
				metaData: storedMetadata, // Why returning storedMetaData instread of nfcMetadata?
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
			expiration: undefined as undefined | number,
			emptyBody: false,
		};

		if (typeof this.ttl === 'number') {
			metaToStore.expiration = Date.now() + this.ttl;
		}

		await this.writeDataToRedis(key, metaToStore, bodyStream);

		// const cachedData = await this.redis.get(key);
		const cachedData = await this.get(key, { ignoreExpiration: true });
		assert(cachedData, 'Failed to cache response');

		const cachedMetaData = await this.redis.get(`${key}:meta`);
		assert(cachedMetaData, 'Failed to cache metadata');

		return cachedData;
	}

	private async writeDataToRedis(key: string, storedMetadata: StoredMetadata, bodyStream: NodeJS.ReadableStream) {
		const chunks: any = [];

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
				} catch (error) {
					reject(error);
				}
			});

			bodyStream.on('error', (error) => {
				reject(error);
			});
		});
	}
}
