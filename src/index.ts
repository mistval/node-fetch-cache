import fetch, { Request } from 'node-fetch';
import fs from 'fs';
import crypto from 'crypto';
import locko from 'locko';
import type FormData from 'form-data';
import { NFCResponse } from './classes/response.js';
import { MemoryCache } from './classes/caching/memory_cache.js';
import { INodeFetchCacheCache } from './classes/caching/cache.js';

type FetchResource = Parameters<typeof fetch>[0];
type FetchInit = Parameters<typeof fetch>[1];

interface FormDataInternal extends FormData {
  _boundary?: string;
  _streams: (string | fs.ReadStream)[];
}

interface RequestInternal extends Request {
  cache: any;
  credentials: any;
  destination: any;
  integrity: any;
  referrerPolicy: any;
}

const CACHE_VERSION = 5;

function md5(str: string) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Since the bounday in FormData is random,
// we ignore it for purposes of calculating
// the cache key.
function getFormDataCacheKey(formData: FormData) {
  const cacheKey = { ...formData } as FormDataInternal;
  const boundary = formData.getBoundary();

  // TODO: Check if this property actually exists
  // eslint-disable-next-line no-underscore-dangle
  delete cacheKey._boundary;

  const boundaryReplaceRegex = new RegExp(boundary, 'g');

  // eslint-disable-next-line no-underscore-dangle
  cacheKey._streams = cacheKey._streams.map((s) => {
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

function getBodyCacheKeyJson(body: any): string | FormDataInternal | undefined | null {
  if (!body) {
    return body;
  } if (typeof body === 'string') {
    return body;
  } if (body instanceof URLSearchParams) {
    return body.toString();
  } if (body instanceof fs.ReadStream) {
    return body.path.toString();
  } if (body.toString && body.toString() === '[object FormData]') {
    return getFormDataCacheKey(body);
  } if (body instanceof Buffer) {
    return body.toString();
  }

  throw new Error('Unsupported body type. Supported body types are: string, number, undefined, null, url.URLSearchParams, fs.ReadStream, FormData');
}

function getRequestCacheKey(req: RequestInternal) {
  return {
    cache: req.cache,
    credentials: req.credentials,
    destination: req.destination,
    headers: getHeadersCacheKeyJson([...req.headers.entries()]),
    integrity: req.integrity,
    method: req.method,
    redirect: req.redirect,
    referrer: req.referrer,
    referrerPolicy: req.referrerPolicy,
    url: req.url,
    body: getBodyCacheKeyJson(req.body),
  };
}

export function getCacheKey(resource: FetchResource, init?: FetchInit) {
  const resourceCacheKeyJson = resource instanceof Request
    ? getRequestCacheKey(resource as RequestInternal)
    : { url: resource, body: undefined};

  const initCacheKeyJson = {
    body: undefined as (undefined | null | string | FormDataInternal),
    ...init,
    headers: getHeadersCacheKeyJson(Object.entries(init?.headers || {})),
  };

  resourceCacheKeyJson.body = getBodyCacheKeyJson(resourceCacheKeyJson.body);
  initCacheKeyJson.body = getBodyCacheKeyJson(initCacheKeyJson.body);

  delete initCacheKeyJson.agent;

  return md5(JSON.stringify([resourceCacheKeyJson, initCacheKeyJson, CACHE_VERSION]));
}

function hasOnlyWithCacheOption(resource: FetchResource, init: FetchInit) {
  if (
    init
    && init.headers
    && Object.entries(init.headers)
      .some(([key, value]) => key.toLowerCase() === 'cache-control' && value === 'only-if-cached')
  ) {
    return true;
  }

  if (resource instanceof Request && resource.headers.get('Cache-Control') === 'only-if-cached') {
    return true;
  }

  return false;
}

async function getResponse(cache: INodeFetchCacheCache, requestArguments: Parameters<typeof fetch>) {
  const cacheKey = getCacheKey(...requestArguments);
  let cachedValue = await cache.get(cacheKey);

  const ejectSelfFromCache = () => cache.remove(cacheKey);

  if (cachedValue) {
    return new NFCResponse(
      cachedValue.bodyStream,
      cachedValue.metaData,
      ejectSelfFromCache,
      true,
    );
  }

  if (hasOnlyWithCacheOption(...requestArguments)) {
    return undefined;
  }

  return await locko.doWithLock(cacheKey, async () => {
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
  const fetchCache = (...args: Parameters<typeof fetch>) => getResponse(cache, args);
  fetchCache.withCache = createFetchWithCache;

  return fetchCache;
}

const defaultFetch = createFetchWithCache(new MemoryCache());

export default defaultFetch;
export const fetchBuilder = defaultFetch;
export { MemoryCache } from './classes/caching/memory_cache.js';
export { FileSystemCache } from './classes/caching/file_system_cache.js';
