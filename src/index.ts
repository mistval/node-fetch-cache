import fs from 'fs';
import { Buffer } from 'buffer';
import crypto from 'crypto';
import fetch, { Request } from 'node-fetch';
import locko from 'locko';
import FormData from 'form-data';
import { NFCResponse } from './classes/response.js';
import { MemoryCache } from './classes/caching/memory_cache.js';
import { type INodeFetchCacheCache } from './classes/caching/cache.js';

type FetchResource = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

type FormDataInternal = {
  _boundary?: string;
  _streams: Array<string | fs.ReadStream>;
} & FormData;

const CACHE_VERSION = 5;

function md5(string_: string) {
  return crypto.createHash('md5').update(string_).digest('hex');
}

// Since the bounday in FormData is random,
// we ignore it for purposes of calculating
// the cache key.
function getFormDataCacheKey(formData: FormData) {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const cacheKey = { ...formData } as FormDataInternal;
  const boundary = formData.getBoundary();

  // TODO: Check if this property actually exists

  delete cacheKey._boundary;

  const boundaryReplaceRegex = new RegExp(boundary, 'g');

  cacheKey._streams = cacheKey._streams.map(s => {
    if (typeof s === 'string') {
      return s.replace(boundaryReplaceRegex, '');
    }

    return s;
  });

  return cacheKey;
}

function getHeadersCacheKeyJson(headers: string[][]): string[][] {
  return headers
    .map(([key, value]) => [key!.toLowerCase(), value!])
    .filter(([key, value]) => key !== 'cache-control' || value !== 'only-if-cached');
}

function getBodyCacheKeyJson(body: any): string | FormDataInternal | undefined {
  if (!body) {
    return undefined;
  }

  if (typeof body === 'string') {
    return body;
  }

  if (body instanceof URLSearchParams) {
    return body.toString();
  }

  if (body instanceof fs.ReadStream) {
    return body.path.toString();
  }

  if (body instanceof FormData) {
    return getFormDataCacheKey(body);
  }

  if (body instanceof Buffer) {
    return body.toString();
  }

  throw new Error('Unsupported body type. Supported body types are: string, number, undefined, null, url.URLSearchParams, fs.ReadStream, FormData');
}

function getRequestCacheKey(request: Request) {
  return {
    headers: getHeadersCacheKeyJson([...request.headers.entries()]),
    method: request.method,
    redirect: request.redirect,
    referrer: request.referrer,
    url: request.url,
    body: getBodyCacheKeyJson(request.body),
  };
}

export function getCacheKey(resource: FetchResource, init?: FetchInit) {
  const resourceCacheKeyJson = resource instanceof Request
    ? getRequestCacheKey(resource)
    : { url: resource, body: undefined };

  const initCacheKeyJson = {
    body: undefined as (undefined | string | FormDataInternal),
    ...init,
    headers: getHeadersCacheKeyJson(Object.entries(init?.headers ?? {})),
  };

  resourceCacheKeyJson.body = getBodyCacheKeyJson(resourceCacheKeyJson.body);
  initCacheKeyJson.body = getBodyCacheKeyJson(initCacheKeyJson.body);

  delete initCacheKeyJson.agent;

  return md5(JSON.stringify([resourceCacheKeyJson, initCacheKeyJson, CACHE_VERSION]));
}

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
