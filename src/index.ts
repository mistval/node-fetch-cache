import fetch, { Request as NodeFetchRequest } from 'node-fetch';
import FormData from 'form-data';
import locko from 'locko';
import { NFCResponse } from './classes/response.js';
import { MemoryCache } from './classes/caching/memory_cache.js';
import type { CacheStrategy, FetchInit, FetchResource, INodeFetchCacheCache } from './types.js';
import { calculateCacheKey } from './helpers/cache_keys.js';
import { cacheNon5xxOnly, cacheOkayOnly } from './helpers/cache_strategies.js';
import { hasOnlyIfCachedOption } from './helpers/headers.js';
import { shimResponseToSnipeBody } from './helpers/shim_response_to_snipe_body.js';

type CacheKeyCalculator = typeof calculateCacheKey;

type NFCCustomizations = {
  cache: INodeFetchCacheCache;
  calculateCacheKey: CacheKeyCalculator;
  shouldCacheResponse: CacheStrategy;
};

type NFCOptions = Partial<NFCCustomizations>;

function getUrlFromRequestArguments(resource: NodeFetchRequest | string) {
  if (resource instanceof NodeFetchRequest) {
    return resource.url;
  }

  return resource;
}

async function getResponse(
  fetchCustomization: NFCCustomizations,
  resource: FetchResource,
  init: FetchInit,
) {
  if (typeof resource !== 'string' && !(resource instanceof NodeFetchRequest)) {
    throw new TypeError(
      'The first argument to fetch must be either a string or a node-fetch Request instance',
    );
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

    if (hasOnlyIfCachedOption(resource, init)) {
      return NFCResponse.cacheMissResponse(
        getUrlFromRequestArguments(resource),
      );
    }

    const fetchResponse = await fetch(resource, init);
    const serializedMeta = NFCResponse.serializeMetaFromNodeFetchResponse(fetchResponse);
    let bodyStream = fetchResponse.body;

    shimResponseToSnipeBody(fetchResponse, stream => {
      bodyStream = stream;
    });

    const shouldCache = await fetchCustomization.shouldCacheResponse(fetchResponse);

    if (shouldCache) {
      const cacheSetResult = await fetchCustomization.cache.set(
        cacheKey,
        bodyStream,
        serializedMeta,
      );

      bodyStream = cacheSetResult.bodyStream;
    }

    return new NFCResponse(
      bodyStream,
      serializedMeta,
      ejectSelfFromCache,
      false,
    );
  });
}

const globalMemoryCache = new MemoryCache();

function create(creationOptions: NFCOptions) {
  const fetchOptions = {
    cache: creationOptions.cache ?? globalMemoryCache,
    shouldCacheResponse: creationOptions.shouldCacheResponse ?? (() => true),
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
  NodeFetchRequest,
  type NFCOptions,
  type CacheKeyCalculator,
  type INodeFetchCacheCache,
  type FetchResource,
  type FetchInit,
};
