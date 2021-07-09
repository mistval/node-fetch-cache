import { Response } from 'node-fetch';
import { PassThrough } from 'stream';

const responseInternalSymbol = Object.getOwnPropertySymbols(new Response())[1];

export class NFCResponse extends Response {
  constructor(bodyStream, metaData, ejectFromCache, fromCache) {
    const stream1 = new PassThrough();
    const stream2 = new PassThrough();

    bodyStream.pipe(stream1);
    bodyStream.pipe(stream2);

    super(stream1, metaData);
    this.ejectFromCache = ejectFromCache;
    this.fromCache = fromCache;
    this.serializationStream = stream2;
  }

  static fromNodeFetchResponse(res, ejectFromCache) {
    const bodyStream = res.body;
    const metaData = {
      url: res.url,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers.raw(),
      size: res.size,
      timeout: res.timeout,
      counter: res[responseInternalSymbol].counter,
    };

    return new NFCResponse(bodyStream, metaData, ejectFromCache, false);
  }

  static fromCachedResponse(bodyStream, rawMetaData, ejectSelfFromCache) {
    if (bodyStream.readableEnded) {
      throw new Error('Cache returned a body stream that has already been read to end.');
    }

    return new NFCResponse(bodyStream, rawMetaData, ejectSelfFromCache, true);
  }

  serialize() {
    return {
      bodyStream: this.serializationStream,
      metaData: {
        url: this.url,
        status: this.status,
        statusText: this.statusText,
        headers: this.headers.raw(),
        size: this.size,
        timeout: this.timeout,
        counter: this[responseInternalSymbol].counter,
      },
    };
  }

  ejectFromCache() {
    return this.ejectSelfFromCache();
  }
}
