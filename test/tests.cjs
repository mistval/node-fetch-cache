const assert = require('assert');
const fetch = require('../commonjs/wrapper.cjs');

const TWO_HUNDRED_URL = 'https://httpbin.org/status/200';

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
