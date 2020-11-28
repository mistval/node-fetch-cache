const fetch = require('node-fetch');
const fs = require('fs');
const { URLSearchParams } = require('url');
const crypto = require('crypto');
const path = require('path');

const Response = require('./classes/response.js');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
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
  }

  throw new Error('Unsupported body type');
}

function getCacheKey(requestArguments) {
  const resource = requestArguments[0];
  const init = requestArguments[1] || {};

  const resourceCacheKeyJson = typeof resource === 'string' ? { url: resource } : { ...resource };
  const initCacheKeyJson = { ...init };

  resourceCacheKeyJson.body = getBodyCacheKeyJson(resourceCacheKeyJson.body);
  initCacheKeyJson.body = getBodyCacheKeyJson(initCacheKeyJson.body);

  return md5(JSON.stringify([resourceCacheKeyJson, initCacheKeyJson]));
}

async function createRawResponse(fetchRes) {
  const buffer = await fetchRes.buffer();

  const rawHeaders = Array.from(fetchRes.headers.entries())
    .reduce((aggregate, entry) => ({ ...aggregate, [entry[0]]: entry[1] }), {});

  return {
    status: fetchRes.status,
    statusText: fetchRes.statusText,
    type: fetchRes.type,
    url: fetchRes.url,
    ok: fetchRes.ok,
    headers: rawHeaders,
    redirected: fetchRes.redirected,
    bodyBuffer: buffer,
  };
}

async function getResponse(cacheDirPath, requestArguments) {
  const cacheKey = getCacheKey(requestArguments);
  const cachedFilePath = path.join(cacheDirPath, `${cacheKey}.json`);

  try {
    const rawResponse = JSON.parse(await fs.promises.readFile(cachedFilePath));
    return new Response(rawResponse, cachedFilePath, true);
  } catch (err) {
    const fetchResponse = await fetch(...requestArguments);
    const rawResponse = await createRawResponse(fetchResponse);
    await fs.promises.writeFile(cachedFilePath, JSON.stringify(rawResponse));
    return new Response(rawResponse, cachedFilePath, false);
  }
}

function createFetch(cacheDirPath) {
  let madeDir = false;

  return async (...args) => {
    if (!madeDir) {
      await fs.promises.mkdir(cacheDirPath, { recursive: true });
      madeDir = true;
    }

    return getResponse(cacheDirPath, args);
  };
}

module.exports = createFetch;
