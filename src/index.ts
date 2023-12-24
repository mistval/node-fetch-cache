import fetch, { Request } from 'node-fetch';
import locko from 'locko';
import { NFCResponse } from './classes/response.js';
import { MemoryCache } from './classes/caching/memory_cache.js';
import type { CacheStrategy, FetchInit, FetchResource, INodeFetchCacheCache } from './types.js';
import { calculateCacheKey } from './helpers/cache_keys.js';
import { cacheNon5xxOnly, cacheOkayOnly } from './helpers/cache_strategies.js';

type FetchCustomization = {
  cache: INodeFetchCacheCache;
  calculateCacheKey: typeof calculateCacheKey;
  shouldCacheResponse: CacheStrategy;
};

type FetchOptions = Partial<FetchCustomization>;

function headerKeyIsCacheControl(key: string) {
  return key.trim().toLowerCase() === 'cache-control';
}

function headerValueContainsOnlyIfCached(cacheControlValue: string | undefined) {
  return cacheControlValue
    ?.split?.(',')
    .map(d => d.trim().toLowerCase())
    .includes('only-if-cached');
}

function hasOnlyWithCacheOption(resource: FetchResource, init: FetchInit) {
  if (
    Object.entries(init?.headers ?? {})
      .some(
        ([key, value]) => headerKeyIsCacheControl(key) && headerValueContainsOnlyIfCached(value as string | undefined),
      )
  ) {
    return true;
  }

  if (resource instanceof Request && headerValueContainsOnlyIfCached(resource.headers.get('Cache-Control') ?? undefined)) {
    return true;
  }

  return false;
}

function getUrlFromRequestArguments(resource: Request | string) {
  if (resource instanceof Request) {
    return resource.url;
  }

  return resource;
}

async function getResponse(fetchCustomization: FetchCustomization, resource: FetchResource, init: FetchInit) {
  if (typeof resource !== 'string' && !(resource instanceof Request)) {
    throw new TypeError('The first argument to fetch must be either a string or a node-fetch Request instance');
  }

  const cacheKey = fetchCustomization.calculateCacheKey(resource, init);

  const ejectSelfFromCache = async () => fetchCustomization.cache.remove(cacheKey);

  return locko.doWithLock(cacheKey, async () => {
    const cachedValue = await fetchCustomization.cache.get(cacheKey);
    if (cachedValue) {
      return new NFCResponse(
        cachedValue.bodyStream,
        cachedValue.metaData,
        ejectSelfFromCache,
        true,
      );
    }

    if (hasOnlyWithCacheOption(resource, init)) {
      return NFCResponse.cacheMissResponse(
        getUrlFromRequestArguments(resource),
      );
    }

    const fetchResponse = await fetch(resource, init);
    const serializedMeta = NFCResponse.serializeMetaFromNodeFetchResponse(fetchResponse);

    const responseClone = fetchResponse.clone();
    const shouldCache = await fetchCustomization.shouldCacheResponse(responseClone);

    if (shouldCache) {
      await fetchCustomization.cache.set(
        cacheKey,
        (responseClone.bodyUsed ? fetchResponse.clone() : responseClone).body,
        serializedMeta,
      );
    }

    return new NFCResponse(
      fetchResponse.body,
      serializedMeta,
      ejectSelfFromCache,
      false,
    );
  });
}

const globalMemoryCache = new MemoryCache();

function create(creationOptions: FetchOptions) {
  const fetchOptions = {
    cache: creationOptions.cache ?? globalMemoryCache,
    shouldCacheResponse: creationOptions.shouldCacheResponse ?? (() => true),
    calculateCacheKey: creationOptions.calculateCacheKey ?? calculateCacheKey,
  };

  const fetchCache = async (
    resource: FetchResource,
    init?: FetchInit,
    perRequestOptions?: FetchOptions,
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
export { calculateCacheKey, calculateCacheKey as getCacheKey, CACHE_VERSION } from './helpers/cache_keys.js';
export type { FetchResource, FetchInit } from './types.js';
export type { NFCResponse } from './classes/response.js';
export { cacheStrategies };
