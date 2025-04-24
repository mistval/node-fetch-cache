import { ReadableStream } from "stream/web";
import assert from 'assert';
import { FormData } from 'formdata-node';
import { getNFCResponseClass as getNFCResponseClass } from './classes/response.js';
import { MemoryCache } from './classes/caching/memory_cache.js';
import { calculateCacheKey } from './helpers/cache_keys.js';
import { cacheNon5xxOnly, cacheOkayOnly } from './helpers/cache_strategies.js';
import { hasOnlyIfCachedOption } from './helpers/headers.js';
import { shimResponseToSnipeBody } from './helpers/shim_response_to_snipe_body.js';
import { LockoSynchronizationStrategy } from './classes/locko_synchronization_strategy.js';
import type {
  CacheStrategy,
  FetchInit,
  FetchResource,
  INodeFetchCacheCache,
  ISynchronizationStrategy,
} from './types.js';

type CacheKeyCalculator = typeof calculateCacheKey;

type NFCCustomizations = {
  cache: INodeFetchCacheCache;
  synchronizationStrategy: ISynchronizationStrategy;
  calculateCacheKey: CacheKeyCalculator;
  shouldCacheResponse: CacheStrategy;
};

type NFCOptions = Partial<NFCCustomizations>;

async function getUrlFromRequestArguments(resource: Request | string) {
  if (resource instanceof Request) {
    return resource.url;
  }

  return resource;
}

async function getResponse(
  fetchCustomization: NFCCustomizations,
  resource: FetchResource,
  init: FetchInit,
) {
  const originalResource = resource;

  const NFCResponse = await getNFCResponseClass();

  if (typeof resource !== 'string' && !(resource instanceof Request)) {
    throw new TypeError(
      'The first argument to fetch must be either a string or a fetch Request instance',
    );
  }

  if (originalResource instanceof Request) {
    resource = originalResource.clone()
  }

  const cacheKey = await fetchCustomization.calculateCacheKey(resource, init);
  const ejectSelfFromCache = async () => fetchCustomization.cache.remove(cacheKey);

  const cachedValue = await fetchCustomization.cache.get(cacheKey);
  if (cachedValue) {
    return new NFCResponse(
      cachedValue.bodyStream,
      cachedValue.metaData,
      ejectSelfFromCache,
      true,
    );
  }

  if (await hasOnlyIfCachedOption(resource, init)) {
    return NFCResponse.cacheMissResponse(
      await getUrlFromRequestArguments(resource),
    );
  }

  return fetchCustomization.synchronizationStrategy.doWithExclusiveLock(cacheKey, async () => {
    const cachedValue = await fetchCustomization.cache.get(cacheKey);
    if (cachedValue) {
      return new NFCResponse(
        cachedValue.bodyStream,
        cachedValue.metaData,
        ejectSelfFromCache,
        true,
      );
    }

    if (originalResource instanceof Request) {
      resource = originalResource.clone()
    }
    
    const fetchResponse = await fetch(resource, init);
    const serializedMeta = NFCResponse.serializeMetaFromNodeFetchResponse(fetchResponse);
    let bodyStream = fetchResponse.body;
    assert(bodyStream, 'No body stream found in fetch response');

    shimResponseToSnipeBody(fetchResponse, stream => {
      bodyStream = stream;
    });

    const shouldCache = await fetchCustomization.shouldCacheResponse(fetchResponse);

    if (shouldCache) {
      const cacheSetResult = await fetchCustomization.cache.set(
        cacheKey,
        bodyStream as Omit<ReadableStream<any>, "closed">,
        serializedMeta,
      );

      bodyStream = cacheSetResult.bodyStream;
    }

    return new NFCResponse(
      bodyStream as Omit<ReadableStream<any>, "closed">,
      serializedMeta,
      ejectSelfFromCache,
      false,
    );
  });
}

const globalMemoryCache = new MemoryCache();

function create(creationOptions: NFCOptions) {
  const fetchOptions: NFCCustomizations = {
    cache: creationOptions.cache ?? globalMemoryCache,
    synchronizationStrategy: creationOptions.synchronizationStrategy ?? new LockoSynchronizationStrategy(),
    shouldCacheResponse: creationOptions.shouldCacheResponse ?? (() => Promise.resolve(true)),
    calculateCacheKey: creationOptions.calculateCacheKey ?? calculateCacheKey,
  };

  const fetchCache = async (
    resource: FetchResource,
    init?: FetchInit,
    perRequestOptions?: NFCOptions,
  ) => getResponse(
    { ...fetchOptions, ...perRequestOptions },
    resource,
    init,
  );

  fetchCache.create = create;
  fetchCache.options = fetchOptions;

  return fetchCache;
}

const defaultFetch = create({});
const cacheStrategies = {
  cacheOkayOnly,
  cacheNon5xxOnly,
};

export default defaultFetch;
export { MemoryCache } from './classes/caching/memory_cache.js';
export { FileSystemCache } from './classes/caching/file_system_cache.js';
export { CACHE_VERSION } from './helpers/cache_keys.js';
export type { NFCResponse } from './classes/response.js';
export type { NFCResponseMetadata } from './types.js';
export {
  defaultFetch as NodeFetchCache,
  cacheStrategies,
  calculateCacheKey as getCacheKey,
  calculateCacheKey,
  FormData,
  type NFCOptions,
  type CacheKeyCalculator,
  type INodeFetchCacheCache,
  type FetchResource,
  type FetchInit,
  type ISynchronizationStrategy,
};
