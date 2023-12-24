import fetch, { Request } from 'node-fetch';
import locko from 'locko';
import { NFCResponse } from './classes/response.js';
import { MemoryCache } from './classes/caching/memory_cache.js';
import { type INodeFetchCacheCache } from './classes/caching/cache.js';
import type { CacheStrategy, FetchInit, FetchResource } from './types.js';
import { getCacheKey } from './helpers/cache_keys.js';

type FetchCustomization = {
  cache: INodeFetchCacheCache;
  cacheStrategy: CacheStrategy;
};

type FetchOptions = Partial<FetchCustomization>;

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

async function getResponse(fetchCustomization: FetchCustomization, requestArguments: Parameters<typeof fetch>) {
  const cacheKey = getCacheKey(...requestArguments);
  let cachedValue = await fetchCustomization.cache.get(cacheKey);

  const ejectSelfFromCache = async () => fetchCustomization.cache.remove(cacheKey);

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
    cachedValue = await fetchCustomization.cache.get(cacheKey);
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

    const responseClone = fetchResponse.clone();
    const cache = await fetchCustomization.cacheStrategy(responseClone);

    if (cache) {
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

function create(options: FetchOptions) {
  const fetchCustomization = {
    cache: options.cache ?? globalMemoryCache,
    cacheStrategy: options.cacheStrategy ?? (() => true),
  };

  const fetchCache = async (...args: Parameters<typeof fetch>) => getResponse(fetchCustomization, args);
  fetchCache.create = create;

  return fetchCache;
}

const defaultFetch = create({ cache: globalMemoryCache });

export default defaultFetch;
export { MemoryCache } from './classes/caching/memory_cache.js';
export { FileSystemCache } from './classes/caching/file_system_cache.js';
