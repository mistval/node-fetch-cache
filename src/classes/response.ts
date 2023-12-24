import { Buffer } from 'buffer';
import { Readable } from 'stream';
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

  static cacheMissResponse(
    url: string,
  ) {
    return new NFCResponse(
      Readable.from(Buffer.alloc(0)),
      {
        url,
        status: 504,
        statusText: 'Gateway Timeout', // TODO: Check if this is the correct statusText
        headers: {},
        size: 0,
        timeout: 0,
        counter: 0,
      },
      async () => undefined,
      false,
      true,
    );
  }

  constructor(
    bodyStream: NodeJS.ReadableStream,
    metaData: Record<string, unknown>,
    public readonly ejectFromCache: () => Promise<unknown>,
    public readonly fromCache: boolean,
    public readonly isCacheMiss = false,
  ) {
    super(bodyStream, metaData);
  }
}
