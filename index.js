const fetch = require('node-fetch');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const Response = require('./classes/response.js');

function md5(str) {
  return crypto.createHash('md5').update(str).digest('hex');
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
  const [url, requestInit, ...rest] = requestArguments;
  const requestParams = requestInit.body
    ? ({ ...requestInit, body: typeof requestInit.body === 'object' ? requestInit.body.toString() : requestInit.body })
    : requestInit;

  const cacheHash = md5(JSON.stringify([url, requestParams, ...rest]));
  const cachedFilePath = path.join(cacheDirPath, `${cacheHash}.json`);

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
