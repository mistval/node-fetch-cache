const fs = require('fs');
const FormData = require('form-data');
const assert = require('assert');
const rimraf = require('rimraf');
const path = require('path');
const { URLSearchParams } = require('url');
const standardFetch = require('node-fetch');
const FetchCache = require('../index.js');
const MemoryCache = require('../classes/caching/memory_cache.js');

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
    return [...arrOrObj].filter(e => !Date.parse(e));
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
    assert.deepStrictEqual(cachedFetchResponse.headers.keys(), [...standardFetchResponse.headers.keys()]);

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(cachedFetchResponse.headers.keys(), [...standardFetchResponse.headers.keys()]);
  });

  it('Gets correct header values', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(
      removeDates(cachedFetchResponse.headers.values()),
      removeDates([...standardFetchResponse.headers.values()]),
    );

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(
      removeDates(cachedFetchResponse.headers.values()),
      removeDates([...standardFetchResponse.headers.values()]),
    );
  });

  it('Gets correct header entries', async function() {
    let { cachedFetchResponse, standardFetchResponse } = await dualFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(cachedFetchResponse.headers.entries(), [...standardFetchResponse.headers.entries()]);

    cachedFetchResponse = await cachedFetch(TWO_HUNDRED_URL);
    assert.deepStrictEqual(cachedFetchResponse.headers.entries(), [...standardFetchResponse.headers.entries()]);
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
    const s1 = fs.createReadStream(__filename);
    const s2 = fs.createReadStream(path.join(__dirname, '..', 'index.js'));

    res = await cachedFetch(TWO_HUNDRED_URL, post(s1));
    assert.strictEqual(res.fromCache, false);

    res = await cachedFetch(TWO_HUNDRED_URL, post(s2));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives the same read streams the same cache key', async function() {
    const s1 = fs.createReadStream(__filename);

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
}).timeout(10000);

describe('Data tests', function() {
  it('Does not support Request objects', async function() {
    try {
      const request = new standardFetch.Request('https://google.com');
      await cachedFetch(request);
      throw new Error('The above line should have thrown.');
    } catch (err) {
      assert(err.message.includes('The first argument must be a string (fetch.Request is not supported).'));
    }
  });

  it('Refuses to consume body twice', async function() {
    res = await cachedFetch(TEXT_BODY_URL);
    await res.text();

    try {
      await res.text();
      throw new Error('The above line should have thrown.');
    } catch (err) {
      assert(err.message.includes('Error: body used already'));
    }
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
    try {
      await cachedFetch(TEXT_BODY_URL, { body: {} });
      throw new Error('It was supposed to throw');
    } catch (err) {
      assert(err.message.includes('Unsupported body type'));
    }
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
