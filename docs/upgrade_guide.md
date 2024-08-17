# Upgrade Guide

## Upgrading node-fetch-cache v4 -> v5

The v5 version of `node-fetch-cache` upgrades `node-fetch` from v2 to v3.

Please consult the [node-fetch v2 -> v3 upgrade guide](https://github.com/node-fetch/node-fetch/blob/main/docs/v3-UPGRADE-GUIDE.md) and follow the instructions there, except regarding the following:

1. The minimum supported node version for `node-fetch-cache` is v18.18.0
2. Unlike `node-fetch` v3, `node-fetch-cache` v5 still supports CommonJS.

In addition, `node-fetch-cache` specifics have changed in the following breaking ways, which will affect a minority of use cases:

1. If you are providing a custom `calculateCacheKey` function, it must now be async (returns a promise).
2. `node-fetch-cache` now uses [formdata-node](https://www.npmjs.com/package/formdata-node) instead of [form-data](https://www.npmjs.com/package/form-data) (which has been deprecated in `node-fetch` v3). This may affect you if you are sending request bodies of type FormData.

## Upgrading node-fetch-cache v3 -> v4

The v4 version of `node-fetch-cache` has several breaking changes and new features.

### Node.js v14.14.0 is now the lowest supported Node.js version

v4 will not work at all on Node.js versions below v14.14.0.

### Specifying a Cache

The syntax to specify a non-default cache has changed. You should rewrite code like this:

```js
import { fetchBuilder, FileSystemCache } from 'node-fetch-cache';
const fetch = fetchBuilder.withCache(new FileSystemCache(options));
```

To this:

```js
import NodeFetchCache, { FileSystemCache } from 'node-fetch-cache';

const fetch = NodeFetchCache.create({
  cache: new FileSystemCache(options),
});
```

### Cache-Control: only-if-cached

If you are relying on the `Cache-Control: only-if-cached` header feature, that has been changed to better align with the browser fetch API. It no longer returns `undefined`, but instead returns a `504 Gateway Timeout` response if no cached response is available. The response will also have an `isCacheMiss` property set to true to help you distinguish it from a regular 504 response. You should rewrite code like this:

```js
import fetch from 'node-fetch-cache';

const response = await fetch('https://google.com', {
  headers: { 'Cache-Control': 'only-if-cached' }
});

if (response === undefined) {
  console.log('No response was found in the cache!');
}
```

To this:

```js
import fetch from 'node-fetch-cache';

const response = await fetch('https://google.com', {
  headers: { 'Cache-Control': 'only-if-cached' }
});

if (response.isCacheMiss) {
  console.log('No response was found in the cache!');
}
```

### TypeScript

If you were using the `@types/node-fetch-cache` package, that is no longer necessary as v4 includes its own TypeScript definitions, which may be somewhat different.

### ejectFromCache()

While the `ejectFromCache()` function still exists and functions the same way as in v3, you may find the new `shouldCacheResponse` option to be cleaner for many use cases, and it also allows you to keep the response from being cached in the first place which will reduce writes to the cache. So consider rewriting code like this:

```js
fetch('http://google.com')
  .then(async response => {
    if (!response.ok) {
      await response.ejectFromCache();
    } else {
      return response.text();
    }
  }).then(text => console.log(text));
```

To this:

```js
fetch(
  'http://google.com',
  undefined,
  { shouldCacheResponse: response => response.ok },
).then(response => {
  return response.text();
}).then(text => console.log(text));
```
