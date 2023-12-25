# node-fetch-cache

[![codecov](https://codecov.io/github/mistval/node-fetch-cache/graph/badge.svg?token=UYA5PDNZ0J)](https://codecov.io/github/mistval/node-fetch-cache) ![workflow status](https://github.com/mistval/node-fetch-cache/actions/workflows/ci.yml/badge.svg)

[node-fetch](https://www.npmjs.com/package/node-fetch) with caching of responses.

The first fetch with any given arguments will result in an HTTP request and any subsequent fetch with the same arguments will read the response from the cache.

By default responses are cached in memory, but you can also cache to files on disk, or implement your own cache.

## Usage

Import it and use it the same way you would use [node-fetch](https://www.npmjs.com/package/node-fetch):

```js
import fetch from 'node-fetch-cache';

const response = await fetch('http://google.com');
console.log(await response.text());
```

The next time you `fetch('http://google.com')`, the response will be returned from the cache. No HTTP request will be made.

## Basic API

This module's API is a superset of `node-fetch`'s. You can consult [the node-fetch documentation](https://www.npmjs.com/package/node-fetch) for its general usage. Only the additional caching features provided by node-fetch-cache are discussed below.

### Control what's cached

By default node-fetch-cache caches all responses, regardless of the status code or any other response characteristics.

There are two main ways to customize which responses are cached and which are not.

By `create()`ing a custom fetch instance:

```js
import NodeFetchCache from 'node-fetch-cache';

const fetch = NodeFetchCache.create({
  shouldCacheResponse: (response) => response.ok, // Only cache responses with a 2xx status code
});

const response = await fetch('http://google.com')
console.log(await response.text());
```

Or by passing options to `fetch()` when making a request:

```js
import fetch from 'node-fetch-cache';

const response = await fetch(
  'http://google.com',
  undefined,
  {
    shouldCacheResponse: (response) => response.ok, // Only cache responses with a 2xx status code
  },
);

console.log(await response.text());
```

If you provide options in both ways, then the options are merged together, with those passed to `fetch()` taking precedence.

### Cache to Disk

By default responses are cached in memory, but you can also cache to files on disk. This allows the cache to survive the process exiting, allows multiple processes to share the same cache, and may reduce memory usage.

Use the `FileSystemCache` class like so:

```js
import NodeFetchCache, { FileSystemCache } from 'node-fetch-cache';
const fetch = NodeFetchCache.create({ cache: new FileSystemCache(options) });
```

Options:

```js
{
  cacheDirectory: '/my/cache/directory/path', // Specify where to keep the cache. If undefined, '.cache' is used by default. If this directory does not exist, it will be created.
  ttl: 1000, // Time to live. How long (in ms) responses remain cached before being automatically ejected. If undefined, responses are never automatically ejected from the cache.
}
```

### Cache in Memory with a TTL

If you would like to cache in memory and automatically eject responses after a certain amount of time (in ms), you can create a custom instance of the `MemoryCache` class and use that:

```js
import NodeFetchCache, { MemoryCache } from 'node-fetch-cache';
const fetch = NodeFetchCache.create({ cache: new MemoryCache({ ttl: 1000 }) });
```

Note that the default cache is a globally shared instance of `MemoryCache` with no TTL.

### Implement your Own Cache

If neither `MemoryCache` nor `FileSystemCache` meet your needs, you can implement your own cache. You can use any object that implements the following interface:

```ts
type INodeFetchCacheCache = {
  set(
    key: string,
    bodyStream: NodeJS.ReadableStream,
    metaData: NFCResponseMetadata
  ): Promise<void>;
  get(key: string): Promise<{
    bodyStream: NodeJS.ReadableStream;
    metaData: NFCResponseMetadata;
  } | undefined>;
  remove(key: string): Promise<void>;
};
```

The `set()` function must accept a key (which will be a string), a response body stream, and a metadata object (which will be a JSON-serializable JS object). It should store these in such a way that it can return them later via the `get()` function.

The `get()` function should return the cached body and metadata that had been set via the `set()` function, or `undefined` if no cached value is found.

The `remove()` function should remove the cached value associated with the given key, if any.

You may bend the rules and implement certain types of custom cache control logic in your custom cache if you'd like to. Specifically:
1. Your cache may choose to remove values from the cache arbitrarily (for example if you want to implement a TTL option like `MemoryCache` and `FileSystemCache` do).
2. Your cache may choose to ignore calls to `set()`. For example, if you want to implement a cache that only caches responses with a 2xx status code, you could simply not cache responses with other status codes.
3. It is not strictly necessary for `get()` to return the exact same data that was passed to `set()`. For example `get()` could return a custom header in the metadata with the number of times that the response has been read from the cache.

### Cache-Control: only-if-cached

The HTTP standard describes a [Cache-Control request header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#request_directives) to control aspects of cache behavior. Node-fetch ignores these, but node-fetch-cache respects the `Cache-Control: only-if-cached` directive. When `only-if-cached` is specified, node-fetch-cache will return a `504 Gateway Timeout` response with an `isCacheMiss` property if there is no cached response that can be returned. No HTTP request will be made. For example:

```js
import fetch from 'node-fetch-cache';

const response = await fetch('https://google.com', {
  headers: { 'Cache-Control': 'only-if-cached' }
});

if (response.isCacheMiss) {
  // No response was found in the cache
}
```

## Advanced API

### Custom Cache Key Function

You can provide custom cache key generation logic to node-fetch-cache by passing a `calculateCacheKey` option to `create()`:

```js
import NodeFetchCache, { CACHE_VERSION } from 'node-fetch-cache';

const fetch = NodeFetchCache.create({
  calculateCacheKey: (url, options) => {
    return JSON.stringify([url, CACHE_VERSION]);
  },
});
```

In the above example, all requests to a given URL will hash to the same cache key, so only the very first request with that URL will result in an HTTP request and all subsequent requests will read the response from the cache, even if they have completely different headers, bodies, etc.

It is wise to include `CACHE_VERSION` as part of the cache key so that when node-fetch-cache has backwards-incomptible changes in storage format, the obsolete cache entries will be automatically abandoned.

### Built-In Cache Key Function

node-fetch-cache exports a `calculateCacheKey()` which is the default function used to calculate a cache key string from request parameters. It may be useful for enabling some advanced use cases (especially if you want to call cache functions directly). Call `calculateCacheKey()` exactly like you would call `fetch()`:

```js
import { fetchBuilder, MemoryCache, calculateCacheKey } from 'node-fetch-cache';

const cache = new MemoryCache();
const fetch = fetchBuilder.withCache(cache);

const rawCacheData = await cache.get(calculateCacheKey('https://google.com'));
```

### Eject responses from the cache

Responses from node-fetch-cache have an `ejectFromCache()` method that can be used to eject the response from the cache, so that the next request will perform a true HTTP request rather than returning a cached response. This may be useful for more advanced use cases where you want to dynamically remove a response from the cache at some later time:

```js
import fetch from 'node-fetch-cache';

const response = await fetch('http://google.com');

// Your code...

await response.ejectFromCache();
```

## Upgrading node-fetch-cache v3 -> v4

The v4 version of this package has several breaking changes and new features. Please review the below details if you are upgrading from v3.

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
const fetch = NodeFetchCache.create({ cache: new FileSystemCache(options) });
```

### Cache-Control: only-if-cached

If you are relying on the `Cache-Control: only-if-cached` header feature, that has been changed to better align with the browser fetch API. It no longer returns `undefined`, but instead returns a `504 Gateway Timeout` response if no cached response is available. The response will also have an `isCacheMiss` property set to true to help you distinguish it from a regular 504 response. You should rewrite code like this:

```js
import fetch from 'node-fetch-cache';

const response = await fetch('https://google.com', {
  headers: { 'Cache-Control': 'only-if-cached' }
});

if (response === undefined) {
  // No response was found in the cache
}
```

To this:

```js
import fetch from 'node-fetch-cache';

const response = await fetch('https://google.com', {
  headers: { 'Cache-Control': 'only-if-cached' }
});

if (response.isCacheMiss) {
  // No response was found in the cache
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
fetch('http://google.com', {
  shouldCacheResponse: response => response.ok,
}).then(response => {
  return response.text();
}).then(text => console.log(text));
```

## Misc

### Streams

node-fetch-cache does not support `Stream` request bodies, except for `fs.ReadStream`. And when using `fs.ReadStream`, the cache key is generated based only on the path of the stream, not its content. That means if you stream `/my/desktop/image.png` twice, you will get a cached response the second time, **even if the content of image.png has changed**.

Streams don't quite play nice with the concept of caching based on request characteristics, because we would have to read the stream to the end to find out what's in it and hash it into a proper cache key.

### Request Concurrency

Requests with the same cache key are queued. For example, you might wonder if making the same request 100 times simultaneously would result in 100 HTTP requests:

```js
import fetch from 'node-fetch-cache';

await Promise.all(
  Array(100).fill().map(() => fetch('https://google.com')),
);
```

The answer is no. Only one request would be made, and 99 of the `fetch()` operations will read the response from the cache.

### CommonJS

node-fetch-cache supports both ESM and CommonJS. If you are using CommonJS, you can import it like so:

```js
const fetch = require('node-fetch-cache');
```

### Node.js Support Policy

node-fetch-cache will support:
* The current Node.js version
* All non-EOL LTS Node.js versions
* In addition, as far back as is technically easy

Currently the oldest supported Node.js version is v14.14.0, which adds `fs.rmSync()` which is used by a dependency.

Automated tests will be run on the current Node.js version, the oldest supported Node.js version, and the latest release of all even-numbered Node.js versions between those two.

## Bugs / Help / Feature Requests / Contributing

For feature requests or help, please visit [the discussions page on GitHub](https://github.com/mistval/node-fetch-cache/discussions).

For bug reports, please file an issue on [the issues page on GitHub](https://github.com/mistval/node-fetch-cache/issues).

Contributions welcome! Please open a [pull request on GitHub](https://github.com/mistval/node-fetch-cache/pulls) with your changes. You can run them by me first on [the discussions page](https://github.com/mistval/node-fetch-cache/discussions) if you'd like. Please add tests for any changes.
