# node-fetch-cache

node-fetch with caching of responses.

The first fetch with any given arguments will result in an HTTP request and any subsequent fetch with the same arguments will read the response from the cache.

By default responses are cached in memory, but you can also cache to files on disk, or implement your own cache. See the **Cache Customization** section for more info.

## Usage

Require it and use it the same way you would use node-fetch:

```js
import fetch from 'node-fetch-cache';

fetch('http://google.com')
  .then(response => response.text())
  .then(text => console.log(text));
```

The next time you `fetch('http://google.com')`, the response will be returned from the cache. No HTTP request will be made.

## API

This module's fetch function has almost the exact same API as node-fetch, and you should consult [the node-fetch documentation](https://www.npmjs.com/package/node-fetch) for how to use it.

This module just adds one extra function to the response object:

### res.ejectFromCache(): Promise\<void\>

This function can be used to eject the response from the cache, so that the next request will perform a true HTTP request rather than returning a cached response.

This module caches ALL responses, even those with 4xx and 5xx response statuses. You can use this function to uncache such responses if desired. For example:

```js
import fetch from 'node-fetch-cache';

fetch('http://google.com')
  .then(async response => {
    if (!response.ok) {
      await response.ejectFromCache();
      throw new Error('Non-okay response from google.com');
    } else {
      return response.text();
    }
  }).then(text => console.log(text));
```

## Cache Customization

By default responses are cached in memory, but you can also cache to files on disk, or implement your own cache.

### MemoryCache

This is the default cache delegate. It caches responses in-process in a POJO.

Usage:

```js
import { fetchBuilder, MemoryCache } from 'node-fetch-cache';
const fetch = fetchBuilder.withCache(new MemoryCache(options));
```

Options:

```js
{
  ttl: 1000, // Time to live. How long (in ms) responses remain cached before being automatically ejected. If undefined, responses are never automatically ejected from the cache.
}
```

Note that by default (if you don't use `withCache()`) a **shared** MemoryCache will be used (you can import this module in multiple files and they will all share the same cache). If you instantiate and provide a `new MemoryCache()` as shown above however, the cache is *NOT* shared unless you explicitly pass it around and pass it into `withCache()` in each of your source files.

### FileSystemCache

Cache to a directory on disk. This allows the cache to survive the process exiting.

Usage:

```js
import { fetchBuilder, FileSystemCache } from 'node-fetch-cache';
const fetch = fetchBuilder.withCache(new FileSystemCache(options));
```

Options:

```js
{
  cacheDirectory: '/my/cache/directory/path', // Specify where to keep the cache. If undefined, '.cache' is used by default. If this directory does not exist, it will be created.
  ttl: 1000, // Time to live. How long (in ms) responses remain cached before being automatically ejected. If undefined, responses are never automatically ejected from the cache.
}
```

### Provide Your Own

You can implement a caching delegate yourself. The cache simply needs to be an object that has `set(key, bodyStream, bodyMeta)`, `get(key)`, and `remove(key)` functions.

Check the built-in [MemoryCache](https://github.com/mistval/node-fetch-cache/blob/master/src/classes/caching/memory_cache.js) and [FileSystemCache](https://github.com/mistval/node-fetch-cache/blob/master/src/classes/caching/file_system_cache.js) for examples.

The set function must accept a key (which will be a string), a body stream, and a metadata object (which will be a JSON-serializable JS object). It must store these, and then return an object with a `bodyStream` property, containing a fresh, unread stream of the body content, as well as a `metaData` property, containing the same metaData that was passed in.

The get function should accept a key and return undefined if no cached value is found, or else an object with a `bodyStream` property, containing a stream of the body content, as well as a `metaData` property, containing the metadata that was stored via the `set(key, bodyStream, bodyMeta)` function.

The remove function should accept a key and remove the cached value associated with that key, if any. It is also safe for your caching delegate to remove values from the cache arbitrarily if desired (for example if you want to implement a TTL in the caching delegate).

All three functions may be async.

## Misc Tips

### Streaming

This module does not support Stream request bodies, except for fs.ReadStream. And when using fs.ReadStream, the cache key is generated based only on the path of the stream, not its content. That means if you stream `/my/desktop/image.png` twice, you will get a cached response the second time, **even if the content of image.png has changed**.

Streams don't quite play nice with the concept of caching based on request characteristics, because we would have to read the stream to the end to find out what's in it and hash it into a proper cache key.

### Request Concurrency

Requests with the same cache key are queued. For example, you might wonder if making the same request 100 times simultaneously would result in 100 HTTP requests:

```js
import fetch from 'node-fetch-cache';

await Promise.all(
  Array(100).fill().map(() => fetch('https://google.com')),
);
```

The answer is no. Only one request would be made, and 99 of the `fetch()`s will read the response from the cache.

### Cache-Control: only-if-cached Requests

The HTTP standard describes a [Cache-Control request header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control#request_directives) to control certain aspects of cache behavior. Node-fetch ignores these, but node-fetch-cache respects the `Cache-Control: only-if-cached` directive. When `only-if-cached` is specified, node-fetch-cache will return `undefined` if there is no cached response. No HTTP request will be made. For example:

```js
import fetch from 'node-fetch-cache';

const response = await fetch('https://google.com', {
  headers: { 'Cache-Control': 'only-if-cached' }
});

if (response === undefined) {
  // No response was found in the cache
}
```

Note that this is slightly different from browser fetch, which returns a `504 Gateway Timeout` response if no cached response is available.

### Calculating the Cache Key

This module exports a `getCacheKey()` function to calculate a cache key string from request parameters, which may be useful for enabling some advanced use cases (especially if you want to call cache functions directly). Call `getCacheKey()` exactly like you would call `fetch()`.

```js
import { fetchBuilder, MemoryCache, getCacheKey } from 'node-fetch-cache';

const cache = new MemoryCache();
const fetch = fetchBuilder.withCache(cache);

const rawCacheData = await cache.get(getCacheKey('https://google.com'));
```

## Bugs / Help / Feature Requests / Contributing

For feature requests or help, please visit [the discussions page on GitHub](https://github.com/mistval/node-fetch-cache/discussions).

For bug reports, please file an issue on [the issues page on GitHub](https://github.com/mistval/node-fetch-cache/issues).

Contributions welcome! Please open a [pull request on GitHub](https://github.com/mistval/node-fetch-cache/pulls) with your changes. You can run them by me first on [the discussions page](https://github.com/mistval/node-fetch-cache/discussions) if you'd like.
