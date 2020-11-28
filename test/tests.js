const assert = require('assert');
const rimraf = require('rimraf');
const path = require('path');
const FetchCache = require('../index.js');

const CACHE_PATH = path.join(__dirname, '..', '.cache');

const TWO_HUNDRED_URL = 'https://httpbin.org/status/200';
const FOUR_HUNDRED_URL = 'https://httpbin.org/status/400';
const THREE_HUNDRED_TWO_URL = 'https://httpbin.org/status/302';
const TEXT_BODY_URL = 'https://httpbin.org/robots.txt';
const TEXT_BODY_EXPECTED = 'User-agent: *\nDisallow: /deny\n';

let fetch;
let res;
let body;

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
}).timeout(10000);

describe('Data tests', function() {
  it('Can get text body', async function() {
    res = await fetch(TEXT_BODY_URL);
    body = await res.text();
    assert.strictEqual(body, TEXT_BODY_EXPECTED);

    res = await fetch(TEXT_BODY_URL);
    body = await res.text();
    assert.strictEqual(body, TEXT_BODY_EXPECTED);
  });
}).timeout(10000);
