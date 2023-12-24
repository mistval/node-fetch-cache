import fetch, { Request } from 'node-fetch';
import locko from 'locko';
import { NFCResponse } from './classes/response.js';
import { MemoryCache } from './classes/caching/memory_cache.js';
import { type INodeFetchCacheCache } from './classes/caching/cache.js';
import type { FetchInit, FetchResource } from './types.js';
import { getCacheKey } from './helpers/cache_keys.js';

/* B
type FetchOptions = {
  cache?: INodeFetchCacheCache;
  cacheStrategy?: CacheStrategy;
};
*/

function hasOnlyWithCacheOption(resource: FetchResource, init: FetchInit) {
  if (
    Object.entries(init?.headers ?? {})
      .some(([key, value]) => key.toLowerCase() === 'cache-control' && value === 'only-if-cached')
  ) {
    return true;
  }

  if (resource instanceof Request && resource.headers.get('Cache-Control') === 'only-if-cached') {
    return true;
  }

  return false;
}

function getUrlFromRequestArguments(...args: Parameters<typeof fetch>) {
  const [resource] = args;

  if (resource instanceof Request) {
    return resource.url;
  }

  if (typeof resource === 'string') {
    return resource;
  }

  throw new Error('Unsupported resource type. Supported resource types are: string, Request');
}

async function getResponse(cache: INodeFetchCacheCache, requestArguments: Parameters<typeof fetch>) {
  const cacheKey = getCacheKey(...requestArguments);
  let cachedValue = await cache.get(cacheKey);

  const ejectSelfFromCache = async () => cache.remove(cacheKey);

  if (cachedValue) {
    return new NFCResponse(
      cachedValue.bodyStream,
      cachedValue.metaData,
      ejectSelfFromCache,
      true,
    );
  }

  if (hasOnlyWithCacheOption(...requestArguments)) {
    return NFCResponse.cacheMissResponse(
      getUrlFromRequestArguments(...requestArguments),
    );
  }

  return locko.doWithLock(cacheKey, async () => {
    cachedValue = await cache.get(cacheKey);
    if (cachedValue) {
      return new NFCResponse(
        cachedValue.bodyStream,
        cachedValue.metaData,
        ejectSelfFromCache,
        true,
      );
    }

    const fetchResponse = await fetch(...requestArguments);
    const serializedMeta = NFCResponse.serializeMetaFromNodeFetchResponse(fetchResponse);

    const newlyCachedData = await cache.set(
      cacheKey,
      fetchResponse.body,
      serializedMeta,
    );

    return new NFCResponse(
      newlyCachedData.bodyStream,
      newlyCachedData.metaData,
      ejectSelfFromCache,
      false,
    );
  });
}

function createFetchWithCache(cache: INodeFetchCacheCache) {
  const fetchCache = async (...args: Parameters<typeof fetch>) => getResponse(cache, args);
  fetchCache.withCache = createFetchWithCache;

  return fetchCache;
}

const defaultFetch = createFetchWithCache(new MemoryCache());

export default defaultFetch;
export const fetchBuilder = defaultFetch;
export { MemoryCache } from './classes/caching/memory_cache.js';
export { FileSystemCache } from './classes/caching/file_system_cache.js';
