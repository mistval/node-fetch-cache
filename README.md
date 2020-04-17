# node-fetch-cache

node-fetch with caching to a directory on disk.

The first request will result in an HTTP request and any subsequent requests with the same arguments and body function (text, json, buffer, or textConverted) will read the response body from the cache on disk.

## Usage

Use it the same way you would use fetch.

```js
const fetch = require('node-fetch-cache')('./path/to/cache/dir');

fetch('http://google.com')
  .then(response => response.text())
  .then(text => console.log(text));
```

## API

Note that this is not the full fetch API. Headers and some other things are not accessible.

### async fetch(resource [, init])

Same calling conventions as [browser fetch](https://developer.mozilla.org/en-US/docs/Web/API/WindowOrWorkerGlobalScope/fetch).

Returns a **CachedResponse**.

### async CachedResponse.text()

Returns the body as a string.

### async CachedResponse.json()

Returns the body as a JavaScript object, parsed from JSON.

### async CachedResponse.buffer()

Returns the body as a Buffer.

### async CachedResponse.textConverted()

Identical to CachedResponse.text(), except instead of always converting to UTF-8, encoding sniffing will be performed and text converted to UTF-8, if possible.

(This API requires an optional dependency on [npm package encoding](https://www.npmjs.com/package/encoding), which you need to install manually. 