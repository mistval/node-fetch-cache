import { Response } from 'node-fetch';

const responseInternalSymbol = Object.getOwnPropertySymbols(new Response())[1];

export class NFCResponse extends Response {
  constructor(bodyStream: NodeJS.ReadableStream, metaData: object, public readonly ejectFromCache: () => Promise<unknown>, public readonly fromCache: boolean) {
    super(bodyStream, metaData);
  }

  static serializeMetaFromNodeFetchResponse(res: Response) {
    const metaData = {
      url: res.url,
      status: res.status,
      statusText: res.statusText,
      headers: res.headers.raw(),
      size: res.size,
      timeout: res.timeout,
      counter: (res as any)[responseInternalSymbol as symbol].counter,
    };

    return metaData;
  }
}
