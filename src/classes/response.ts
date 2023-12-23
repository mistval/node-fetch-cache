import { Response } from 'node-fetch';

const responseInternalSymbol = Object.getOwnPropertySymbols(new Response())[1];

export class NFCResponse extends Response {
  static serializeMetaFromNodeFetchResponse(response: Response) {
    const metaData = {
      url: response.url,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers.raw(),
      size: response.size,
      timeout: response.timeout,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      counter: (response as any)[responseInternalSymbol!].counter,
    };

    return metaData;
  }

  constructor(bodyStream: NodeJS.ReadableStream, metaData: Record<string, unknown>, public readonly ejectFromCache: () => Promise<unknown>, public readonly fromCache: boolean) {
    super(bodyStream, metaData);
  }
}
