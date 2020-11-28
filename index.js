const fetch = require('node-fetch');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

class Response {
  constructor(raw, cacheFilePath) {
    Object.assign(this, raw);
    this.cacheFilePath = cacheFilePath;
  }

  text() {
    return this.bodyBuffer.toString();
  }

  json() {
    return JSON.parse(this.bodyBuffer.toString());
  }

  buffer() {
    return this.bodyBuffer;
  }

  ejectFromCache() {
    return fs.promises.unlink(this.cacheFilePath);
  }
}

async function createRawResponse(fetchRes) {
  const buffer = await fetchRes.buffer();

  return {
    status: fetchRes.status,
    statusText: fetchRes.statusText,
    type: fetchRes.type,
    url: fetchRes.url,
    useFinalURL: fetchRes.useFinalURL,
    ok: fetchRes.ok,
    headers: fetchRes.headers,
    redirected: fetchRes.redirected,
    bodyBuffer: buffer,
  };
}

async function getResponse(cacheDirPath, requestArguments) {
  const [url, requestInit, ...rest] = requestArguments;
  const requestParams = requestInit.body
    ? ({ ...requestInit, body: typeof requestInit.body === 'object' ? requestInit.body.toString() : requestInit.body })
    : requestInit;

  const cacheHash = md5(JSON.stringify([url, requestParams, ...rest]) + bodyFunctionName);
  const cachedFilePath = path.join(cacheDirPath, `${cacheHash}.json`);

  try {
    const rawResponse = JSON.parse(await fs.promises.readFile(cachedFilePath));
    return new Response(rawResponse);
  } catch (err) {
    const fetchResponse = await fetch(...requestArguments);
    const rawResponse = createRawResponse(fetchResponse);
    await fs.promises.writeFile(cachedFilePath, JSON.stringify(rawResponse));
    return new Response(rawResponse);
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
