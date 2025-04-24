import type { ReadableStream } from "stream/web";
import assert from 'assert';
import { NFCResponseMetadata } from '../types.js';

async function createNFCResponseClass() {
  const responseInternalSymbol = Object.getOwnPropertySymbols(new Response())[1];
  assert(responseInternalSymbol, 'Failed to get node-fetch responseInternalSymbol');

  return class NFCResponse extends Response {
    static serializeMetaFromNodeFetchResponse(response: Response): NFCResponseMetadata {
      const metaData = {
        url: response.url,
        status: response.status,
        statusText: response.statusText,
        headers: Array.from(response.headers.entries()).reduce<Record<string, string[]>>((headers, [key, value]) => { headers[key] = [...(headers[key] ?? []), value]; return headers; }, {}),
        //size: response.size,
        counter: (response as any)[responseInternalSymbol!].counter as number,
      };

      return metaData;
    }

    static cacheMissResponse(
      url: string,
    ) {
      return new NFCResponse(
        new Blob().stream() as Omit<ReadableStream<any>, "closed">,
        {
          url,
          status: 504,
          statusText: 'Gateway Timeout',
          headers: {},
          //size: 0,
          counter: 0,
        },
        async () => undefined,
        false,
        true,
      );
    }

    constructor(
      bodyStream: Omit<ReadableStream, "closed">,
      metaData: Omit<ResponseInit, 'headers'> & {
        url: string;
        //size: number;
        counter: number;
        headers: Record<string, string[]>;
      },
      public readonly ejectFromCache: () => Promise<unknown>,
      public readonly returnedFromCache: boolean,
      public readonly isCacheMiss = false,
    ) {
      super(
        bodyStream,
        metaData as any, // eslint-disable-line @typescript-eslint/no-unsafe-argument
      );
    }
  }
}

export type NFCResponseClass = Awaited<ReturnType<typeof createNFCResponseClass>>;
export type NFCResponse = InstanceType<NFCResponseClass>;

let cachedClass: NFCResponseClass | undefined;

export async function getNFCResponseClass() {
  if (!cachedClass) {
    cachedClass = await createNFCResponseClass();
  }

  return cachedClass;
}
