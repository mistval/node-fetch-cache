import assert from 'assert';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
import Redis from 'ioredis';
import type { RedisOptions } from 'ioredis';
import type { INodeFetchCacheCache, NFCResponseMetadata } from '../../types';

type StoredMetadata = {
	emptyBody?: boolean | undefined;
	expiration?: number | undefined;
} & NFCResponseMetadata;

type extendedRedisOptions = {
	ttl?: number | undefined;
} & RedisOptions

const emptyBuffer = Buffer.alloc(0);

// Redis Connection Parameters
// add host, port or path as options to set database.
// additionally, set `ttl` for a default expiry
// Leave host, port or path undefined for localhost:6379

export class RedisCache implements INodeFetchCacheCache {
	private readonly ttl?: number | undefined;
	private readonly redis;
	private readonly redisOptions: RedisOptions = {};

	constructor(options: extendedRedisOptions = {}) {
		this.redisOptions = options ? options : {};

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
			this.redis = new Redis(this.redisOptions);
		}

		this.ttl = options?.ttl;
	}

	async get(key: string, options?: { ignoreExpiration?: boolean }) {
		const cachedObjectInfo = await this.redis?.get(key);

		if (!cachedObjectInfo) {
			return undefined;
		}

		const readableStream = Readable.from([Buffer.from(cachedObjectInfo)]);
		// Do we need to terminate this stream?
		// readableStream.push(null);

		const storedMetadata = await this.redis?.get(`${key}:meta`);

		if (!storedMetadata) {
			return undefined;
		}

		const storedMetadataJson = JSON.parse(storedMetadata) as StoredMetadata;
		const { emptyBody, expiration, ...nfcMetadata } = storedMetadataJson;

		if (!options?.ignoreExpiration && expiration && expiration < Date.now()) {
			return undefined;
		}

		if (emptyBody) {
			return {
				bodyStream: Readable.from(emptyBuffer),
				metaData: nfcMetadata,
			};
		}

		return {
			bodyStream: readableStream,
			metaData: nfcMetadata,
		};
	}

	async remove(key: string) {
		await this.redis?.del(key);
		await this.redis?.del(`${key}:meta`);
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

		const cachedMetaData = await this.redis?.get(`${key}:meta`);
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

					if (typeof this.ttl === 'number') {
						await this.redis?.set(key, buffer, "PX", this.ttl);
					} else {
						await this.redis?.set(key, buffer);
					}

					if (storedMetadata) {
						if (typeof this.ttl === 'number') {
							await this.redis?.set(`${key}:meta`, JSON.stringify(storedMetadata), "PX", this.ttl);
						} else {
							await this.redis?.set(`${key}:meta`, JSON.stringify(storedMetadata));
						}
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
