# node-fetch-cache

node-fetch with caching of responses.

The first fetch with any given arguments will result in an HTTP request and any subsequent fetch with the same arguments will read the response from the cache.

By default responses are cached in memory, but you can also cache to files on disk, or implement your own cache. See the **Cache Customization** section for more info.

## Usage

Require it and use it the same way you would use node-fetch:

```js
const fetch = require('node-fetch-cache');

fetch('http://google.com')
  .then(response => response.text())
  .then(text => console.log(text));
```

The next time you `fetch('http://google.com')`, the response will be returned from the cache. No HTTP request will be made.

## API

This module aims to expose the same API as `node-fetch` does for the most common use cases, but may not support some of the less common functions, properties, and use cases.

### const fetch = require('node-fetch-cache');

Load the module.

### await fetch(resource [, init])

Same arguments as [node-fetch](https://www.npmjs.com/package/node-fetch), except using the [Request class](https://www.npmjs.com/package/node-fetch#new-requestinput-options) is not supported.

Returns a **CachedResponse**.

### await CachedResponse.ejectFromCache()

Eject the response from the cache, so that the next request will perform a true HTTP request rather than returning a cached response.

Keep in mind that this module caches **all** responses, even if they return errors. You might want to use this function in certain cases like receiving a 5xx response status, so that you can retry requests.

### await CachedResponse.text()

Returns the body as a string, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### await CachedResponse.json()

Returns the body as a JavaScript object, parsed from JSON, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### await CachedResponse.buffer()

Returns the body as a Buffer, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### CachedResponse.status

Returns the HTTP status code of the response, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### CachedResponse.statusText

Returns a text represention of the response status, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### CachedResponse.ok

Returns true if the request returned a successful response status, false otherwise, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### CachedResponse.redirected

Returns true if the request was redirected, false otherwise, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### CachedResponse.headers

Returns a **ResponseHeaders** object representing the headers of the response, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### ResponseHeaders.entries()

Returns the raw headers as an array of `[key, value]` pairs, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### ResponseHeaders.keys()

Returns an array of all header keys, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### ResponseHeaders.values()

Returns an array of all header values, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### ResponseHeaders.get(key)

Returns the value of the header with the given key, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### ResponseHeaders.has(key)

Returns true if the headers has a value for the given key, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

### ResponseHeaders.raw

Returns the headers as an object of `{ "key": "value" }` pairs, same as [node-fetch](https://www.npmjs.com/package/node-fetch).

## Streaming

This module supports streams like [node-fetch](https://www.npmjs.com/package/node-fetch) does, but with a couple of caveats you should be aware of if you want to use streams.

1. Response bodies are always read into memory even if you stream them to disk. That means if you need to stream large responses that don't fit into RAM, this module may be unsuitable.
2. When streaming a request body with fs.ReadStream, the cache key is generated based only on the path of the stream, not its content. That means if you stream `/my/desktop/image.png` twice, you will get a cached response the second time, **even if the content of image.png has changed**. This module may be unsuitable if you need to stream files in requests and the content of those files can change.

## Cache Customization

By default responses are cached in memory, but you can also cache to files on disk, or implement your own cache.

### MemoryCache

This is the default cache delegate. It caches responses in-process in a POJO.

Usage:

```js
const { fetchBuilder, MemoryCache } = require('node-fetch-cache');
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
const  { fetchBuilder, FileSystemCache } = require('node-fetch-cache');
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

You can implement a caching delegate yourself. The cache simply needs to be an object that has `set(key, value)`, `get(key)`, and `remove(key)` functions.

The set function must accept a key (which will be a string) and a value (which will be a JSON-serializable JS object) and store them.

The get function should accept a key and return whatever value was set for that key (or `undefined`/`null` if there is no value for that key).

The remove function should accept a key and remove the cached value associated with that key, if any. It is also safe for your caching delegate to remove values from the cache arbitrarily if desired (for example if you want to implement a TTL in the caching delegate).

All three functions may be async.

For example, you could make and use your own simple memory cache like this:

```js
class MyMemoryCache {
  set(key, value) {
    this[key] = value;
  }

  get(key) {
    return this[key];
  }

  remove(key) {
    delete this[key];
  }
}

const fetchBuilder = require('node-fetch-cache');
const fetch = fetchBuilder.withCache(new MyMemoryCache());

fetch('http://google.com')
  .then(response => response.text())
  .then(text => console.log(text));
```

## Importing as an ES Module

You can import this library as an ES module:

```js
import fetch from 'node-fetch-cache';

fetch('http://google.com')
  .then(response => response.text())
  .then(text => console.log(text));
```

The default import also doubles as a `fetchBuilder`, so you can use it like so if you want to customize the caching:

```js
import fetchBuilder from 'node-fetch-cache';

const fetch = fetchBuilder.withCache(new fetchBuilder.MemoryCache({ ttl: 10000 }));

fetch('http://google.com')
  .then(response => response.text())
  .then(text => console.log(text));
```

## Bugs / Help / Feature Requests / Contributing

For feature requests or help, please visit [the discussions page on GitHub](https://github.com/mistval/node-fetch-cache/discussions).

For bug reports, please file an issue on [the issues page on GitHub](https://github.com/mistval/node-fetch-cache/issues).

Contributions welcome! Please open a [pull request on GitHub](https://github.com/mistval/node-fetch-cache/pulls) with your changes. You can run them by me first on [the discussions page](https://github.com/mistval/node-fetch-cache/discussions) if you'd like.
