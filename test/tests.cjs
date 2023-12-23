require('dotenv').config();
const assert = require('assert');
const fetch = require('../dist/wrapper.cjs');

const httpBinBaseUrl = process.env.HTTP_BIN_BASE_URL || 'https://httpbin.org';
const TWO_HUNDRED_URL = `${httpBinBaseUrl}/status/200`;

describe('Commonjs module tests', function() {
  it('Can make a request', async function() {
    const res = await fetch(TWO_HUNDRED_URL);
    assert.strictEqual(res.status, 200);
  });

  it('Has expected properties', function() {
    assert(typeof fetch === 'function');
    assert(fetch.MemoryCache);
    assert(fetch.FileSystemCache);
    assert(fetch.fetchBuilder);
  });
});
