import { Response } from 'node-fetch';

const responseInternalSymbol = Object.getOwnPropertySymbols(new Response())[1];

export class NFCResponse extends Response {
  constructor(bodyStream, metaData, ejectFromCache, fromCache) {
    super(bodyStream, metaData);
    this.ejectFromCache = ejectFromCache;
    this.fromCache = fromCache;
  }

  static serializeMetaFromNodeFetchResponse(res) {
    const metaData = {
      url: res.url,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers.raw(),
      size: res.size,
      timeout: res.timeout,
      counter: res[responseInternalSymbol].counter,
    };

    return metaData;
  }

  ejectFromCache() {
    return this.ejectSelfFromCache();
  }
}
