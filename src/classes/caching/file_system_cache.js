import cacache from 'cacache';
import { Readable } from 'stream';

function getBodyAndMetaKeys(key) {
  return [`${key}body`, `${key}meta`];
}

export class FileSystemCache {
  constructor(options = {}) {
    this.ttl = options.ttl;
    this.cacheDirectory = options.cacheDirectory || '.cache';
  }

  async get(key) {
    const [, metaKey] = getBodyAndMetaKeys(key);

    const metaInfo = await cacache.get.info(this.cacheDirectory, metaKey);

    if (!metaInfo) {
      return undefined;
    }

    const metaBuffer = await cacache.get.byDigest(this.cacheDirectory, metaInfo.integrity);
    const metaData = JSON.parse(metaBuffer);
    const { bodyStreamIntegrity, empty, expiration } = metaData;

    delete metaData.bodyStreamIntegrity;
    delete metaData.empty;
    delete metaData.expiration;

    if (expiration && expiration < Date.now()) {
      return undefined;
    }

    const bodyStream = empty
      ? Readable.from(Buffer.alloc(0))
      : cacache.get.stream.byDigest(this.cacheDirectory, bodyStreamIntegrity);

    return {
      bodyStream,
      metaData,
    };
  }

  remove(key) {
    const [bodyKey, metaKey] = getBodyAndMetaKeys(key);

    return Promise.all([
      cacache.rm.entry(this.cacheDirectory, bodyKey),
      cacache.rm.entry(this.cacheDirectory, metaKey),
    ]);
  }

  async set(key, bodyStream, metaData) {
    const [bodyKey, metaKey] = getBodyAndMetaKeys(key);
    const metaCopy = { ...metaData };

    if (typeof this.ttl === 'number') {
      metaCopy.expiration = Date.now() + this.ttl;
    }

    try {
      metaCopy.bodyStreamIntegrity = await new Promise((fulfill, reject) => {
        bodyStream.pipe(cacache.put.stream(this.cacheDirectory, bodyKey))
          .on('integrity', (i) => fulfill(i))
          .on('error', (e) => {
            reject(e);
          });
      });
    } catch (err) {
      if (err.code !== 'ENODATA') {
        throw err;
      }

      metaCopy.empty = true;
    }

    const metaBuffer = Buffer.from(JSON.stringify(metaCopy));
    await cacache.put(this.cacheDirectory, metaKey, metaBuffer);
    const cachedData = await this.get(key);

    return cachedData;
  }
}
