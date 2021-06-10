const fs = require('fs');
const FormData = require('form-data');
const assert = require('assert');
const rimraf = require('rimraf');
const path = require('path');
const FetchCache = require('../index.js');
const { URLSearchParams } = require('url');

const CACHE_PATH = path.join(__dirname, '..', '.cache');
const expectedPngBuffer = fs.readFileSync(path.join(__dirname, 'expected_png.png'));

const TWO_HUNDRED_URL = 'https://httpbin.org/status/200';
const FOUR_HUNDRED_URL = 'https://httpbin.org/status/400';
const THREE_HUNDRED_TWO_URL = 'https://httpbin.org/status/302';
const TEXT_BODY_URL = 'https://httpbin.org/robots.txt';
const JSON_BODY_URL = 'https://httpbin.org/json';
const PNG_BODY_URL = 'https://httpbin.org/image/png';

const TEXT_BODY_EXPECTED = 'User-agent: *\nDisallow: /deny\n';

let fetch;
let res;
let body;

function post(body) {
  return { method: 'POST', body };
}

beforeEach(async function() {
  rimraf.sync(CACHE_PATH);
  fetch = FetchCache(CACHE_PATH);
});

describe('Basic property tests', function() {
  it('Has a status property', async function() {
    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.status, 200);

    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.status, 200);
  });

  it('Has a statusText property', async function() {
    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.statusText, 'OK');

    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.statusText, 'OK');
  });

  it('Has a url property', async function() {
    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.url, TWO_HUNDRED_URL);

    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.url, TWO_HUNDRED_URL);
  });

  it('Has an ok property', async function() {
    res = await fetch(FOUR_HUNDRED_URL);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, 400);

    res = await fetch(FOUR_HUNDRED_URL);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, 400);
  });

  it('Has a headers property', async function() {
    res = await fetch(TWO_HUNDRED_URL);
    assert.notStrictEqual(res.headers, undefined);

    res = await fetch(TWO_HUNDRED_URL);
    assert.notStrictEqual(res.headers, undefined);
  });

  it('Has a redirected property', async function() {
    res = await fetch(THREE_HUNDRED_TWO_URL);
    assert.strictEqual(res.redirected, true);

    res = await fetch(THREE_HUNDRED_TWO_URL);
    assert.strictEqual(res.redirected, true);
  });
}).timeout(10000);

describe('Cache tests', function() {
  it('Uses cache', async function() {
    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can eject from cache', async function() {
    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);

    await res.ejectFromCache();

    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, true);
  });

  it('Does not error if rejecting from cache twice', async function() {
    res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.fromCache, false);

    await res.ejectFromCache();
    await res.ejectFromCache();
  });

  it('Gives different string bodies different cache keys', async function() {
    res = await fetch(TWO_HUNDRED_URL, post('a'));
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL, post('b'));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives same string bodies same cache keys', async function() {
    res = await fetch(TWO_HUNDRED_URL, post('a'));
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL, post('a'));
    assert.strictEqual(res.fromCache, true);
  });

  it('Gives different URLSearchParams different cache keys', async function() {
    res = await fetch(TWO_HUNDRED_URL, post(new URLSearchParams('a=a')));
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL, post(new URLSearchParams('a=b')));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives same URLSearchParams same cache keys', async function() {
    res = await fetch(TWO_HUNDRED_URL, post(new URLSearchParams('a=a')));
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL, post(new URLSearchParams('a=a')));
    assert.strictEqual(res.fromCache, true);
  });

  it('Gives different read streams different cache keys', async function() {
    const s1 = fs.createReadStream(__filename);
    const s2 = fs.createReadStream(path.join(__dirname, '..', 'index.js'));

    res = await fetch(TWO_HUNDRED_URL, post(s1));
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL, post(s2));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives the same read streams the same cache key', async function() {
    const s1 = fs.createReadStream(__filename);

    res = await fetch(TWO_HUNDRED_URL, post(s1));
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL, post(s1));
    assert.strictEqual(res.fromCache, true);
  });

  it('Gives different form data different cache keys', async function() {
    const data1 = new FormData();
    data1.append('a', 'a');

    const data2 = new FormData();
    data2.append('b', 'b');

    res = await fetch(TWO_HUNDRED_URL, post(data1));
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL, post(data2));
    assert.strictEqual(res.fromCache, false);
  });

  it('Gives same form data same cache keys', async function() {
    const data1 = new FormData();
    data1.append('a', 'a');

    const data2 = new FormData();
    data2.append('a', 'a');

    res = await fetch(TWO_HUNDRED_URL, post(data1));
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TWO_HUNDRED_URL, post(data2));
    assert.strictEqual(res.fromCache, true);
  });
}).timeout(10000);

describe('Data tests', function() {
  it('Refuses to consume body twice', async function() {
    res = await fetch(TEXT_BODY_URL);
    await res.text();

    try {
      await res.text();
      throw new Error('The above line should have thrown.');
    } catch (err) {
      // It threw
    }
  });

  it('Can get text body', async function() {
    res = await fetch(TEXT_BODY_URL);
    body = await res.text();
    assert.strictEqual(body, TEXT_BODY_EXPECTED);
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TEXT_BODY_URL);
    body = await res.text();
    assert.strictEqual(body, TEXT_BODY_EXPECTED);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can get JSON body', async function() {
    res = await fetch(JSON_BODY_URL);
    body = await res.json();
    assert(body.slideshow);
    assert.strictEqual(res.fromCache, false);

    res = await fetch(JSON_BODY_URL);
    body = await res.json();
    assert(body.slideshow);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can get PNG buffer body', async function() {
    res = await fetch(PNG_BODY_URL);
    body = await res.buffer();
    assert.strictEqual(expectedPngBuffer.equals(body), true);
    assert.strictEqual(res.fromCache, false);

    res = await fetch(PNG_BODY_URL);
    body = await res.buffer();
    assert.strictEqual(expectedPngBuffer.equals(body), true);
    assert.strictEqual(res.fromCache, true);
  });

  it('Can stream a body', async function() {
    res = await fetch(TEXT_BODY_URL);
    body = '';

    for await (const chunk of res.body) {
      body += chunk.toString();
    }

    assert.strictEqual(TEXT_BODY_EXPECTED, body);
    assert.strictEqual(res.fromCache, false);

    res = await fetch(TEXT_BODY_URL);
    body = '';

    for await (const chunk of res.body) {
      body += chunk.toString();
    }

    assert.strictEqual(TEXT_BODY_EXPECTED, body);
    assert.strictEqual(res.fromCache, true);
  });
}).timeout(10000);
