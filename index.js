const fetch = require('node-fetch');
const fs = require('fs');
const { URLSearchParams } = require('url');
const crypto = require('crypto');
const Response = require('./classes/response.js');
const MemoryCache = require('./classes/caching/memory_cache.js');
const FileSystemCache = require('./classes/caching/file_system_cache.js');

const CACHE_VERSION = 2;

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

  return md5(JSON.stringify([resourceCacheKeyJson, initCacheKeyJson, CACHE_VERSION]));
}

async function createRawResponse(fetchRes) {
  const buffer = await fetchRes.buffer();

  return {
    status: fetchRes.status,
    statusText: fetchRes.statusText,
    type: fetchRes.type,
    url: fetchRes.url,
    ok: fetchRes.ok,
    headers: fetchRes.headers.raw(),
    redirected: fetchRes.redirected,
    bodyBuffer: buffer,
  };
}

async function getResponse(cache, requestArguments) {
  const cacheKey = getCacheKey(requestArguments);
  const cachedValue = await cache.get(cacheKey);

  const ejectSelfFromCache = () => cache.remove(cacheKey);

  if (cachedValue) {
    return new Response(cachedValue, ejectSelfFromCache, true);
  }

  const fetchResponse = await fetch(...requestArguments);
  const rawResponse = await createRawResponse(fetchResponse);
  await cache.set(cacheKey, rawResponse);
  return new Response(rawResponse, ejectSelfFromCache, false);
}

function createFetchWithCache(cache) {
  const fetchCache = (...args) => getResponse(cache, args);
  fetchCache.withCache = createFetchWithCache;

  return fetchCache;
}

const defaultFetch = createFetchWithCache(new MemoryCache());

module.exports = defaultFetch;
module.exports.fetchBuilder = defaultFetch;
module.exports.MemoryCache = MemoryCache;
module.exports.FileSystemCache = FileSystemCache;
