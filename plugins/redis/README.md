# @node-fetch-cache/redis

A Redis storage plugin for [node-fetch-cache](https://www.npmjs.com/package/node-fetch-cache).

## Usage

```js
import NodeFetchCache from 'node-fetch-cache';
import { RedisCache } from '@node-fetch-cache/redis';

const fetch = NodeFetchCache.create({
  cache: new RedisCache(options),
});

const response = await fetch('https://mywebsite.com');
```

Options:

```js
{
  // Redis Options
  // These are RedisOptions directly passed through to ioRedis 
  // Redis Connection Parameters
  // add host, port or path as options to set database.
  // Leave host, port or path undefined for localhost:6379
  host: "172.20.1.1",
  port: 16379, 
  // or
  path: "172.20.1.1:16379",
  // All options may be specified. For instance, a database:
  db: 1,
  // Time to live. How long (in ms) responses remain cached before being
  // automatically ejected. If undefined, responses are never
  // automatically ejected from the cache.
  // This sets the expiry within Redis
  ttl: 1000,
}
```

## Testing

A docker instance of Redis may be started as follows:

```sh
docker run -p 6379:6379 redis 
```

Using the local instance of redis does not require the path or host/port to be specified.

## Metadata

The RedisCache class stores metadata as a separate key in the Redis database. The metadata key has the same hash but has suffix ":meta" The keys appear as follows:
```
127.0.0.1:6379> keys *
1) "aaa2b0d76148c24c04f17e168323bccc"
2) "aaa2b0d76148c24c04f17e168323bccc:meta"
127.0.0.1:6379>
```

If the TTL is set (ms), the remaining TTL (seconds) is also able to be inspected:
```
127.0.0.1:6379> ttl aaa2b0d76148c24c04f17e168323bccc
(integer) 59
127.0.0.1:6379> ttl aaa2b0d76148c24c04f17e168323bccc:meta
(integer) 58
127.0.0.1:6379>
```

The cached data may be inspected directly in the Redis CLI:
```
127.0.0.1:6379> type aaa2b0d76148c24c04f17e168323bccc
string
127.0.0.1:6379> get aaa2b0d76148c24c04f17e168323bccc
"<!doctype html><html ...
```

The meta data inspected as follows:
```
127.0.0.1:6379> type aaa2b0d76148c24c04f17e168323bccc:meta
string
127.0.0.1:6379> get aaa2b0d76148c24c04f17e168323bccc:meta
"{\"url\":\"https://www.google.com/\",\"status\":200, ...
```
