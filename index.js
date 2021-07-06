import fetch from 'node-fetch';
import fs from 'fs';
import { URLSearchParams } from 'url';
import crypto from 'crypto';
import { NFCResponse } from './classes/response.js';
import { MemoryCache } from './classes/caching/memory_cache.js';

const CACHE_VERSION = 3;

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

// Since the bounday in FormData is random,
// we ignore it for purposes of calculating
// the cache key.
function getFormDataCacheKey(formData) {
  const cacheKey = { ...formData };
  const boundary = formData.getBoundary();

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

function getBodyCacheKeyJson(body) {
  if (!body) {
    return body;
  } if (typeof body === 'string') {
    return body;
  } if (body instanceof URLSearchParams) {
    return body.toString();
  } if (body instanceof fs.ReadStream) {
    return body.path;
  } if (body.toString && body.toString() === '[object FormData]') {
    return getFormDataCacheKey(body);
  }

  throw new Error('Unsupported body type. Supported body types are: string, number, undefined, null, url.URLSearchParams, fs.ReadStream, FormData');
}

function getCacheKey(requestArguments) {
  const resource = requestArguments[0];
  const init = requestArguments[1] || {};

  if (typeof resource !== 'string') {
    throw new Error('The first argument must be a string (fetch.Request is not supported).');
  }

  const resourceCacheKeyJson = { url: resource };
  const initCacheKeyJson = { ...init };

  resourceCacheKeyJson.body = getBodyCacheKeyJson(resourceCacheKeyJson.body);
  initCacheKeyJson.body = getBodyCacheKeyJson(initCacheKeyJson.body);

  delete resourceCacheKeyJson.agent;
  delete initCacheKeyJson.agent;

  return md5(JSON.stringify([resourceCacheKeyJson, initCacheKeyJson, CACHE_VERSION]));
}

async function getResponse(cache, requestArguments) {
  const cacheKey = getCacheKey(requestArguments);
  const cachedValue = await cache.get(cacheKey);

  const ejectSelfFromCache = () => cache.remove(cacheKey);

  if (cachedValue) {
    if (cachedValue.bodyStream.readableEnded) {
      throw new Error('Cache returned a body stream that has already been read to end.');
    }

    return NFCResponse.fromCachedResponse(
      cachedValue.bodyStream,
      cachedValue.metaData,
      ejectSelfFromCache,
    );
  }

  const fetchResponse = await fetch(...requestArguments);
  const nfcResponse = NFCResponse.fromNodeFetchResponse(fetchResponse, ejectSelfFromCache);
  const contentLength = Number.parseInt(nfcResponse.headers.get('content-length'), 10) || 0;
  const nfcResponseSerialized = nfcResponse.serialize();

  await cache.set(
    cacheKey,
    nfcResponseSerialized.bodyStream,
    nfcResponseSerialized.metaData,
    contentLength,
  );

  return nfcResponse;
}

function createFetchWithCache(cache) {
  const fetchCache = (...args) => getResponse(cache, args);
  fetchCache.withCache = createFetchWithCache;

  return fetchCache;
}

const defaultFetch = createFetchWithCache(new MemoryCache());

export default defaultFetch;
export const fetchBuilder = defaultFetch;
export { MemoryCache } from './classes/caching/memory_cache.js';
export { FileSystemCache } from './classes/caching/file_system_cache.js';
