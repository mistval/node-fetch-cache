import assert from 'assert';
import { Buffer } from 'buffer';
import { Readable } from 'stream';
// Import Redis from 'ioredis';
// import type { RedisOptions } from 'ioredis';
import type { INodeFetchCacheCache, NFCResponseMetadata } from '../../types';

let module;
try {
	// @ts-expect-error 2307
	module = await import('ioredis');
} catch {
	console.warn('redis_cache: ioredis is not installed.');
}

const Redis = module?.default;
type RedisOptions = typeof module.RedisOptions;

type StoredMetadata = {
	emptyBody?: boolean | undefined;
	expiration?: number | undefined;
} & NFCResponseMetadata;

type extendedRedisOptions = {
	ttl?: number | undefined;
} & RedisOptions;

const emptyBuffer = Buffer.alloc(0);

// Redis Connection Parameters
// add host, port or path as options to set database.
// additionally, set `ttl` for a default expiry
// Leave host, port or path undefined for localhost:6379

export class RedisCache implements INodeFetchCacheCache {
	private readonly ttl?: number | undefined;
	private readonly redis: any;
	private readonly redisOptions: RedisOptions = {};

	constructor(options: extendedRedisOptions = {}, redisInstance?: typeof Redis) {
		this.redisOptions = options ? options : {};
		this.ttl = options?.ttl;
		if (Redis) {
			this.redis = redisInstance || new Redis(this.redisOptions);
		}
	}

	async get(key: string, options?: { ignoreExpiration?: boolean }) {
		if (!this.redis) {
			return undefined;
		}

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
		if (!this.redis) {
			return undefined;
		}

		const metaToStore = {
			...metaData,
			expiration: undefined as undefined | number,
			emptyBody: false,
		};

		if (typeof this.ttl === 'number') {
			metaToStore.expiration = Date.now() + this.ttl;
		}

		await this.writeDataToRedis(key, metaToStore, bodyStream);

		const cachedData = await this.get(key, { ignoreExpiration: true });
		assert(cachedData, 'Failed to cache response');

		const cachedMetaData = await this.redis?.get(`${key}:meta`);
		assert(cachedMetaData, 'Failed to cache metadata');

		return cachedData;
	}

	private async writeDataToRedis(key: string, storedMetadata: StoredMetadata, bodyStream: NodeJS.ReadableStream) {
		const chunks: any = [];

		await new Promise((fulfill, reject) => {
			bodyStream.on('data', chunk => {
				chunks.push(chunk);
			});

			bodyStream.on('end', async () => {
				try {
					const buffer = Buffer.concat(chunks);

					await (typeof this.ttl === 'number' ? this.redis?.set(key, buffer, 'PX', this.ttl) : this.redis?.set(key, buffer));

					if (storedMetadata) {
						await (typeof this.ttl === 'number' ? this.redis?.set(`${key}:meta`, JSON.stringify(storedMetadata), 'PX', this.ttl) : this.redis?.set(`${key}:meta`, JSON.stringify(storedMetadata)));
					}

					fulfill(null);
				} catch (error) {
					reject(error);
				}
			});

			bodyStream.on('error', error => {
				reject(error);
			});
		});
	}
}
