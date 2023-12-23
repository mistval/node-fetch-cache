import { dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import FormData from 'form-data';
import assert from 'assert';
import rimraf from 'rimraf';
import path from 'path';
import { URLSearchParams } from 'url';
import standardFetch from 'node-fetch';
import FetchCache, { MemoryCache, FileSystemCache, getCacheKey } from '../src/index.js';
import { Agent } from 'http';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CACHE_PATH = path.join(__dirname, '..', '.cache');
const expectedPngBuffer = fs.readFileSync(path.join(__dirname, 'expected_png.png'));

const TWO_HUNDRED_URL = 'https://httpbin.org/status/200';
const FOUR_HUNDRED_URL = 'https://httpbin.org/status/400';
const THREE_HUNDRED_TWO_URL = 'https://httpbin.org/status/302';
const TEXT_BODY_URL = 'https://httpbin.org/robots.txt';
const JSON_BODY_URL = 'https://httpbin.org/json';
const PNG_BODY_URL = 'https://httpbin.org/image/png';

const TEXT_BODY_EXPECTED = 'User-agent: *\nDisallow: /deny\n';

let cachedFetch;
let body;

function post(body) {
  return { method: 'POST', body };
}

function removeDates(arrOrObj) {
  if (arrOrObj.date) {
    const copy = { ...arrOrObj };
    delete copy.date;
    return copy;
  }

  if (Array.isArray(arrOrObj)) {
    if (Array.isArray(arrOrObj[0])) {
      return arrOrObj.filter(e => e[0] !== 'date');
    }

    return arrOrObj.filter(e => !Date.parse(e));
  }

  return arrOrObj;
}

function wait(ms) {
  return new Promise((fulfill) => setTimeout(fulfill, ms));
}

async function dualFetch(...args) {
  const [cachedFetchResponse, standardFetchResponse] = await Promise.all([
    cachedFetch(...args),
    standardFetch(...args),
  ]);

  return { cachedFetchResponse, standardFetchResponse };
}

beforeEach(async function() {
  rimraf.sync(CACHE_PATH);
  cachedFetch = FetchCache.withCache(new MemoryCache());
});

let res;

describe('Basic property tests', function() {
  it('Has a status property', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.strictEqual(cachedFetchResponse.status, standardFetchResponse.status);

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(cachedFetchResponse.status, standardFetchResponse.status);
  });

  it('Has a statusText property', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.strictEqual(cachedFetchResponse.statusText, standardFetchResponse.statusText);

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(cachedFetchResponse.statusText, standardFetchResponse.statusText);
  });

  it('Has a url property', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.strictEqual(cachedFetchResponse.url, standardFetchResponse.url);

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(cachedFetchResponse.url, standardFetchResponse.url);
  });

  it('Has an ok property', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(FOUR_HUNDRED_URL);
    assert.strictEqual(cachedFetchResponse.ok, standardFetchResponse.ok);
    assert.strictEqual(cachedFetchResponse.status, standardFetchResponse.status);

    cachedFetchResponse = await cachedFetch(FOUR_HUNDRED_URL);
    assert.strictEqual(cachedFetchResponse.ok, standardFetchResponse.ok);
    assert.strictEqual(cachedFetchResponse.status, standardFetchResponse.status);
  });

  it('Has a redirected property', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(THREE_HUNDRED_TWO_URL);
    assert.strictEqual(cachedFetchResponse.redirected, standardFetchResponse.redirected);

    cachedFetchResponse = await cachedFetch(THREE_HUNDRED_TWO_URL);
    assert.strictEqual(cachedFetchResponse.redirected, standardFetchResponse.redirected);
  });
}).timeout(10000);

describe('Header tests', function() {
  it('Gets correct raw headers', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(
      removeDates(cachedFetchResponse.headers.raw()),
      removeDates(standardFetchResponse.headers.raw()),
    );

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(
      removeDates(cachedFetchResponse.headers.raw()),
      removeDates(standardFetchResponse.headers.raw()),
    );
  });

  it('Gets correct header keys', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual([...cachedFetchResponse.headers.keys()], [...standardFetchResponse.headers.keys()]);

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual([...cachedFetchResponse.headers.keys()], [...standardFetchResponse.headers.keys()]);
  });

  it('Gets correct header values', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(
      removeDates([...cachedFetchResponse.headers.values()]),
      removeDates([...standardFetchResponse.headers.values()]),
    );

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(
      removeDates([...cachedFetchResponse.headers.values()]),
      removeDates([...standardFetchResponse.headers.values()]),
    );
  });

  it('Gets correct header entries', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(
      removeDates([...cachedFetchResponse.headers.entries()]),
      removeDates([...standardFetchResponse.headers.entries()]),
    );

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(
      removeDates([...cachedFetchResponse.headers.entries()]),
      removeDates([...standardFetchResponse.headers.entries()]),
    );
  });

  it('Can get a header by value', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert(standardFetchResponse.headers.get('content-length'));
    assert.deepStrictEqual(cachedFetchResponse.headers.get('content-length'), standardFetchResponse.headers.get('content-length'));

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(cachedFetchResponse.headers.get('content-length'), standardFetchResponse.headers.get('content-length'));
  });

  it('Returns undefined for non-existent header', async function() {
    const headerName = 'zzzz';
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert(!standardFetchResponse.headers.get(headerName));
    assert.deepStrictEqual(cachedFetchResponse.headers.get(headerName), standardFetchResponse.headers.get(headerName));

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(cachedFetchResponse.headers.get(headerName), standardFetchResponse.headers.get(headerName));
  });

  it('Can get whether a header is present', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert(standardFetchResponse.headers.has('content-length'));
    assert.deepStrictEqual(cachedFetchResponse.headers.has('content-length'), standardFetchResponse.headers.has('content-length'));

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(cachedFetchResponse.headers.has('content-length'), standardFetchResponse.headers.has('content-length'));
  });
}).timeout(10000);

describe('Cache tests', function() {
  it('Uses cache', async function() {
    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can eject from cache', async function() {
    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);

    await res.ejectFromCache();

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);
  });

  it('Does not error if ejecting from cache twice', async function() {
    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    await res.ejectFromCache();
    await res.ejectFromCache();
  });

  it('Gives different string bodies different cache keys', async function() {
    res = await cachedFetch(TWO_HUNDRED_URL, post('a'));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post('b'));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives same string bodies same cache keys', async function() {
    res = await cachedFetch(TWO_HUNDRED_URL, post('a'));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post('a'));
    assert.strictEqual(res.fromCache, true);
  });

  it('Gives different URLSearchParams different cache keys', async function() {
    res = await cachedFetch(TWO_HUNDRED_URL, post(new URLSearchParams('a=a')));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post(new URLSearchParams('a=b')));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives same URLSearchParams same cache keys', async function() {
    res = await cachedFetch(TWO_HUNDRED_URL, post(new URLSearchParams('a=a')));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post(new URLSearchParams('a=a')));
    assert.strictEqual(res.fromCache, true);
  });

  it('Gives different read streams different cache keys', async function() {
    const s1 = fs.createReadStream(path.join(__dirname, 'expected_png.png'));
    const s2 = fs.createReadStream(path.join(__dirname, '..', 'src', 'index.js'));

    res = await cachedFetch(TWO_HUNDRED_URL, post(s1));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post(s2));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives the same read streams the same cache key', async function() {
    const s1 = fs.createReadStream(path.join(__dirname, 'expected_png.png'));

    res = await cachedFetch(TWO_HUNDRED_URL, post(s1));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post(s1));
    assert.strictEqual(res.fromCache, true);
  });

  it('Gives different form data different cache keys', async function() {
    const data1 = new FormData();
    data1.append('a', 'a');

    const data2 = new FormData();
    data2.append('b', 'b');

    res = await cachedFetch(TWO_HUNDRED_URL, post(data1));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post(data2));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives same form data same cache keys', async function() {
    const data1 = new FormData();
    data1.append('a', 'a');

    const data2 = new FormData();
    data2.append('a', 'a');

    res = await cachedFetch(TWO_HUNDRED_URL, post(data1));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post(data2));
    assert.strictEqual(res.fromCache, true);
  });

  it('Does not error with custom agent with circular properties', async function() {
    const agent = new Agent();
    agent.agent = agent;

    await cachedFetch('http://httpbin.org/status/200', { agent });
  });

  it('Works with a TTL of 0', async function() {
    const cachedFetch = FetchCache.withCache(new FileSystemCache({ ttl: 0 }));

    const res = await cachedFetch(TWO_HUNDRED_URL);
    assert(res.ok);
  });
}).timeout(10000);

describe('Data tests', function() {
  it('Supports request objects', async function() {
    let request = new standardFetch.Request('https://google.com', { body: 'test', method: 'POST' });
    res = await cachedFetch(request);
    assert.strictEqual(res.fromCache, false);

    request = new standardFetch.Request('https://google.com', { body: 'test', method: 'POST' });
    res = await cachedFetch(request);
    assert.strictEqual(res.fromCache, true);
  });

  it('Supports request objects with custom headers', async function() {
    const request1 = new standardFetch.Request(TWO_HUNDRED_URL, { headers: { 'XXX': 'YYY' } });
    const request2 = new standardFetch.Request(TWO_HUNDRED_URL, { headers: { 'XXX': 'ZZZ' } });

    res = await cachedFetch(request1);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(request2);
    assert.strictEqual(res.fromCache, false);
  });

  it('Refuses to consume body twice', async function() {
    res = await cachedFetch(TEXT_BODY_URL);
    await res.text();
    await assert.rejects(() => res.text(), /body used already for:/);
  });

  it('Can get text body', async function() {
    res = await cachedFetch(TEXT_BODY_URL);
    body = await res.text();
    assert.strictEqual(body, TEXT_BODY_EXPECTED);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TEXT_BODY_URL);
    body = await res.text();
    assert.strictEqual(body, TEXT_BODY_EXPECTED);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can get JSON body', async function() {
    res = await cachedFetch(JSON_BODY_URL);
    body = await res.json();
    assert(body.slideshow);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(JSON_BODY_URL);
    body = await res.json();
    assert(body.slideshow);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can get PNG buffer body', async function() {
    res = await cachedFetch(PNG_BODY_URL);
    body = await res.buffer();
    assert.strictEqual(expectedPngBuffer.equals(body), true);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(PNG_BODY_URL);
    body = await res.buffer();
    assert.strictEqual(expectedPngBuffer.equals(body), true);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can stream a body', async function() {
    res = await cachedFetch(TEXT_BODY_URL);
    body = '';

    for await (const chunk of res.body) {
      body += chunk.toString();
    }

    assert.strictEqual(TEXT_BODY_EXPECTED, body);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TEXT_BODY_URL);
    body = '';

    for await (const chunk of res.body) {
      body += chunk.toString();
    }

    assert.strictEqual(TEXT_BODY_EXPECTED, body);
    assert.strictEqual(res.fromCache, true);
  });

  it('Errors if the body type is not supported', async function() {
    await assert.rejects(() => cachedFetch(TEXT_BODY_URL, { body: 1 }), /Unsupported body type/);
  });

  it('Uses cache even if you make multiple requests at the same time', async function() {
    const [res1, res2] = await Promise.all([
      cachedFetch('http://httpbin.org/status/200'),
      cachedFetch('http://httpbin.org/status/200'),
    ]);

    // One should be false, the other should be true
    assert(res1.fromCache !== res2.fromCache);
  });
}).timeout(10000);

describe('Memory cache tests', function() {
  it('Supports TTL', async function() {
    cachedFetch = FetchCache.withCache(new MemoryCache({ ttl: 100 }));
    let res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);
    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);

    await wait(200);

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);
  });
}).timeout(10000);

describe('File system cache tests', function() {
  it('Supports TTL', async function() {
    cachedFetch = FetchCache.withCache(new FileSystemCache({ ttl: 100 }));
    let res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);
    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);

    await wait(200);

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);
  });

  it('Can get PNG buffer body', async function() {
    cachedFetch = FetchCache.withCache(new FileSystemCache());
    res = await cachedFetch(PNG_BODY_URL);
    body = await res.buffer();
    assert.strictEqual(expectedPngBuffer.equals(body), true);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(PNG_BODY_URL);
    body = await res.buffer();
    assert.strictEqual(expectedPngBuffer.equals(body), true);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can eject from cache', async function() {
    cachedFetch = FetchCache.withCache(new FileSystemCache());

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);

    await res.ejectFromCache();

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);
  });
});

describe('Cache mode tests', function() {
  it('Can use the only-if-cached cache control setting via init', async function() {
    res = await cachedFetch(TWO_HUNDRED_URL, { headers: { 'Cache-Control': 'only-if-cached' } });
    assert(!res);
    res = await cachedFetch(TWO_HUNDRED_URL, { headers: { 'Cache-Control': 'only-if-cached' } });
    assert(!res);
    res = await cachedFetch(TWO_HUNDRED_URL);
    assert(res && !res.fromCache);
    res = await cachedFetch(TWO_HUNDRED_URL, { headers: { 'Cache-Control': 'only-if-cached' } });
    assert(res && res.fromCache);
    await res.ejectFromCache();
    res = await cachedFetch(TWO_HUNDRED_URL, { headers: { 'Cache-Control': 'only-if-cached' } });
    assert(!res);
  });

  it('Can use the only-if-cached cache control setting via resource', async function() {
    res = await cachedFetch(new standardFetch.Request(TWO_HUNDRED_URL, { headers: { 'Cache-Control': 'only-if-cached' } }));
    assert(!res);
    res = await cachedFetch(new standardFetch.Request(TWO_HUNDRED_URL));
    assert(res && !res.fromCache);
    res = await cachedFetch(new standardFetch.Request(TWO_HUNDRED_URL, { headers: { 'Cache-Control': 'only-if-cached' } }));
    assert(res && res.fromCache);
  });
});

describe('Cache key tests', function() {
  it('Can calculate a cache key and check that it exists', async function() {
    const cache = new MemoryCache();
    cachedFetch = FetchCache.withCache(cache);
    await cachedFetch(TWO_HUNDRED_URL);

    const cacheKey = getCacheKey(TWO_HUNDRED_URL);
    const nonExistentCacheKey = getCacheKey(TEXT_BODY_URL);

    const cacheKeyResult = await cache.get(cacheKey);
    const nonExistentCacheKeyResult = await cache.get(nonExistentCacheKey);

    assert(cacheKeyResult);
    assert(!nonExistentCacheKeyResult);
  });
});

describe('Network error tests', function() {
  it('Bubbles up network errors', async function() {
    await assert.rejects(() => cachedFetch('http://localhost:1'), /^FetchError:/);
  });
});
