const assert = require('assert');
const path = require('path');
const fetch = require('../index.js')(path.join(__dirname, '..', '.cache'));

const TWO_HUNDRED_URL = 'https://httpbin.org/status/200';
const FOUR_HUNDRED_URL = 'https://httpbin.org/status/400';
const THREE_HUNDRED_TWO_URL = 'https://httpbin.org/status/302';

describe('Basic property tests', function() {
  it('Has a status property', async function() {
    const res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.status, 200);
  });

  it('Has a statusText property', async function() {
    const res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.statusText, 'OK');
  });

  it('Has a type property', async function() {
    const res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.type, 'basic');
  });

  it('Has a url property', async function() {
    const res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.url, TWO_HUNDRED_URL);
  });

  it('Has a useFinalURL property', async function() {
    const res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.useFinalURL, true);
  });

  it('Has an ok property', async function() {
    const res = await fetch(FOUR_HUNDRED_URL);
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.status, 400);
  });

  it('Has a headers property', async function() {
    const res = await fetch(TWO_HUNDRED_URL);
    assert.notStrictEqual(res.headers, undefined);
  });

  it('Has a redirected property', async function() {
    const res = await fetch(THREE_HUNDRED_TWO_URL);
    assert.strictEqual(res.redirected, true);
  });
});